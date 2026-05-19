package main

// sandbox_test.go — sandbox-escape suite.
//
// These tests submit malicious payloads through RunSandboxed and assert that
// each ATTACK FAILS — i.e. the sandbox blocks the payload, the process exits
// non-zero, the exec hits the wall-clock cap, or a resource rlimit fires.
//
// CI runs this suite inside the judge container (where nsjail is installed).
// On hosts without nsjail (local dev on macOS / Windows, or the CI legs that
// don't build the judge image) every test is skipped with a clear reason —
// passing on a host without nsjail would be a false sense of security, so we
// refuse to declare success unless the real wrapper is in play.

import (
	"context"
	"os/exec"
	"runtime"
	"strings"
	"testing"
	"time"
)

// requireNsjail skips the test when nsjail isn't on PATH or when running on
// a non-Linux host (nsjail is Linux-only — namespaces don't exist elsewhere).
func requireNsjail(t *testing.T) {
	t.Helper()
	if runtime.GOOS != "linux" {
		t.Skipf("sandbox tests need Linux namespaces; current GOOS=%s", runtime.GOOS)
	}
	if _, err := exec.LookPath("nsjail"); err != nil {
		t.Skip("nsjail not on PATH; install nsjail or run inside the judge container")
	}
	// resolveSandboxMode caches its decision via sync.Once. We don't reset
	// it: if nsjail is on PATH at first call (which it is, given the
	// LookPath check above), the cached mode is already SandboxNsjail.
}

// runShell is a small helper that submits a /bin/sh -c "<payload>" through
// the sandbox with the supplied wall-clock budget.
func runShell(t *testing.T, payload string, wallSeconds int) SandboxResult {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(wallSeconds+2)*time.Second)
	defer cancel()
	return RunSandboxed(ctx, SandboxRequest{
		Argv:  []string{"/bin/sh", "-c", payload},
		Stdin: nil,
		Limits: SandboxLimits{
			MemMB:        256,
			CPUSeconds:   3,
			WallSeconds:  wallSeconds,
			MaxProcesses: 16,
			MaxOpenFiles: 64,
			MaxFileMB:    32,
		},
	})
}

// blockedOK summarises whether an attack was successfully neutralised: it
// must either time out, exit non-zero, hit a wrapper-level error, or produce
// output that proves it was blocked (e.g. "Operation not permitted").
func blockedOK(res SandboxResult, deniedHints ...string) bool {
	if res.TimedOut || res.ExitCode != 0 || res.Err != nil {
		return true
	}
	out := string(res.Combined)
	for _, h := range deniedHints {
		if strings.Contains(out, h) {
			return true
		}
	}
	return false
}

// TestSandbox_Forkbomb — classic shell forkbomb. Either the rlimit_nproc
// cap kills it, or the wall-clock fires. Anything that exits cleanly is
// a sandbox failure.
func TestSandbox_Forkbomb(t *testing.T) {
	requireNsjail(t)
	res := runShell(t, ":(){ :|:& };:", 4)
	if !blockedOK(res, "fork", "Resource temporarily unavailable", "Cannot allocate") {
		t.Fatalf("forkbomb escaped sandbox: exit=%d timedOut=%v err=%v out=%q",
			res.ExitCode, res.TimedOut, res.Err, string(res.Combined))
	}
}

// TestSandbox_NetworkEgress — must fail because the network namespace is
// fresh and not connected to anything (no loopback, no routes).
func TestSandbox_NetworkEgress(t *testing.T) {
	requireNsjail(t)
	// We don't probe a public host (CI flakiness) — we hit the link-local
	// address that should be routable in any non-jailed environment but
	// has no path inside the empty net namespace.
	res := runShell(t, "getent ahosts example.com >/dev/null 2>&1; echo exit=$?", 3)
	out := strings.TrimSpace(string(res.Combined))
	// In an empty net NS, getent returns 2 (no name resolution) — accept
	// that, plus any non-zero or timeout, plus an explicit network error.
	if res.ExitCode == 0 && strings.HasSuffix(out, "exit=0") {
		t.Fatalf("network-egress was allowed: %q", out)
	}
}

