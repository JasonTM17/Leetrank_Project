package main

// sandbox.go — typed wrapper that funnels every user-code execution through
// nsjail for per-submission isolation.
//
// THREAT MODEL
// ============
// User-submitted code is hostile by default. The judge HTTP server accepts
// arbitrary source in 30+ languages and must run it without compromising:
//   * the host kernel (no privilege escalation, no /proc tricks)
//   * other tenants' submissions running concurrently
//   * the wider LeetRank backplane (no network egress to internal services)
//   * the persistent filesystem (no writes outside per-submission tmpfs)
//   * compute capacity (forkbombs, OOM, infinite loops)
//
// MECHANISM
// =========
// Every argv that would otherwise hit `exec.CommandContext` is wrapped with
// nsjail in once-mode. nsjail is started as PID 1 of a fresh PID namespace,
// in a fresh mount namespace, in a fresh network namespace (default — no
// loopback, no egress), and drops to uid/gid 65534 (`nobody`) before exec.
// Resource limits are applied via setrlimit before the user binary starts.
//
// FALLBACK
// ========
// If nsjail is unavailable (local dev on Windows/macOS, CI legs that haven't
// built the judge image yet), JUDGE_SANDBOX_MODE=off bypasses the wrapper.
// The startup logs print a loud warning so it can never silently regress
// in production. Tests use `requireNsjail(t)` to skip when the binary isn't
// on PATH.

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

// SandboxLimits captures every per-submission resource cap. Values map
// directly to nsjail's --rlimit_* flags and to the wall-clock budget
// enforced by context.Context above the call site.
type SandboxLimits struct {
	MemMB        int // virtual memory ceiling -> --rlimit_as (MB)
	CPUSeconds   int // CPU-time ceiling      -> --rlimit_cpu (seconds)
	WallSeconds  int // wall-clock ceiling    -> --time_limit (seconds)
	MaxProcesses int // process count cap     -> --rlimit_nproc
	MaxOpenFiles int // fd count cap          -> --rlimit_nofile
	MaxFileMB    int // single-file size cap  -> --rlimit_fsize (MB)
}

// DefaultSandboxLimits is the baseline applied to every submission unless
// the LanguageConfig overrides specific fields. Numbers come from ADR 0020
// (judge sandbox model) — keep the two in sync.
var DefaultSandboxLimits = SandboxLimits{
	MemMB:        256,
	CPUSeconds:   5,
	WallSeconds:  10,
	MaxProcesses: 16,
	MaxOpenFiles: 64,
	MaxFileMB:    32,
}

// SandboxRequest is one invocation of user code under the sandbox.
type SandboxRequest struct {
	Workdir string   // host path bind-mounted rw inside the jail; cwd defaults here
	Argv    []string // command + args to exec INSIDE the jail (e.g. ["python3","/work/main.py"])
	Stdin   []byte   // bytes piped to the child's stdin
	Env     []string // optional env overlay; PATH/LANG defaults are added by buildNsjailArgv
	Limits  SandboxLimits
}

// SandboxResult bundles the outcome of one sandboxed run.
type SandboxResult struct {
	Combined []byte // stdout+stderr merged (matches existing CombinedOutput contract)
	ExitCode int    // process exit code; -1 if the process never started
	TimedOut bool   // ctx.DeadlineExceeded fired before the process finished
	Err      error  // wrapper-level failure (binary missing, exec error, etc.)
}

// SandboxMode controls how the sandbox is enforced.
type SandboxMode int

const (
	SandboxNsjail SandboxMode = iota // production: every exec wrapped in nsjail
	SandboxOff                       // dev/CI fallback: argv runs directly with no isolation
)

// String makes SandboxMode loggable.
func (m SandboxMode) String() string {
	switch m {
	case SandboxNsjail:
		return "nsjail"
	case SandboxOff:
		return "off (UNSAFE — no isolation)"
	default:
		return "unknown"
	}
}

var (
	sandboxModeOnce sync.Once
	sandboxMode     SandboxMode
	nsjailPath      string
)

