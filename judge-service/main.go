package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/leetrank/judge-service/internal/observability"
	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog"
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
	Passed  bool   `json:"passed"`
	Input   string `json:"input"`
	Expected string `json:"expected"`
	Actual  string `json:"actual"`
	Runtime int    `json:"runtime"` // milliseconds
	Error   string `json:"error,omitempty"`
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
		"from 'child_process'", `from "child_process"`,
		"from 'fs'", `from "fs"`,
		"from 'net'", `from "net"`,
		"process.exit", "process.env", "process.binding",
		"__dirname", "__filename",
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
	"c": {
		"#include <unistd.h>", "#include <sys/socket.h>", "#include <netdb.h>",
		"system(", "popen(", "fork(", "execve(", "execl(",
		"socket(", "connect(", "fopen(/etc", "fopen(\"/etc",
	},
	"cpp": {
		"#include <unistd.h>", "#include <sys/socket.h>", "#include <netdb.h>",
		"std::system", "system(", "popen(", "fork(", "execve(", "execl(",
		"socket(", "connect(", "std::ifstream(\"/etc",
	},
	"rust": {
		"std::process::Command", "std::process::exit", "std::net::",
		"std::fs::", "std::os::unix",
		"unsafe ", "unsafe{",
		"extern ", "asm!",
	},
	"java": {
		"Runtime.getRuntime", "ProcessBuilder", "System.exit",
		"java.net.", "java.io.File", "java.io.FileWriter",
		"java.io.FileOutputStream", "java.lang.reflect.",
		"sun.misc.Unsafe", "Class.forName",
	},
	"php": {
		"system(", "exec(", "shell_exec(", "passthru(", "popen(",
		"proc_open(", "fopen(", "file_get_contents(/etc",
		"file_get_contents(\"/etc", "eval(", "assert(",
		"include ", "require ", "include_once", "require_once",
	},
	"bash": {
		"rm -rf", ">/dev/", "</dev/tcp", "curl ", "wget ", "nc ", "ncat ",
		"/etc/passwd", "/etc/shadow", "$(curl", "$(wget",
		"chmod +x /", "ssh ", "scp ",
	},
	"sql": {
		"attach database", "load_extension", "pragma ",
		".system", ".shell", ".import", "vacuum into",
		"create virtual table", "writefile",
	},
	"kotlin": {
		"Runtime.getRuntime", "ProcessBuilder", "System.exit",
		"kotlin.system.exitProcess", "java.io.File", "java.net.",
		"java.io.FileWriter", "java.io.FileOutputStream",
		"java.lang.reflect.", "sun.misc.Unsafe", "Class.forName",
	},
	"csharp": {
		"System.Diagnostics.Process", "System.IO.File", "System.IO.Directory",
		"System.Net.", "Environment.Exit", "System.Reflection.",
		"Assembly.Load", "System.Runtime.InteropServices",
	},
	"r": {
		"system(", "system2(", "Sys.getenv", "file.remove", "unlink(",
		"readLines(", "writeLines(", "download.file(", "url(",
		"socketConnection(", "pipe(", "fifo(",
	},
	"lua": {
		`os.execute`, `os.remove`, `io.open`, `loadfile`, `dofile`,
		`require("io")`, `require'io'`, `require("os")`, `require'os'`,
		`require("socket")`, `require'socket'`,
	},
	"perl": {
		"system(", "exec(", "qx{", "qx/", "open(",
		"unlink ", "unlink(", "`",
	},
	"scala": {
		"sys.process.", "Runtime.getRuntime", "java.io.File", "java.net.",
		"scala.sys.process", "System.exit", "ProcessBuilder",
		"java.lang.reflect.", "Class.forName",
	},
	"elixir": {
		"System.cmd", ":os.cmd", "File.rm", "File.write", "Port.open",
		":file.", ":gen_tcp", ":httpc", "System.halt",
	},
	"d": {
		"import std.process", "import std.socket", "import std.file",
		"executeShell", "spawnProcess", "spawnShell",
	},
	"pascal": {
		"uses Process", "uses Sockets", "ExecuteProcess",
		"FpExec", "fpExecve", "fpFork", "fpSocket",
	},
	"nim": {
		"import os", "import osproc", "import net", "import nativesockets",
		"execShellCmd", "execProcess", "startProcess", "writeFile",
	},
	"fortran": {
		"call system", "call execute_command_line", "open(unit=",
	},
	"groovy": {
		".execute()", "Runtime.getRuntime", "ProcessBuilder",
		"java.io.File", "java.net.", "System.exit",
	},
	"clojure": {
		"(sh ", "(clojure.java.shell/sh", "(java.lang.Runtime",
		"(.exec", "(System/exit", "java.io.File", "java.net.",
	},
	"haskell": {
		"System.Process", "System.IO", "System.Directory", "Network.",
		"Foreign.", "unsafePerformIO", "unsafeCoerce",
	},
	"ocaml": {
		"Unix.system", "Unix.execv", "Unix.fork", "Unix.socket",
		"Sys.command", "open_process", "Stdlib.exit",
	},
	"racket": {
		"(system ", "(process ", "(subprocess ", "(open-input-file",
		"(open-output-file", "(file-exists? \"/etc",
	},
	"sbcl": {
		"(sb-ext:run-program", "(sb-ext:exit", "(sb-ext:quit",
		"(uiop:run-program", "(open ", "(with-open-file",
		"sb-bsd-sockets", "sb-posix:",
	},
	"erlang": {
		"os:cmd", "erlang:halt", "file:delete", "file:write_file",
		"gen_tcp:", "ssh:", "httpc:",
	},
	"fsharp": {
		"System.Diagnostics.Process", "System.IO.File", "System.IO.Directory",
		"System.Net.", "Environment.Exit", "Assembly.Load",
	},
	"julia": {
		"run(", "Cmd(", "readchomp(", "ENV[",
		"download(", "open(", "rm(",
	},
	"tcl": {
		"exec ", "open |", "socket ", "file delete", "puts -nonewline ",
	},
	"awk": {
		"system(", "getline cmd", "| getline", "close(",
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
	rateLimitRequests = 30              // max requests per window
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
	sched      *scheduler
	runnersDir string
	languages  *LanguageRegistry
	logger     zerolog.Logger
}

