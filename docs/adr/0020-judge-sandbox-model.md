# 20. Judge sandbox model: one Docker container per submission

Date: 2026-05-19

## Status

Accepted. Codifies the runtime contract first sketched in [ADR 0003](0003-go-for-judge-service.md) and constrained in [ADR 0009](0009-judge-concurrency-bounds.md).

## Context

The judge service runs **untrusted user code** for every submission. The threat model is broad: arbitrary code in 30+ languages, including bytecode interpreters and JIT compilers. We need isolation that survives:

- Filesystem escape attempts (`../`, `/etc/passwd`, `chroot`).
- Network egress (data exfiltration, port scanning).
- Resource exhaustion (fork bombs, OOM, infinite loops).
- Persistence (writing to disk to influence later submissions).
- Side-channels into the host or other tenants.

Three sandbox models were evaluated:

1. **Pattern-only blocklist + bare `exec.Command`.** Cheapest. Today's stop-gap. A motivated attacker bypasses it in under an hour.
2. **In-process language-level sandboxing** (e.g. Python `seccomp`, Java `SecurityManager`). Per-language complexity; SecurityManager is deprecated in modern JDKs; Python's `seccomp` doesn't help against JIT or `ctypes`. Rejected.
3. **One Docker container per submission.** Each `POST /execute` spawns a transient sandbox container with no network, read-only rootfs, dropped capabilities, hard CPU/memory limits, and a tmpfs `/tmp` for the working directory.
4. **Firecracker microVMs** (gVisor / Kata). Stronger isolation than Docker, but adds operational complexity and an order of magnitude more code. Reserved for v2 if a CVE forces our hand.

## Decision

Adopt option 3: **one short-lived Docker container per submission** as the canonical sandbox.

The judge launches a sibling container for each `/execute` request via the host Docker socket (`/var/run/docker.sock` mounted into the judge container — see compose `judge` service). Per submission:

```
docker run --rm \
  --network none \
  --read-only \
  --tmpfs /tmp:rw,size=64m,nodev,nosuid \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit 64 \
  --cpus 1 \
  --memory 256m --memory-swap 256m \
  --user 65534:65534 \
  leetrank-runner:<lang> \
  /entrypoint.sh
```

Per-language images live under `judge-service/runners/`. The runner reads source on stdin or from a tmpfs file, compiles if needed, runs against test cases, and writes verdicts to stdout. The judge collects stdout and returns the verdict.

Hard limits per submission:

| Limit | Value | Override |
|-------|-------|----------|
| CPU | 1 vCPU | not configurable |
| Memory | 256 MB (default) | request `memoryLimit` (max 512 MB) |
| Wall clock | 5 000 ms (default) | request `timeLimit` (max 10 000 ms) |
| Pids | 64 | not configurable |
| Network | none | not configurable |
| Filesystem | rootfs read-only, 64 MB tmpfs `/tmp` | not configurable |
| Capabilities | all dropped | not configurable |
| User | uid 65534 (`nobody`) | not configurable |

Concurrency is capped globally by `JUDGE_MAX_CONCURRENT` (default 8) and per-IP by `JUDGE_RATE_LIMIT` (default 30/min). See [ADR 0009](0009-judge-concurrency-bounds.md).

## Consequences

**Positive:**

- Hardware-grade isolation between submissions and the host. A successful exploit must escape Docker namespaces — a much higher bar than escaping a `seccomp` filter.
- Predictable resource accounting via cgroups; no need to instrument process trees.
- Per-language images are independently versioned and patched without touching the judge.
- The same model maps cleanly to gVisor/Kata if we later need stronger isolation — only the runtime flag changes.

**Negative:**

- ~150 ms cold-start cost per submission for `docker run`. Acceptable for a competitive-programming workload (median solve time minutes, not milliseconds).
- The host needs Docker installed and the daemon running. The judge container needs `/var/run/docker.sock` mounted (privileged-equivalent) — this is the single most sensitive trust boundary in the platform. The judge must never run user-controlled code in its own process space.
- Image sprawl — one runner image per supported language. Mitigated by sharing a base image.

**Neutral:**

- The pattern blocklist remains as defence-in-depth. It rejects obvious abuse early to save the docker-run round trip, but it is not the security boundary.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Pattern-only blocklist | Too easy to bypass; not a security boundary by any modern standard. |
| Language-level sandboxing | Per-language complexity, deprecated APIs, no defence against JIT/ctypes. |
| Firecracker / gVisor / Kata | Stronger but operationally heavier; revisit if a docker-namespace CVE forces escalation. |
| One persistent container, multi-tenant | Cross-submission contamination via tmpfs, env, or filesystem state. Rejected. |

## Operational notes

- The judge container itself runs as a normal user with only the docker socket mounted; it cannot read other host files.
- Runner images are pinned by digest in the judge config and rebuilt by CI on every `main` push.
- The pattern blocklist (`judge-service/main.go`) is cheap pre-flight rejection, not the security boundary. Loosen it only with a security review.
- Audit log every successful escape attempt (containers that exit non-zero with `seccomp violation`) — feeds the security review queue.
