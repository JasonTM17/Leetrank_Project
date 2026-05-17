package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/mux"
)

// ─── Request / Response types ────────────────────────────────────────────────

type ExecuteRequest struct {
	Code      string     `json:"code"`
	Language  string     `json:"language"`
	TestCases []TestCase `json:"testCases"`
	TimeLimit int        `json:"timeLimit"` // milliseconds; 0 → default
}

type TestCase struct {
	Input    string `json:"input"`
	Expected string `json:"expected"`
}

type TestResult struct {
	Passed   bool   `json:"passed"`
	Input    string `json:"input"`
	Expected string `json:"expected"`
	Actual   string `json:"actual"`
	Runtime  int    `json:"runtime"` // milliseconds
	Error    string `json:"error,omitempty"`
}

type ExecuteResponse struct {
	Results []TestResult `json:"results"`
	Status  string       `json:"status"` // accepted | wrong_answer | runtime_error | time_limit_exceeded | security_error
}

// runnerOutput is the JSON schema returned by each runner script.
type runnerOutput struct {
	Output   string `json:"output"`
	Error    string `json:"error"`
	TimedOut bool   `json:"timed_out"`
}

// ─── Security: per-language dangerous patterns ───────────────────────────────

var dangerousPatterns = map[string][]string{
	"python": {
		"import os", "import sys", "import subprocess", "import shutil",
		"import socket", "import ctypes", "import importlib",
		"__import__", "__builtins__", "open(", "eval(", "exec(",
		"compile(", "globals(", "locals(", "vars(",
	},
	"javascript": {
		"require('child_process')", `require("child_process")`,
		"require('fs')", `require("fs")`,
		"require('net')", `require("net")`,
		"process.exit", "process.env", "process.binding",
		"__dirname", "__filename",
		"globalThis.process",
	},
	"typescript": {
		"require('child_process')", `require("child_process")`,
		"require('fs')", `require("fs")`,
		"require('net')", `require("net")`,
		"process.exit", "process.env", "process.binding",
		"__dirname", "__filename",
		"globalThis.process",
	},
	"ruby": {
		"require 'open3'", `require "open3"`,
		"require 'fileutils'", `require "fileutils"`,
		"system(", "`", "exec(", "spawn(",
		"File.delete", "FileUtils.rm", "IO.popen",
		"Kernel.system", "Open3",
	},
	"go": {
		`"os/exec"`, `"syscall"`, `"net"`, `"net/http"`,
		`"os"`, `"io/ioutil"`, `"bufio"`,
		"os.Remove", "os.Exit", "syscall.",
	},
	"php": {
		"exec(", "shell_exec(", "system(", "passthru(", "popen(",
		"proc_open(", "pcntl_exec(", "file_get_contents(", "file_put_contents(",
		"fopen(", "unlink(", "rmdir(", "mkdir(",
	},
}

func isSafe(code, language string) bool {
	patterns, ok := dangerousPatterns[language]
	if !ok {
		return true
	}
	lower := strings.ToLower(code)
	for _, p := range patterns {
		if strings.Contains(lower, strings.ToLower(p)) {
			return false
		}
	}
	return true
}

// ─── Simple in-memory rate limiter ───────────────────────────────────────────

const (
	rateLimitRequests = 30               // max requests per window
	rateLimitWindow   = 60 * time.Second // per IP
)

type ipRecord struct {
	count     int
	windowEnd time.Time
}

type rateLimiter struct {
	mu      sync.Mutex
	records map[string]*ipRecord
}

func newRateLimiter() *rateLimiter {
	rl := &rateLimiter{records: make(map[string]*ipRecord)}
	// Periodically clean up stale entries.
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			rl.mu.Lock()
			now := time.Now()
			for ip, rec := range rl.records {
				if now.After(rec.windowEnd) {
					delete(rl.records, ip)
				}
			}
			rl.mu.Unlock()
		}
	}()
	return rl
}

// Allow returns true if the request should be allowed.
func (rl *rateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	rec, ok := rl.records[ip]
	if !ok || now.After(rec.windowEnd) {
		rl.records[ip] = &ipRecord{count: 1, windowEnd: now.Add(rateLimitWindow)}
		return true
	}
	if rec.count >= rateLimitRequests {
		return false
	}
	rec.count++
	return true
}

// ─── Server ───────────────────────────────────────────────────────────────────

type server struct {
	rl         *rateLimiter
	runnersDir string
}

func newServer() *server {
	// Runners live next to the binary.
	exe, err := os.Executable()
	runnersDir := "runners"
	if err == nil {
		runnersDir = filepath.Join(filepath.Dir(exe), "runners")
	}
	return &server{
		rl:         newRateLimiter(),
		runnersDir: runnersDir,
	}
}

// ─── Middleware ───────────────────────────────────────────────────────────────

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