func newServer(logger zerolog.Logger) *server {
	// Runners live next to the binary.
	exe, err := os.Executable()
	runnersDir := "runners"
	baseDir := "."
	if err == nil {
		baseDir = filepath.Dir(exe)
		runnersDir = filepath.Join(baseDir, "runners")
	}

	cfg := defaultConcurrency
	if v := envInt("JUDGE_GLOBAL_MAX", 0); v > 0 {
		cfg.GlobalMax = v
	}
	if v := envInt("JUDGE_PER_IP_MAX", 0); v > 0 {
		cfg.PerIPMax = v
	}
	if v := envInt("JUDGE_QUEUE_WAIT_MS", 0); v > 0 {
		cfg.QueueWait = time.Duration(v) * time.Millisecond
	}

	// languages.json sits next to the binary in the production image. In
	// dev we fall back to the working directory so `go run .` works from
	// judge-service/.
	langPath := filepath.Join(baseDir, "languages.json")
	if _, statErr := os.Stat(langPath); statErr != nil {
		langPath = "languages.json"
	}
	registry, regErr := loadLanguageRegistry(langPath)
	if regErr != nil {
		logger.Fatal().Err(regErr).Str("path", langPath).Msg("loadLanguageRegistry")
	}
	logger.Info().Int("count", len(registry.IDs())).Strs("languages", registry.IDs()).Msg("languages loaded")

	return &server{
		rl:         newRateLimiter(),
		sched:      newScheduler(cfg),
		runnersDir: runnersDir,
		languages:  registry,
		logger:     logger,
	}
}

func envInt(name string, fallback int) int {
	v := os.Getenv(name)
	if v == "" {
		return fallback
	}
	n := 0
	for _, c := range v {
		if c < '0' || c > '9' {
			return fallback
		}
		n = n*10 + int(c-'0')
	}
	return n
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

func loggingMiddleware(logger zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)
			route := r.URL.Path
			if route == "" {
				route = "/"
			}
			status := strconv.Itoa(rec.status)
			judgeRequestsTotal.WithLabelValues(r.Method, route, status).Inc()
			judgeRequestDuration.WithLabelValues(r.Method, route, status).Observe(time.Since(start).Seconds())
			logger.Info().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Int("status", rec.status).
				Int64("duration_ms", time.Since(start).Milliseconds()).
				Msg("http_request")
		})
	}
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

var (
	judgeRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total HTTP requests handled by leetrank-judge.",
		},
		[]string{"method", "route", "status"},
	)
	judgeRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "End-to-end HTTP latency in seconds.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "route", "status"},
	)
	judgeExecutionsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "judge_executions_total",
			Help: "Code executions by language and final status.",
		},
		[]string{"language", "status"},
	)
)

