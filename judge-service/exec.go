package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
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
		cc := exec.CommandContext(compileCtx, argv[0], argv[1:]...)
		cc.Dir = workdir
		out, cerr := cc.CombinedOutput()
		if compileCtx.Err() == context.DeadlineExceeded {
			return TestResult{
				Passed:   false,
				Input:    tc.Input,
				Expected: tc.Expected,
				Runtime:  int(time.Since(start).Milliseconds()),
				Error:    "Compilation Time Limit Exceeded",
			}
		}
		if cerr != nil {
			return TestResult{
				Passed:   false,
				Input:    tc.Input,
				Expected: tc.Expected,
				Runtime:  int(time.Since(start).Milliseconds()),
				Error:    "Compilation error: " + strings.TrimSpace(string(out)),
			}
		}
	}

	// Run step.
	runArgv := expandPlaceholders(lc.RunCmd, ectx)
	if len(runArgv) == 0 {
		return errorResult(tc, fmt.Sprintf("Empty runCmd for %s", lc.ID), start)
	}
	rc := exec.CommandContext(ctx, runArgv[0], runArgv[1:]...)
	rc.Dir = workdir
	rc.Stdin = strings.NewReader(tc.Input)
	output, runErr := rc.CombinedOutput()
	runtime := int(time.Since(start).Milliseconds())

	if ctx.Err() == context.DeadlineExceeded {
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
