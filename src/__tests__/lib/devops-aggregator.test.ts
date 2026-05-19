import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prismaMock } from "../setup";

// Tests focus on the pure business-logic branches of the aggregator:
// - tokenMissing / API-error / happy-path branches in getCiRuns
// - placeholder vs prometheus branch in getQueueDepth
// - accountLockout-not-loaded branch in getLockoutCount
// - submissionRate db-error branch
// - getSecurityEvents merging
// - getServiceHealth overall=down/operational classification
// Network probes are mocked through globalThis.fetch.

describe("devops/aggregator", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("getCiRuns returns tokenMissing when GH_DEVOPS_TOKEN is unset", async () => {
    delete process.env.GH_DEVOPS_TOKEN;
    const { getCiRuns } = await import("@/lib/devops/aggregator");
    const result = await getCiRuns(3);
    expect(result.ok).toBe(false);
    if (!result.ok && "reason" in result) {
      expect(result.reason).toBe("tokenMissing");
    }
  });

  it("getCiRuns surfaces an API error when GitHub returns non-2xx", async () => {
    process.env.GH_DEVOPS_TOKEN = "fake-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(null, { status: 502 })
    ));
    const { getCiRuns } = await import("@/lib/devops/aggregator");
    const result = await getCiRuns(2);
    expect(result.ok).toBe(false);
    if (!result.ok && "error" in result) {
      expect(result.error).toContain("502");
    }
  });

  it("getCiRuns maps workflow_runs into the typed shape on the happy path", async () => {
    process.env.GH_DEVOPS_TOKEN = "fake-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          workflow_runs: [
            {
              id: 1,
              name: "CI",
              status: "completed",
              conclusion: "success",
              html_url: "https://x/y",
              head_branch: "main",
              head_sha: "abcdef1234567890",
              created_at: "2026-05-19T12:00:00.000Z",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    ));
    const { getCiRuns } = await import("@/lib/devops/aggregator");
    const result = await getCiRuns(5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.runs[0].id).toBe(1);
      expect(result.data.runs[0].headSha).toBe("abcdef1");
    }
  });

  it("getCiRuns falls through to error when fetch throws", async () => {
    process.env.GH_DEVOPS_TOKEN = "fake-token";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const { getCiRuns } = await import("@/lib/devops/aggregator");
    const result = await getCiRuns(1);
    expect(result.ok).toBe(false);
    if (!result.ok && "error" in result) {
      expect(result.error).toBe("network");
    }
  });

  it("getQueueDepth returns prometheus source when scrape contains the metric", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("submissions_queue_depth 42\n", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })
    ));
    const { getQueueDepth } = await import("@/lib/devops/aggregator");
    const result = await getQueueDepth();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.source).toBe("prometheus");
      expect(result.data.depth).toBe(42);
    }
  });

  it("getQueueDepth returns placeholder when metric is absent from response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("# unrelated\nother_metric 1\n", { status: 200 })
    ));
    const { getQueueDepth } = await import("@/lib/devops/aggregator");
    const result = await getQueueDepth();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.source).toBe("placeholder");
  });

  it("getQueueDepth returns placeholder when metrics endpoint is non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    const { getQueueDepth } = await import("@/lib/devops/aggregator");
    const result = await getQueueDepth();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.source).toBe("placeholder");
      expect(result.data.depth).toBeNull();
    }
  });

  it("getQueueDepth swallows network errors and returns placeholder", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { getQueueDepth } = await import("@/lib/devops/aggregator");
    const result = await getQueueDepth();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.source).toBe("placeholder");
  });

  it("getLockoutCount returns 0 when accountLockout model is missing", async () => {
    // setup.ts mocks prisma without accountLockout.
    const { getLockoutCount } = await import("@/lib/devops/aggregator");
    const result = await getLockoutCount();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(0);
  });

  it("getSandboxEscapes returns the V1 baseline of 0", async () => {
    const { getSandboxEscapes } = await import("@/lib/devops/aggregator");
    const result = await getSandboxEscapes();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(0);
  });

  it("getSubmissionRate counts submissions in the last hour", async () => {
    prismaMock.submission.count.mockResolvedValue(7);
    const { getSubmissionRate } = await import("@/lib/devops/aggregator");
    const result = await getSubmissionRate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.lastHour).toBe(7);
      expect(result.data.windowMinutes).toBe(60);
    }
  });

  it("getSubmissionRate returns ok:false when prisma throws", async () => {
    prismaMock.submission.count.mockRejectedValue(new Error("db down") as never);
    const { getSubmissionRate } = await import("@/lib/devops/aggregator");
    const result = await getSubmissionRate();
    expect(result.ok).toBe(false);
    if (!result.ok && "error" in result) {
      expect(result.error).toBe("db down");
    }
  });

  it("getSecurityEvents merges escapes + lockouts into a single tile result", async () => {
    const { getSecurityEvents } = await import("@/lib/devops/aggregator");
    const result = await getSecurityEvents();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sandboxEscapes).toBe(0);
      expect(result.data.lockoutsLastHour).toBe(0);
    }
  });

  it("getServiceHealth reports overall=down when any tile is down", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    // probes for non-web services: first ok, then a 500.
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        call += 1;
        // First half ok, second half fail.
        return new Response(null, { status: call <= 4 ? 200 : 500 });
      })
    );
    const { getServiceHealth } = await import("@/lib/devops/aggregator");
    const result = await getServiceHealth();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.overall).toBe("down");
      expect(result.data.services.length).toBeGreaterThan(0);
    }
  });

  it("getServiceHealth reports overall=operational when all tiles ok", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    );
    const { getServiceHealth } = await import("@/lib/devops/aggregator");
    const result = await getServiceHealth();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.overall).toBe("operational");
  });

  it("getServiceHealth marks the web tile down when prisma ping throws", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("connection refused") as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    );
    const { getServiceHealth } = await import("@/lib/devops/aggregator");
    const result = await getServiceHealth();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const web = result.data.services.find((s) => s.id === "web");
      expect(web?.status).toBe("down");
    }
  });

  it("buildSnapshot composes every result into a single payload", async () => {
    delete process.env.GH_DEVOPS_TOKEN;
    prismaMock.submission.count.mockResolvedValue(0);
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    );
    const { buildSnapshot } = await import("@/lib/devops/aggregator");
    const snap = await buildSnapshot();
    expect(snap.serviceHealth.ok).toBe(true);
    expect(snap.submissionRate.ok).toBe(true);
    expect(snap.queueDepth.ok).toBe(true);
    expect(snap.securityEvents.ok).toBe(true);
    expect(snap.ciRuns.ok).toBe(false);
    expect(typeof snap.generatedAt).toBe("string");
  });
});