func init() {
	prometheus.MustRegister(judgeRequestsTotal, judgeRequestDuration, judgeExecutionsTotal)
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

func (s *server) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":     "ok",
		"service":    "leetrank-judge",
		"time":       time.Now().UTC().Format(time.RFC3339),
		"scheduler":  s.sched.snapshot(),
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
	if _, ok := s.languages.Get(req.Language); !ok {
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

	// Bound concurrency: refuse fast if the system is saturated rather
	// than letting the kernel page-in another runner process.
	acquireCtx, acquireCancel := context.WithCancel(r.Context())
	defer acquireCancel()
	release, err := s.sched.Acquire(acquireCtx, ip)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, ExecuteResponse{
			Status:  "busy",
			Results: []TestResult{{Error: err.Error()}},
		})
		return
	}
	defer release()

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

	// Wrapper-runner languages (python/javascript/ruby) get sandboxed via
	// their dedicated scripts under judge-service/runners/. Those scripts
	// apply per-process setrlimit (memory/CPU/file-descriptor caps) we
	// don't want to lose. Everything else — go, c, cpp, rust, java, php,
	// bash, sql, typescript — routes through the generic registry-driven
	// executor which compiles (when applicable) and runs the user code
	// directly.
	if language != "python" && language != "javascript" && language != "ruby" {
		lc, ok := s.languages.Get(language)
		if !ok {
			return errorResult(tc, "Unsupported language: "+language, start)
		}
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeLimitMs)*time.Millisecond)
		defer cancel()
		return s.executeFromConfig(ctx, lc, code, tc, timeLimitMs)
	}

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

	var argv []string

	switch language {
	case "python":
		runner := filepath.Join(s.runnersDir, "python_runner.py")
		argv = []string{"python3", runner, tmpPath}
	case "javascript":
		runner := filepath.Join(s.runnersDir, "js_runner.js")
		argv = []string{"node", runner, tmpPath}
	case "ruby":
		runner := filepath.Join(s.runnersDir, "ruby_runner.rb")
		argv = []string{"ruby", runner, tmpPath}
	default:
		// Unreachable: the early-return above sends every non-wrapper
		// language through executeFromConfig.
		return errorResult(tc, "Internal: unreachable wrapper switch for "+language, start)
	}

	// Even though the wrapper scripts apply per-process setrlimit, we still
	// run them under nsjail. The wrapper's setrlimit only protects the user
	// child it spawns; nsjail protects against the wrapper itself escaping
	// (e.g. a malicious payload that pivots through the wrapper before
	// hitting setrlimit). Wrapper output is JSON on stdout — the bytes we
	// receive are identical to what cmd.CombinedOutput would have returned.
	rawOut, _, timedOut, execErr := SandboxedCombinedOutput(
		ctx,
		filepath.Dir(tmpPath),
		argv,
		[]byte(tc.Input),
		SandboxLimits{
			MemMB:       DefaultSandboxLimits.MemMB,
			CPUSeconds:  cpuSecondsFor(timeLimitMs),
			WallSeconds: wallSecondsFor(timeLimitMs),
		},
	)
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

	// Runners return JSON; fall back to raw output if parsing fails.
	var out runnerOutput
	if jsonErr := json.Unmarshal(rawOut, &out); jsonErr != nil {
		// Runner itself crashed — treat raw output as error.
		errMsg := strings.TrimSpace(string(rawOut))
		if execErr != nil {
			errMsg = execErr.Error() + ": " + errMsg
		}
		return TestResult{
			Passed:  false,
			Input:   tc.Input,
			Expected: tc.Expected,
			Runtime: runtime,
			Error:   errMsg,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

// extensionFor returns the file extension used for the wrapper-runner
// path. Non-wrapper languages don't reach this — they go through the
// registry-driven executeFromConfig and pull the extension off the
// LanguageConfig directly.
func extensionFor(language string) string {
	switch language {
	case "python":
		return ".py"
	case "javascript":
		return ".js"
	case "ruby":
		return ".rb"
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
		// Best effort — connection may already be torn down.
		_ = err
	}
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	port := os.Getenv("JUDGE_PORT")
	if port == "" {
		port = "9090"
	}

	logger := observability.NewLogger("leetrank-judge", os.Getenv("LOG_LEVEL"), os.Getenv("LOG_PRETTY") == "1")

	// Surface the sandbox enforcement mode in logs at boot — operators
	// must be able to confirm at a glance that nsjail is active.
	LogSandboxStartup()

	shutdownTracer, err := observability.InitTracer(context.Background(), "leetrank-judge", os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"), os.Getenv("JUDGE_VERSION"))
	if err != nil {
		logger.Warn().Err(err).Msg("otel: tracer disabled")
	}
	defer func() {
		if shutdownTracer != nil {
			_ = shutdownTracer(context.Background())
		}
	}()

	srv := newServer(logger)

	r := mux.NewRouter()
	r.Use(corsMiddleware)
	r.Use(loggingMiddleware(logger))
	r.Use(observability.OtelMiddleware("leetrank-judge"))

	r.HandleFunc("/health", srv.healthHandler).Methods(http.MethodGet, http.MethodOptions)
	r.HandleFunc("/healthz", srv.healthHandler).Methods(http.MethodGet, http.MethodOptions)
	r.Handle("/metrics", promhttp.Handler()).Methods(http.MethodGet)
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
		logger.Info().Str("port", port).Msg("judge service listening")
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal().Err(err).Msg("ListenAndServe failed")
		}
	}()

	<-quit
	logger.Info().Msg("shutting down judge service")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := httpSrv.Shutdown(ctx); err != nil {
		logger.Fatal().Err(err).Msg("graceful shutdown failed")
	}
	logger.Info().Msg("judge service stopped")
}