func (s *server) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"service": "leetrank-judge",
		"time":    time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *server) executeHandler(w http.ResponseWriter, r *http.Request) {
	// Rate limit by IP.
	ip := r.RemoteAddr
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ip = strings.Split(xff, ",")[0]
	}
	if !s.rl.Allow(ip) {
		writeJSON(w, http.StatusTooManyRequests, ExecuteResponse{
			Status:  "rate_limited",
			Results: []TestResult{{Error: "Too many requests. Please slow down."}},
		})
		return
	}

	var req ExecuteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, ExecuteResponse{
			Status:  "error",
			Results: []TestResult{{Error: "Invalid JSON request body"}},
		})
		return
	}

	req.Language = strings.ToLower(strings.TrimSpace(req.Language))
	supportedLanguages := map[string]bool{
		"python": true, "javascript": true, "ruby": true, "go": true,
		"typescript": true, "php": true,
	}
	if !supportedLanguages[req.Language] {
		writeJSON(w, http.StatusBadRequest, ExecuteResponse{
			Status:  "error",
			Results: []TestResult{{Error: fmt.Sprintf("Unsupported language: %s", req.Language)}},
		})
		return
	}

	if strings.TrimSpace(req.Code) == "" {
		writeJSON(w, http.StatusBadRequest, ExecuteResponse{
			Status:  "error",
			Results: []TestResult{{Error: "Code cannot be empty"}},
		})
		return
	}

	if len(req.TestCases) == 0 {
		writeJSON(w, http.StatusBadRequest, ExecuteResponse{
			Status:  "error",
			Results: []TestResult{{Error: "At least one test case is required"}},
		})
		return
	}

	if len(req.TestCases) > 20 {
		writeJSON(w, http.StatusBadRequest, ExecuteResponse{
			Status:  "error",
			Results: []TestResult{{Error: "Maximum 20 test cases allowed per request"}},
		})
		return
	}

	// Security check.
	if !isSafe(req.Code, req.Language) {
		writeJSON(w, http.StatusOK, ExecuteResponse{
			Status:  "security_error",
			Results: []TestResult{{Passed: false, Error: "Forbidden: dangerous operations detected in code"}},
		})
		return
	}

	timeLimit := req.TimeLimit
	if timeLimit <= 0 || timeLimit > 10000 {
		timeLimit = 5000 // default 5 s
	}

	// Run all test cases concurrently.
	results := s.runConcurrent(req.Code, req.Language, req.TestCases, timeLimit)

	status := "accepted"
	for _, res := range results {
		if !res.Passed {
			if res.Error == "Time Limit Exceeded" {
				status = "time_limit_exceeded"
			} else if res.Error != "" {
				status = "runtime_error"
			} else {
				status = "wrong_answer"
			}
			break
		}
	}

	writeJSON(w, http.StatusOK, ExecuteResponse{Results: results, Status: status})
}

// runConcurrent executes all test cases in parallel and returns results in order.
func (s *server) runConcurrent(code, language string, testCases []TestCase, timeLimitMs int) []TestResult {
	results := make([]TestResult, len(testCases))
	var wg sync.WaitGroup

	for i, tc := range testCases {
		wg.Add(1)
		go func(idx int, tc TestCase) {
			defer wg.Done()
			results[idx] = s.executeTestCase(code, language, tc, timeLimitMs)
		}(i, tc)
	}

	wg.Wait()
	return results
}

// ─── Execution ────────────────────────────────────────────────────────────────

