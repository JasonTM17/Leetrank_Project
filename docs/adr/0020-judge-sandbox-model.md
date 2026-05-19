# 20. Judge sandbox model: per-submission nsjail jail

Date: 2026-05-19

## Status

Accepted (rewritten 2026-05-19). Supersedes the original "Docker-per-submission" framing of this ADR. Codifies the runtime contract first sketched in [ADR 0003](0003-go-for-judge-service.md) and constrained in [ADR 0009](0009-judge-concurrency-bounds.md).

## Context

The judge service runs **untrusted user code** for every submission. The threat model is broad: arbitrary code in 30+ languages, including bytecode interpreters and JIT compilers. We need isolation that survives:

- Filesystem escape attempts (`../`, `/etc/passwd`, `chroot`).
- Network egress (data exfiltration, port scanning).
- Resource exhaustion (fork bombs, OOM, infinite loops).
- Persistence (writing to disk to influence later submissions).
- Side-channels into the host or other tenants.
- Privilege escalation via SUID binaries or capability inheritance.

Four sandbox models were evaluated:

1. **Pattern-only blocklist + bare `exec.Command`.** What was running in production until this ADR rewrite. A motivated attacker bypasses it in under an hour. Not a security boundary.
2. **In-process language-level sandboxing** (e.g. Python `seccomp`, Java `SecurityManager`). Per-language complexity; SecurityManager is deprecated in modern JDKs; Python's `seccomp` doesn't help against JIT or `ctypes`. Rejected.
3. **One Docker container per submission.** Spawn a sibling container per `/execute` via the host docker socket. Strong isolation but requires `/var/run/docker.sock` mounted into the judge — a privileged-equivalent trust boundary that can never be safely revoked once granted. Image sprawl and ~150 ms cold-start per submission.
4. **nsjail per submission.** [google/nsjail](https://github.com/google/nsjail) is a process jail built on Linux namespaces, cgroups, seccomp-bpf and capabilities. One short-lived jail per submission, no docker socket exposure, near-zero cold start.

## Decision

Adopt option 4: **nsjail-based per-submission jail**.

Every call site that previously hit `exec.CommandContext` for user code (the registry-driven generic executor in `exec.go`, plus the wrapper-runner switch for python/javascript/ruby in `main.go`) is now routed through `RunSandboxed` in `judge-service/sandbox.go`. The wrapper builds an nsjail invocation of the form:

```
nsjail \
  --mode o \
  --really_quiet \
  --time_limit  <wallSeconds> \
  --rlimit_as   <memMB>      \
  --rlimit_cpu  <cpuSeconds> \
  --rlimit_nproc <nproc>     \
  --rlimit_nofile <nofile>   \
  --rlimit_fsize <fsizeMB>   \
  --user 65534 --group 65534 \
  --disable_clone_newuser    \
  --bindmount_ro /usr --bindmount_ro /bin \
  --bindmount_ro /lib --bindmount_ro /lib64 --bindmount_ro /etc \
  --tmpfsmount /tmp \
  --bindmount  /tmp/judge_<lang>_xyz:/tmp/judge_<lang>_xyz \
  --cwd        /tmp/judge_<lang>_xyz \
  --env PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  --env HOME=/tmp \
  --env LANG=C.UTF-8 \
  -- <userArgv>
```

`--mode o` is "once": run a single command, exit when it exits. Fresh PID, mount, network, IPC and UTS namespaces are nsjail's defaults — the user namespace is disabled because the judge container itself runs as a non-privileged user that can't create new user-namespace mappings.

### Hard limits per submission

| Limit          | Default | Override                              | Enforcer                |
|----------------|---------|---------------------------------------|-------------------------|
| Memory (vmem)  | 256 MB  | per-language (java/kotlin/scala 512)  | `--rlimit_as`           |
| CPU time       | 5 s     | request `timeLimit` (max 30 s)        | `--rlimit_cpu`          |
| Wall clock     | 10 s    | request `timeLimit` (max 30 s)        | `--time_limit` + ctx    |
| Processes      | 16      | not configurable                      | `--rlimit_nproc`        |
| Open files     | 64      | not configurable                      | `--rlimit_nofile`       |
| Single-file sz | 32 MB   | not configurable                      | `--rlimit_fsize`        |
| Network        | none    | not configurable                      | fresh net NS            |
| Filesystem     | ro      | tmpfs `/tmp` + workdir bindmount only | mount NS + bindmount_ro |
| Capabilities   | none    | not configurable                      | nsjail default cap drop |
| User           | 65534   | not configurable                      | `--user 65534`          |

Compile passes (gcc, javac, scalac, etc.) get a slightly higher mem/CPU budget (512 MB / 15 s) because some toolchains spike — but they still run inside the jail. Toolchain CVEs that turn crafted source into RCE during compile (e.g. gcc `-plugin`, go `-toolexec`) are blocked at the namespace boundary, not relied on at the toolchain level.

Concurrency is capped globally by `JUDGE_GLOBAL_MAX` (default 16) and per-IP by `JUDGE_PER_IP_MAX` (default 4). See [ADR 0009](0009-judge-concurrency-bounds.md).

### Threat-model coverage

| Attack                                  | Blocked by                                 |
|-----------------------------------------|--------------------------------------------|
| Forkbomb `:(){ :\|:& };:`               | `rlimit_nproc=16` (most pids exhausted in jail) |
| Network egress (DNS / TCP / curl)       | fresh net NS — no loopback, no routes      |
| Write `/etc/passwd`                     | `--bindmount_ro /etc` (read-only mount)    |
| SUID escalation (`chmod u+s; /bin/sh`)  | `--user 65534` + nsjail no_new_privs default |
| Memory bomb (1 GB allocation)           | `rlimit_as=256m`                           |
| Infinite loop                           | `rlimit_cpu` and/or `--time_limit`         |
| `/proc/self/environ` host-secret leak   | minimal env (`PATH`, `HOME`, `LANG` only)  |
| Side-channel into host filesystem       | mount NS + per-submission workdir tmpfs    |

The sandbox-escape suite (`judge-service/sandbox_test.go`) submits each of these payloads and asserts they fail. The CI job `judge-sandbox-tests` runs the suite inside the judge container so nsjail is present and exercised.

### Pattern blocklist

The pattern blocklist in `main.go` (`isSafe`) remains as defence-in-depth. It rejects obvious abuse (e.g. `import os`, `Runtime.getRuntime`) before we pay the jail-startup cost. It is NOT the security boundary and must never be loosened on the assumption that nsjail will catch the rest — it's a free pre-flight, nothing more.

## Consequences

**Positive:**

- Hardware-grade isolation between submissions and the host. A successful exploit must escape Linux namespaces — a much higher bar than escaping the previous bare-`exec` model.
- No docker socket exposure. The judge container does not need to be quasi-privileged. This was the largest single risk of the option-3 design.
- Per-submission cold start is ~5 ms instead of ~150 ms (no docker daemon round trip).
- Resource accounting is via setrlimit (in-process), no per-jail cgroup write — simpler than cgroup v2 setup, suitable for both cgroup v1 and v2 hosts.
- Same model maps cleanly to gVisor or firecracker if a CVE forces escalation — only the wrapper command in `sandbox.go` changes.

**Negative:**

- nsjail is Linux-only. Local dev on macOS/Windows runs without isolation; `JUDGE_SANDBOX_MODE=off` is required to make the warning explicit, and CI runs the sandbox tests inside the judge image where nsjail is present.
- The runtime image is ~30 MB heavier (nsjail binary + libprotobuf, libnl-route-3, libcap2). Acceptable for a security control.
- If nsjail is unavailable at runtime (binary missing, SECCOMP disabled by host policy), the judge logs a loud warning and falls back to bare exec. Production deploys must alert on this log line.

**Neutral:**

- The pattern blocklist remains as defence-in-depth, unchanged.
- ADR 0020 history retains the original Docker-per-submission framing in git; this rewrite is a course correction after CRITIC found the implementation never matched the doc.

## Alternatives considered

| Alternative                          | Why rejected                                                              |
|--------------------------------------|---------------------------------------------------------------------------|
| Pattern-only blocklist               | Trivially bypassed; not a security boundary by any modern standard.       |
| Language-level sandboxing            | Per-language complexity, deprecated APIs, no defence against JIT/ctypes.  |
| Docker per submission                | Requires docker socket mounted into the judge — privileged-equivalent.    |
| gVisor / Kata / firecracker          | Stronger but operationally heavier; revisit if a Linux-NS CVE forces it.  |
| One persistent container, many jobs  | Cross-submission contamination via tmpfs, env, or filesystem state.       |

## Operational notes

- The judge container runs as a normal user. No docker socket is mounted.
- nsjail is installed at image build time from upstream source pinned to a tagged release (`NSJAIL_VERSION` build arg in `judge-service/Dockerfile`).
- The startup log line `sandbox: mode=nsjail, defaults={...}` confirms enforcement is active. A line containing `mode=off` in production must page on-call.
- The pattern blocklist (`judge-service/main.go`) is cheap pre-flight rejection, not the security boundary. Loosen it only with a security review.
- Audit log every successful jail termination signal (e.g. `time_limit`, `rlimit_as`) — feeds the security review queue and the metrics dashboard.

## References

- [google/nsjail](https://github.com/google/nsjail) — upstream source, pinned in `judge-service/Dockerfile`.
- [`judge-service/sandbox.go`](../../judge-service/sandbox.go) — wrapper implementation.
- [`judge-service/sandbox_test.go`](../../judge-service/sandbox_test.go) — escape-attempt regression suite.
- [ADR 0003](0003-go-for-judge-service.md) — language choice for the judge service.
- [ADR 0009](0009-judge-concurrency-bounds.md) — concurrency caps.
