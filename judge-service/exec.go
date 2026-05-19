package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// executeFromConfig runs a single test case under a registry-driven language
// config. It supports both interpreted languages (compileCmd nil) and
// compiled languages (compileCmd populated). Used as the generic fallback
// for every language that doesn't have a wrapper runner; the python/ruby/
// javascript wrappers stay on their dedicated paths because they apply
// per-process setrlimit guards we don't want to lose.
//
// Output capture is raw stdout (trimmed) — matches the Go path behaviour
// from the original executeGo.
func (s *server) executeFromConfig(ctx context.Context, lc LanguageConfig, code string, tc TestCase, timeLimitMs int) TestResult {
	start := time.Now()

	workdir, err := os.MkdirTemp("", "judge_"+lc.ID+"_*")
	if err != nil {
		return errorResult(tc, "Failed to create workdir: "+err.Error(), start)
	}
	defer os.RemoveAll(workdir)

	// Java is special: filename must equal the public class name.
	srcName := "main" + lc.Extension
	if lc.MainClass != "" {
		srcName = lc.MainClass + lc.Extension
	}
	srcPath := filepath.Join(workdir, srcName)
	binPath := filepath.Join(workdir, "solution")

	if err := os.WriteFile(srcPath, []byte(code), 0o644); err != nil {
		return errorResult(tc, "Failed to write source: "+err.Error(), start)
	}

	ectx := execContext{Workdir: workdir, SrcPath: srcPath, BinPath: binPath}

	// Compile step (compiled languages only).
	if len(lc.CompileCmd) > 0 {
		compileCtx, compileCancel := context.WithTimeout(ctx, 15*time.Second)
		defer compileCancel()

		argv := expandPlaceholders(lc.CompileCmd, ectx)
		if len(argv) == 0 {
			return errorResult(tc, fmt.Sprintf("Empty compileCmd for %s", lc.ID), start)
		}
		// Compile under the sandbox too — toolchains have historically
		// shipped CVEs that let crafted source escape into RCE during
		// the compile pass (see go-1.18 -toolexec, gcc -plugin, etc.).
		// Compile gets a slightly higher mem cap because gcc/javac/scalac
		// hit several hundred MB easily.
		out, exitCode, timedOut, cerr := SandboxedCombinedOutput(compileCtx, workdir, argv, nil, SandboxLimits{
			MemMB:        512,
			CPUSeconds:   15,
			WallSeconds:  15,
			MaxProcesses: 32,
			MaxOpenFiles: 256,
			MaxFileMB:    64,
		})
		if timedOut || compileCtx.Err() == context.DeadlineExceeded {
			return TestResult{
				Passed:   false,
				Input:    tc.Input,
				Expected: tc.Expected,
				Runtime:  int(time.Since(start).Milliseconds()),
				Error:    "Compilation Time Limit Exceeded",
			}
		}
		if cerr != nil || exitCode != 0 {
			msg := strings.TrimSpace(string(out))
			if cerr != nil && msg == "" {
				msg = cerr.Error()
			}
			return TestResult{
				Passed:   false,
				Input:    tc.Input,
				Expected: tc.Expected,
				Runtime:  int(time.Since(start).Milliseconds()),
				Error:    "Compilation error: " + msg,
			}
		}
	}

	// Run step.
	runArgv := expandPlaceholders(lc.RunCmd, ectx)
	if len(runArgv) == 0 {
		return errorResult(tc, fmt.Sprintf("Empty runCmd for %s", lc.ID), start)
	}
	output, exitCode, timedOut, runErr := SandboxedCombinedOutput(ctx, workdir, runArgv, []byte(tc.Input), limitsForLang(lc.ID, timeLimitMs))
	runtime := int(time.Since(start).Milliseconds())

	if timedOut || ctx.Err() == context.DeadlineExceeded {
		return TestResult{
			Passed:   false,
			Input:    tc.Input,
			Expected: tc.Expected,
			Runtime:  runtime,
			Error:    "Time Limit Exceeded",
		}
	}

	if runErr != nil {
		return TestResult{
			Passed:   false,
			Input:    tc.Input,
			Expected: tc.Expected,
			Actual:   strings.TrimSpace(string(output)),
			Runtime:  runtime,
			Error:    runErr.Error(),
		}
	}

	if exitCode != 0 {
		return TestResult{
			Passed:   false,
			Input:    tc.Input,
			Expected: tc.Expected,
			Actual:   strings.TrimSpace(string(output)),
			Runtime:  runtime,
			Error:    fmt.Sprintf("Runtime error (exit %d): %s", exitCode, strings.TrimSpace(string(output))),
		}
	}

	actual := strings.TrimSpace(string(output))
	expected := strings.TrimSpace(tc.Expected)
	return TestResult{
		Passed:   actual == expected,
		Input:    tc.Input,
		Expected: tc.Expected,
		Actual:   actual,
		Runtime:  runtime,
	}
}