// resolveSandboxMode picks the enforcement mode at first use and caches it.
//
// Order:
//  1. JUDGE_SANDBOX_MODE=off  -> SandboxOff (with a warning log)
//  2. nsjail on PATH          -> SandboxNsjail
//  3. otherwise               -> SandboxOff (with a warning log)
func resolveSandboxMode() (SandboxMode, string) {
	sandboxModeOnce.Do(func() {
		envMode := strings.ToLower(strings.TrimSpace(os.Getenv("JUDGE_SANDBOX_MODE")))
		if envMode == "off" {
			sandboxMode = SandboxOff
			log.Printf("WARNING: JUDGE_SANDBOX_MODE=off — user code will run WITHOUT nsjail isolation. Do NOT use this mode in production.")
			return
		}
		path, err := exec.LookPath("nsjail")
		if err != nil {
			sandboxMode = SandboxOff
			log.Printf("WARNING: nsjail not found on PATH — user code will run WITHOUT isolation. Install nsjail or set JUDGE_SANDBOX_MODE=off explicitly to silence this warning.")
			return
		}
		sandboxMode = SandboxNsjail
		nsjailPath = path
		log.Printf("sandbox: nsjail mode active (binary=%s)", path)
	})
	return sandboxMode, nsjailPath
}

// LogSandboxStartup is called once at server boot so the operator sees the
// active enforcement mode in the service logs even before any submission lands.
func LogSandboxStartup() {
	mode, _ := resolveSandboxMode()
	log.Printf("sandbox: mode=%s, defaults=%+v", mode, DefaultSandboxLimits)
}

// applyDefaults fills any zero field on l with DefaultSandboxLimits.
func (l *SandboxLimits) applyDefaults() {
	if l.MemMB == 0 {
		l.MemMB = DefaultSandboxLimits.MemMB
	}
	if l.CPUSeconds == 0 {
		l.CPUSeconds = DefaultSandboxLimits.CPUSeconds
	}
	if l.WallSeconds == 0 {
		l.WallSeconds = DefaultSandboxLimits.WallSeconds
	}
	if l.MaxProcesses == 0 {
		l.MaxProcesses = DefaultSandboxLimits.MaxProcesses
	}
	if l.MaxOpenFiles == 0 {
		l.MaxOpenFiles = DefaultSandboxLimits.MaxOpenFiles
	}
	if l.MaxFileMB == 0 {
		l.MaxFileMB = DefaultSandboxLimits.MaxFileMB
	}
}

// RunSandboxed executes req.Argv under the configured sandbox mode and
// returns the combined output plus exit metadata. The caller owns the
// context's wall-clock deadline; on ctx.DeadlineExceeded the result is
// flagged TimedOut and the child is signalled by exec.CommandContext.
func RunSandboxed(ctx context.Context, req SandboxRequest) SandboxResult {
	if len(req.Argv) == 0 {
		return SandboxResult{Err: errors.New("sandbox: empty argv"), ExitCode: -1}
	}
	limits := req.Limits
	limits.applyDefaults()

	mode, njpath := resolveSandboxMode()

	var argv []string
	if mode == SandboxNsjail {
		argv = buildNsjailArgv(njpath, req.Workdir, limits, req.Argv)
	} else {
		argv = append([]string{}, req.Argv...)
	}

	cmd := exec.CommandContext(ctx, argv[0], argv[1:]...)
	// Workdir matters only in fallback mode; under nsjail the jail's cwd
	// is set via --cwd inside the jailed mount namespace.
	if mode == SandboxOff && req.Workdir != "" {
		cmd.Dir = req.Workdir
	}
	if len(req.Env) > 0 {
		cmd.Env = req.Env
	}

	var combined bytes.Buffer
	cmd.Stdout = &combined
	cmd.Stderr = &combined
	if len(req.Stdin) > 0 {
		cmd.Stdin = bytes.NewReader(req.Stdin)
	}

	err := cmd.Run()
	res := SandboxResult{Combined: combined.Bytes(), ExitCode: -1}
	if cmd.ProcessState != nil {
		res.ExitCode = cmd.ProcessState.ExitCode()
	}
	if ctx.Err() == context.DeadlineExceeded {
		res.TimedOut = true
		return res
	}
	if err != nil {
		// exec.ExitError is the normal "process exited non-zero" path —
		// not a wrapper failure, so we leave res.Err nil and let the
		// caller decide based on ExitCode.
		var ee *exec.ExitError
		if !errors.As(err, &ee) {
			res.Err = err
		}
	}
	return res
}

