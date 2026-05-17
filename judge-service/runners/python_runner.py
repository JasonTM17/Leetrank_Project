#!/usr/bin/env python3
"""
python_runner.py — safe Python code executor for LeetRank judge service.

Usage:
    python3 python_runner.py <code_file_path>
    (test-case input is read from stdin)

Output (stdout):
    JSON: {"output": "...", "error": "...", "timed_out": false}
"""

import json
import os
import resource
import signal
import subprocess
import sys
import tempfile


# ── Configuration ─────────────────────────────────────────────────────────────

TIMEOUT_SECONDS = int(os.environ.get("RUNNER_TIMEOUT", "5"))
MEMORY_LIMIT_MB = int(os.environ.get("RUNNER_MEMORY_MB", "128"))


# ── Helpers ───────────────────────────────────────────────────────────────────

def result(output: str = "", error: str = "", timed_out: bool = False) -> None:
    """Print JSON result and exit."""
    print(json.dumps({"output": output, "error": error, "timed_out": timed_out}))
    sys.stdout.flush()


def set_resource_limits() -> None:
    """Apply memory and CPU limits inside the child process."""
    mem_bytes = MEMORY_LIMIT_MB * 1024 * 1024
    # Virtual memory limit.
    resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
    # CPU time limit (seconds).
    resource.setrlimit(resource.RLIMIT_CPU, (TIMEOUT_SECONDS, TIMEOUT_SECONDS))
    # No new files (prevent writing to disk).
    resource.setrlimit(resource.RLIMIT_NOFILE, (16, 16))


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 2:
        result(error="Usage: python_runner.py <code_file>")
        return

    code_file = sys.argv[1]
    if not os.path.isfile(code_file):
        result(error=f"Code file not found: {code_file}")
        return

    # Read stdin (test-case input) before forking so the child inherits it.
    stdin_data = sys.stdin.buffer.read()

    try:
        proc = subprocess.run(
            [sys.executable, code_file],
            input=stdin_data,
            capture_output=True,
            timeout=TIMEOUT_SECONDS,
            preexec_fn=set_resource_limits,
        )
    except subprocess.TimeoutExpired:
        result(timed_out=True)
        return
    except MemoryError:
        result(error="Memory Limit Exceeded")
        return
    except Exception as exc:
        result(error=f"Runner error: {exc}")
        return

    stdout = proc.stdout.decode("utf-8", errors="replace")
    stderr = proc.stderr.decode("utf-8", errors="replace")

    if proc.returncode != 0:
        # Trim long tracebacks to the last 10 lines.
        lines = stderr.strip().splitlines()
        trimmed = "\n".join(lines[-10:]) if len(lines) > 10 else stderr.strip()
        result(output=stdout, error=trimmed)
    else:
        result(output=stdout)


if __name__ == "__main__":
    main()