func (s *server) executeTestCase(code, language string, tc TestCase, timeLimitMs int) TestResult {
	start := time.Now()

	// Write code to a temp file.
	ext := extensionFor(language)
	tmpFile, err := os.CreateTemp("", fmt.Sprintf("judge_*%s", ext))
	if err != nil {
		return errorResult(tc, "Failed to create temp file: "+err.Error(), start)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.WriteString(code); err != nil {
		tmpFile.Close()
		return errorResult(tc, "Failed to write code: "+err.Error(), start)
	}
	tmpFile.Close()

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeLimitMs)*time.Millisecond)
	defer cancel()

	var cmd *exec.Cmd

	switch language {
	case "python":
		runner := filepath.Join(s.runnersDir, "python_runner.py")
		cmd = exec.CommandContext(ctx, "python3", runner, tmpPath)
	case "javascript":
		runner := filepath.Join(s.runnersDir, "js_runner.js")
		cmd = exec.CommandContext(ctx, "node", runner, tmpPath)
	case "ruby":
		runner := filepath.Join(s.runnersDir, "ruby_runner.rb")
		cmd = exec.CommandContext(ctx, "ruby", runner, tmpPath)
	case "go":
		return s.executeGo(ctx, code, tc, timeLimitMs, start)
	case "typescript":
		runner := filepath.Join(s.runnersDir, "typescript_runner.sh")
		cmd = exec.CommandContext(ctx, "bash", runner, tmpPath)
	case "php":
		runner := filepath.Join(s.runnersDir, "php_runner.sh")
		cmd = exec.CommandContext(ctx, "bash", runner, tmpPath)
	default:
		return errorResult(tc, "Unsupported language: "+language, start)
	}

	cmd.Stdin = strings.NewReader(tc.Input)
	rawOut, execErr := cmd.CombinedOutput()
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

	// Runners return JSON; fall back to raw output if parsing fails.
	var out runnerOutput
	if jsonErr := json.Unmarshal(rawOut, &out); jsonErr != nil {
		// Runner itself crashed — treat raw output as error.
		errMsg := strings.TrimSpace(string(rawOut))
		if execErr != nil {
			errMsg = execErr.Error() + ": " + errMsg
		}
		return TestResult{
			Passed:   false,
			Input:    tc.Input,
			Expected: tc.Expected,
			Runtime:  runtime,
			Error:    errMsg,
		}
	}

	if out.TimedOut {
		return TestResult{
			Passed:   false,
			Input:    tc.Input,
			Expected: tc.Expected,
			Runtime:  runtime,
			Error:    "Time Limit Exceeded",
		}
	}

	if out.Error != "" {
		return TestResult{
			Passed:   false,
			Input:    tc.Input,
			Expected: tc.Expected,
			Actual:   strings.TrimSpace(out.Output),
			Runtime:  runtime,
			Error:    strings.TrimSpace(out.Error),
		}
	}

	actual := strings.TrimSpace(out.Output)
	expected := strings.TrimSpace(tc.Expected)

	return TestResult{
		Passed:   actual == expected,
		Input:    tc.Input,
		Expected: tc.Expected,
		Actual:   actual,
		Runtime:  runtime,
	}
}

// executeGo compiles and runs Go code in a temp directory.
func (s *server) executeGo(ctx context.Context, code string, tc TestCase, timeLimitMs int, start time.Time) TestResult {
	tmpDir, err := os.MkdirTemp("", "judge_go_*")
	if err != nil {
		return errorResult(tc, "Failed to create temp dir: "+err.Error(), start)
	}
	defer os.RemoveAll(tmpDir)

	srcPath := filepath.Join(tmpDir, "main.go")
	if err := os.WriteFile(srcPath, []byte(code), 0644); err != nil {
		return errorResult(tc, "Failed to write Go source: "+err.Error(), start)
	}

	// Compile.
	compileCtx, compileCancel := context.WithTimeout(ctx, 15*time.Second)
	defer compileCancel()

	binPath := filepath.Join(tmpDir, "solution")
	compileCmd := exec.CommandContext(compileCtx, "go", "build", "-o", binPath, srcPath)
	if compileOut, compileErr := compileCmd.CombinedOutput(); compileErr != nil {
		return TestResult{
			Passed:   false,
			Input:    tc.Input,
			Expected: tc.Expected,
			Runtime:  int(time.Since(start).Milliseconds()),
			Error:    "Compilation error: " + strings.TrimSpace(string(compileOut)),
		}
	}

	// Run.
	runCmd := exec.CommandContext(ctx, binPath)
	runCmd.Stdin = strings.NewReader(tc.Input)
	output, runErr := runCmd.CombinedOutput()
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

func extensionFor(language string) string {
	switch language {
	case "python":
		return ".py"
	case "javascript":
		return ".js"
	case "ruby":
		return ".rb"
	case "go":
		return ".go"
	case "typescript":
		return ".ts"
	case "php":
		return ".php"
	default:
		return ".txt"
	}
}

func errorResult(tc TestCase, msg string, start time.Time) TestResult {
	return TestResult{
		Passed:   false,
		Input:    tc.Input,
		Expected: tc.Expected,
		Runtime:  int(time.Since(start).Milliseconds()),
		Error:    msg,
	}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("writeJSON encode error: %v", err)
	}
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	port := os.Getenv("JUDGE_PORT")
	if port == "" {
		port = "9090"
	}

	srv := newServer()

	r := mux.NewRouter()
	r.Use(corsMiddleware)
	r.Use(loggingMiddleware)

	r.HandleFunc("/health", srv.healthHandler).Methods(http.MethodGet, http.MethodOptions)
	r.HandleFunc("/execute", srv.executeHandler).Methods(http.MethodPost, http.MethodOptions)

	// Legacy alias kept for backward compatibility.
	r.HandleFunc("/run", srv.executeHandler).Methods(http.MethodPost, http.MethodOptions)

	httpSrv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Judge service listening on :%s", port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("ListenAndServe: %v", err)
		}
	}()

	<-quit
	log.Println("Shutting down judge service...")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := httpSrv.Shutdown(ctx); err != nil {
		log.Fatalf("Graceful shutdown failed: %v", err)
	}
	log.Println("Judge service stopped.")
}