// buildNsjailArgv prepends nsjail invocation + flags to inner argv.
//
// The flag set is intentionally aggressive:
//   * fresh PID, mount, network, IPC, UTS namespaces (nsjail defaults)
//   * uid/gid forced to 65534 (nobody)
//   * read-only bindmounts of host /usr, /bin, /lib, /lib64, /etc — toolchain
//     binaries and shared libs visible, but no host writes possible
//   * tmpfs mounted at /tmp (writable scratch, vanishes on exit)
//   * --bindmount of the per-submission workdir so the runner can read source
//     and the registry-driven path can read its compiled artefact
//   * rlimit_* for memory, CPU, processes, open files, max file size
//   * --time_limit hard wall-clock kill at the nsjail level (defence in depth
//     above the Go context.Context deadline)
//   * minimal env: PATH, HOME, LANG only — no host env leaks
func buildNsjailArgv(njpath, workdir string, l SandboxLimits, inner []string) []string {
	args := []string{
		njpath,
		"--mode", "o", // once: run a single command and exit
		"--really_quiet",
		"--time_limit", strconv.Itoa(l.WallSeconds),
		"--rlimit_as", strconv.Itoa(l.MemMB),
		"--rlimit_cpu", strconv.Itoa(l.CPUSeconds),
		"--rlimit_nproc", strconv.Itoa(l.MaxProcesses),
		"--rlimit_nofile", strconv.Itoa(l.MaxOpenFiles),
		"--rlimit_fsize", strconv.Itoa(l.MaxFileMB),
		"--user", "65534",
		"--group", "65534",
		"--disable_clone_newuser",
		// read-only host mounts: toolchain binaries + shared libs.
		"--bindmount_ro", "/usr",
		"--bindmount_ro", "/bin",
		"--bindmount_ro", "/lib",
		"--bindmount_ro", "/lib64",
		"--bindmount_ro", "/etc",
		// writable scratch — tmpfs vanishes after the run.
		"--tmpfsmount", "/tmp",
		// minimal env. The host's env (incl. secrets) is NOT inherited.
		"--env", "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
		"--env", "HOME=/tmp",
		"--env", "LANG=C.UTF-8",
	}
	if workdir != "" {
		// Bind the workdir read-write so the user binary can read its
		// source and write compile artefacts. The host workdir lives
		// under os.TempDir() and is removed by the caller after the run.
		clean := filepath.Clean(workdir)
		args = append(args, "--bindmount", clean+":"+clean, "--cwd", clean)
	} else {
		args = append(args, "--cwd", "/tmp")
	}
	args = append(args, "--")
	args = append(args, inner...)
	return args
}

// SandboxedCombinedOutput is a thin convenience wrapper for call sites that
// previously did `cmd.CombinedOutput()`. It builds a SandboxRequest, runs it,
// and returns (combined, exitCode, timedOut, error) in a shape that maps
// cleanly onto the legacy code paths.
func SandboxedCombinedOutput(
	ctx context.Context,
	workdir string,
	argv []string,
	stdin []byte,
	limits SandboxLimits,
) ([]byte, int, bool, error) {
	res := RunSandboxed(ctx, SandboxRequest{
		Workdir: workdir,
		Argv:    argv,
		Stdin:   stdin,
		Limits:  limits,
	})
	return res.Combined, res.ExitCode, res.TimedOut, res.Err
}

// describeForLog renders a sandbox request for log lines without leaking
// long source paths or stdin. Used by the executor when an exec fails.
func (req SandboxRequest) describeForLog() string {
	if len(req.Argv) == 0 {
		return "<empty argv>"
	}
	return fmt.Sprintf("argv=%v workdir=%q stdinBytes=%d limits=%+v",
		req.Argv, req.Workdir, len(req.Stdin), req.Limits)
}
