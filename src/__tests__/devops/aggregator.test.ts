import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../setup";

describe("devops/aggregator", () => {
  const ORIGINAL_FETCH = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.GH_DEVOPS_TOKEN;
    delete process.env.GH_DEVOPS_REPO;
    globalThis.fetch = ORIGINAL_FETCH;
  });

  describe("getServiceHealth", () => {
    it("returns operational overall when DB and all probes succeed", async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ ok: 1 }]);
      globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as unknown as typeof fetch;
      const { getServiceHealth, SERVICES } = await import("@/lib/devops/aggregator");
      const result = await getServiceHealth();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.services).toHaveLength(SERVICES.length);
      expect(result.data.overall).toBe("operational");
      expect(result.data.services.every((s) => s.status === "operational")).toBe(true);
    });

    it("marks web tile down when prisma raw query throws", async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error("db gone"));
      globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as unknown as typeof fetch;
      const { getServiceHealth } = await import("@/lib/devops/aggregator");
      const result = await getServiceHealth();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const web = result.data.services.find((s) => s.id === "web");
      expect(web?.status).toBe("down");
      expect(result.data.overall).toBe("down");
    });

    it("marks individual service down when its probe rejects but page still renders", async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ ok: 1 }]);
      let call = 0;
      globalThis.fetch = vi.fn(async () => {
        call += 1;
        if (call === 1) throw new Error("network");
        return new Response("ok", { status: 200 });
      }) as unknown as typeof fetch;
      const { getServiceHealth } = await import("@/lib/devops/aggregator");
      const result = await getServiceHealth();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const downCount = result.data.services.filter((s) => s.status === "down").length;
      expect(downCount).toBeGreaterThanOrEqual(1);
      expect(result.data.overall).toBe("down");
    });
  });

  describe("getCiRuns", () => {
    it("returns tokenMissing when GH_DEVOPS_TOKEN is unset", async () => {
      const { getCiRuns } = await import("@/lib/devops/aggregator");
      const result = await getCiRuns();
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect("reason" in result && result.reason).toBe("tokenMissing");
    });

    it("maps GitHub workflow_runs payload into typed CiRun list", async () => {
      process.env.GH_DEVOPS_TOKEN = "ghp_fake";
      process.env.GH_DEVOPS_REPO = "octo/repo";
      globalThis.fetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            workflow_runs: [
              {
                id: 42,
                name: "ci",
                status: "completed",
                conclusion: "success",
                html_url: "https://github.com/octo/repo/actions/runs/42",
                head_branch: "main",
                head_sha: "abcdef0123456",
                created_at: "2026-05-19T12:00:00Z",
              },
            ],
          }),
          { status: 200 }
        )
      ) as unknown as typeof fetch;
      const { getCiRuns } = await import("@/lib/devops/aggregator");
      const result = await getCiRuns();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.repo).toBe("octo/repo");
      expect(result.data.runs).toHaveLength(1);
      expect(result.data.runs[0].headSha).toBe("abcdef0");
      expect(result.data.runs[0].conclusion).toBe("success");
    });

    it("propagates non-2xx GitHub responses as error result", async () => {
      process.env.GH_DEVOPS_TOKEN = "ghp_fake";
      globalThis.fetch = vi.fn(async () => new Response("nope", { status: 502 })) as unknown as typeof fetch;
      const { getCiRuns } = await import("@/lib/devops/aggregator");
      const result = await getCiRuns();
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect("error" in result && result.error).toContain("502");
    });
  });

  describe("getSubmissionRate", () => {
    it("counts submissions in the last hour", async () => {
      prismaMock.submission.count.mockResolvedValue(123);
      const { getSubmissionRate } = await import("@/lib/devops/aggregator");
      const result = await getSubmissionRate();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.lastHour).toBe(123);
      expect(result.data.windowMinutes).toBe(60);
    });

    it("returns error result when prisma rejects", async () => {
      prismaMock.submission.count.mockRejectedValue(new Error("conn lost"));
      const { getSubmissionRate } = await import("@/lib/devops/aggregator");
      const result = await getSubmissionRate();
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/conn lost/);
    });
  });

  describe("getLockoutCount", () => {
    it("returns 0 when accountLockout model is not present on the prisma client", async () => {
      const { getLockoutCount } = await import("@/lib/devops/aggregator");
      const result = await getLockoutCount();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBe(0);
    });
  });

  describe("getQueueDepth", () => {
    it("parses submissions_queue_depth metric when /metrics responds", async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response("# HELP foo\nsubmissions_queue_depth 17\n", { status: 200 })
      ) as unknown as typeof fetch;
      const { getQueueDepth } = await import("@/lib/devops/aggregator");
      const result = await getQueueDepth();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.depth).toBe(17);
      expect(result.data.source).toBe("prometheus");
    });

    it("falls back to placeholder when /metrics endpoint is unreachable", async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }) as unknown as typeof fetch;
      const { getQueueDepth } = await import("@/lib/devops/aggregator");
      const result = await getQueueDepth();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.depth).toBeNull();
      expect(result.data.source).toBe("placeholder");
    });
  });

  describe("buildSnapshot", () => {
    it("aggregates partial failures into a complete snapshot envelope", async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ ok: 1 }]);
      prismaMock.submission.count.mockRejectedValue(new Error("db slow"));
      globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as unknown as typeof fetch;
      const { buildSnapshot } = await import("@/lib/devops/aggregator");
      const snap = await buildSnapshot();
      expect(snap.serviceHealth.ok).toBe(true);
      expect(snap.submissionRate.ok).toBe(false);
      expect(snap.ciRuns.ok).toBe(false); // no token
      expect(snap.queueDepth.ok).toBe(true);
      expect(snap.securityEvents.ok).toBe(true);
      expect(snap.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