// fileExists is a small convenience used by the compile step to detect
// silent compile failures where the toolchain printed nothing but did not
// produce a binary.
func fileExists(p string) bool {
	if p == "" {
		return false
	}
	_, err := os.Stat(p)
	return err == nil
}

// limitMBFor returns the per-language memory cap. Compiled JVM languages
// (java, kotlin, scala, groovy, clojure) need extra headroom for the JIT;
// everything else uses the default. Retained for callers that haven't yet
// been migrated to limitsForLang.
func limitMBFor(lc LanguageConfig, _ int) int {
	switch lc.ID {
	case "java", "kotlin", "scala", "groovy", "clojure":
		return 512
	}
	return DefaultSandboxLimits.MemMB
}

// limitsForLang returns the SandboxLimits for a language id, sourcing
// MemMB/CPUSeconds/WallSeconds from profiles.json (with the registry's
// default applied for unlisted languages) and bounding CPU/Wall against
// the request-level timeLimitMs so a small per-request budget can never
// exceed what profiles.json grants.
func limitsForLang(langID string, timeLimitMs int) SandboxLimits {
	p := CurrentProfiles().Lookup(langID)
	cpu := p.CPUSeconds
	wall := p.WallSeconds
	// Honour an explicit per-request budget when it's smaller than the
	// profile cap. timeLimitMs of 0 means "use profile defaults".
	if timeLimitMs > 0 {
		reqCPU := timeLimitMs/1000 + 1
		if reqCPU > 0 && reqCPU < cpu {
			cpu = reqCPU
		}
		reqWall := (timeLimitMs + 999) / 1000
		if reqWall > 0 && reqWall < wall {
			wall = reqWall
		}
	}
	if cpu < 1 {
		cpu = 1
	}
	if wall < cpu {
		wall = cpu + 1
	}
	return SandboxLimits{
		MemMB:       p.MemMB,
		CPUSeconds:  cpu,
		WallSeconds: wall,
	}
}

// cpuSecondsFor maps the request-level timeLimit (ms) to a CPU-seconds cap.
// We add 1s of slack so the wall-clock limit is the one that fires for
// genuine TLE (CPU rlimit kills with SIGKILL, harder to surface as TLE).
func cpuSecondsFor(timeLimitMs int) int {
	s := timeLimitMs/1000 + 1
	if s < DefaultSandboxLimits.CPUSeconds {
		return DefaultSandboxLimits.CPUSeconds
	}
	if s > 30 {
		return 30
	}
	return s
}

// wallSecondsFor mirrors the request timeLimit but is bounded to keep nsjail
// from outliving the Go context for too long if the kernel lags on signal.
func wallSecondsFor(timeLimitMs int) int {
	s := (timeLimitMs + 999) / 1000
	if s < DefaultSandboxLimits.WallSeconds {
		return DefaultSandboxLimits.WallSeconds
	}
	if s > 30 {
		return 30
	}
	return s
}
