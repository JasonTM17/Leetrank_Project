#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
/**
 * js_runner.js — safe JavaScript code executor for LeetRank judge service.
 *
 * Usage:
 *   node js_runner.js <code_file_path>
 *   (test-case input is read from stdin)
 *
 * Output (stdout):
 *   JSON: {"output":"...","error":"...","timed_out":false}
 */

"use strict";

const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TIMEOUT_MS = parseInt(process.env.RUNNER_TIMEOUT || "5", 10) * 1000;

function result({ output = "", error = "", timed_out = false } = {}) {
  process.stdout.write(JSON.stringify({ output, error, timed_out }) + "\n");
}

function main() {
  const codeFile = process.argv[2];
  if (!codeFile) {
    result({ error: "Usage: node js_runner.js <code_file>" });
    return;
  }

  if (!fs.existsSync(codeFile)) {
    result({ error: `Code file not found: ${codeFile}` });
    return;
  }

  // Read stdin before spawning child (fd 0 works across all environments).
  let stdinData = Buffer.alloc(0);
  try {
    stdinData = fs.readFileSync(0);
  } catch (_) {
    // stdin may not be available in all environments; that's fine.
  }

  // Wrap the user code in a sandboxed IIFE that captures console.log output.
  // We run it in a separate Node process so it gets its own memory space and
  // can be killed cleanly on timeout.
  //
  // Two stdin patterns must work:
  //   1. Sync: global.readline() / global.input()
  //   2. Async: process.stdin.on('data'/'end', ...) — common in competitive programming
  //
  // Strategy: read stdin into a buffer, provide it via readline() AND replay it
  // through a replacement process.stdin Readable. Use 'beforeExit' to wait for
  // async handlers before flushing captured output.
  const wrapperCode = `
'use strict';
const { Readable } = require('stream');

// ── Read all stdin synchronously ──────────────────────────────────────────
const _stdinBuf = require('fs').readFileSync(0, 'utf8');

// ── Sync readline interface ───────────────────────────────────────────────
const _inputLines = _stdinBuf.split('\\n');
let _inputIdx = 0;
global.readline = () => _inputLines[_inputIdx++] || '';
global.input = global.readline;

// ── Replace process.stdin with a Readable that replays the buffer ─────────
// This allows async patterns (process.stdin.on('data'/'end')) to work.
const _fakeStdin = new Readable({ read() { this.push(_stdinBuf); this.push(null); } });
_fakeStdin.setEncoding('utf8');
Object.defineProperty(process, 'stdin', { value: _fakeStdin, writable: true, configurable: true });

// ── Capture console.log output ────────────────────────────────────────────
const _lines = [];
console.log = (...args) => {
  _lines.push(args.map(String).join(' '));
};
console.error = (...args) => {
  process.stderr.write(args.map(String).join(' ') + '\\n');
};

// ── Track whether output was already flushed ──────────────────────────────
let _flushed = false;
function _flush() {
  if (_flushed) return;
  _flushed = true;
  process.stdout.write(_lines.join('\\n') + (_lines.length ? '\\n' : ''));
}

try {
  ${fs.readFileSync(codeFile, "utf8")}
} catch (e) {
  process.stderr.write(e.stack || e.message);
  process.exit(1);
}

// Flush on beforeExit — fires after all async work (stdin events) completes.
process.on('beforeExit', _flush);
`;

  // Write wrapper to a temp file so we can pass it to a child node process.
  const tmpWrapper = codeFile + ".wrapped.js";
  try {
    fs.writeFileSync(tmpWrapper, wrapperCode, "utf8");
  } catch (e) {
    result({ error: `Runner setup error: ${e.message}` });
    return;
  }

  let proc;
  try {
    proc = spawnSync(process.execPath, [tmpWrapper], {
      input: stdinData,
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024, // 1 MB output cap
      encoding: "buffer",
    });
  } catch (e) {
    fs.unlinkSync(tmpWrapper);
    result({ error: `Runner error: ${e.message}` });
    return;
  }

  try {
    fs.unlinkSync(tmpWrapper);
  } catch (_) {}

  if (proc.signal === "SIGTERM" || proc.error?.code === "ETIMEDOUT") {
    result({ timed_out: true });
    return;
  }

  const stdout = (proc.stdout || Buffer.alloc(0)).toString("utf8");
  const stderr = (proc.stderr || Buffer.alloc(0)).toString("utf8");

  if (proc.status !== 0) {
    const lines = stderr.trim().split("\n");
    const trimmed = lines.length > 10 ? lines.slice(-10).join("\n") : stderr.trim();
    result({ output: stdout, error: trimmed });
  } else {
    result({ output: stdout });
  }
}

main();