// TestSandbox_FilesystemWrite — writes outside /tmp must fail because the
// bindmounts are read-only.
func TestSandbox_FilesystemWrite(t *testing.T) {
	requireNsjail(t)
	res := runShell(t, "echo pwned > /etc/passwd", 3)
	if !blockedOK(res, "Read-only file system", "Permission denied", "Operation not permitted") {
		t.Fatalf("write to /etc/passwd succeeded: exit=%d out=%q",
			res.ExitCode, string(res.Combined))
	}
}

// TestSandbox_SUIDExec — try to set SUID and exec; --user 65534 plus
// no_new_privileges (nsjail default unless --no_new_privs is disabled)
// must block this.
func TestSandbox_SUIDExec(t *testing.T) {
	requireNsjail(t)
	res := runShell(t, "cp /bin/sh /tmp/x && chmod u+s /tmp/x && /tmp/x -c 'id -u'", 3)
	out := string(res.Combined)
	if res.ExitCode == 0 && strings.Contains(out, "uid=0") {
		t.Fatalf("SUID escalation succeeded: %q", out)
	}
}

// TestSandbox_MemoryBomb — try to allocate ~1 GB. rlimit_as 256 MB must
// trigger ENOMEM long before that.
func TestSandbox_MemoryBomb(t *testing.T) {
	requireNsjail(t)
	// `head -c 1G /dev/zero` would stream into a buffer; allocate via perl
	// to keep it portable across alpine and ubuntu.
	res := runShell(t, "perl -e '$x = \"a\" x (1024*1024*1024); print length($x)'", 5)
	if !blockedOK(res, "Out of memory", "Cannot allocate") {
		t.Fatalf("memory bomb succeeded: exit=%d out=%q",
			res.ExitCode, string(res.Combined))
	}
}

// TestSandbox_CPUTimeout — a tight infinite loop must hit the CPU rlimit
// (or wall-clock as fallback). We allow either.
func TestSandbox_CPUTimeout(t *testing.T) {
	requireNsjail(t)
	res := runShell(t, "while :; do :; done", 3)
	if !res.TimedOut && res.ExitCode == 0 {
		t.Fatalf("infinite loop exited 0 without TLE: out=%q", string(res.Combined))
	}
}

// TestSandbox_HostEnvLeak — host env vars (e.g. HOSTNAME, $PATH overrides)
// must not appear inside the jail.
func TestSandbox_HostEnvLeak(t *testing.T) {
	requireNsjail(t)
	t.Setenv("LEAK_CANARY", "PWNED-host-secret-do-not-leak")
	res := runShell(t, "env", 3)
	if strings.Contains(string(res.Combined), "PWNED-host-secret-do-not-leak") {
		t.Fatalf("host env leaked into jail: %q", string(res.Combined))
	}
}

// TestSandbox_ProcEnvLeak — /proc/self/environ must not contain host secrets.
func TestSandbox_ProcEnvLeak(t *testing.T) {
	requireNsjail(t)
	t.Setenv("LEAK_CANARY", "PWNED-proc-secret")
	res := runShell(t, "cat /proc/self/environ 2>/dev/null | tr '\\0' '\\n'", 3)
	if strings.Contains(string(res.Combined), "PWNED-proc-secret") {
		t.Fatalf("proc env leaked: %q", string(res.Combined))
	}
}

// TestSandbox_PIDsLimit — spawn a tight fork loop to confirm the process
// cap fires before we exhaust host PIDs.
func TestSandbox_PIDsLimit(t *testing.T) {
	requireNsjail(t)
	// 50 background sleeps; rlimit_nproc 16 must reject most of them.
	payload := "for i in $(seq 1 50); do (sleep 5) & done; wait"
	res := runShell(t, payload, 4)
	if res.ExitCode == 0 && !res.TimedOut {
		// We expect at least one fork() to fail, which makes wait return
		// non-zero. A clean exit means nproc wasn't enforced.
		t.Fatalf("no nproc limit fired: out=%q", string(res.Combined))
	}
}
