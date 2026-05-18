import { describe, it, expect, vi } from "vitest";
import { WorkerQueue } from "@/lib/queue";

describe("WorkerQueue", () => {
  it("processes a single job through a registered handler", async () => {
    const q = new WorkerQueue({ concurrency: 1, maxAttempts: 1 });
    const handled: number[] = [];
    q.on<{ n: number }>("inc", async ({ n }) => { handled.push(n); });

    q.enqueue("inc", { n: 1 });
    q.enqueue("inc", { n: 2 });
    await q.drain();

    expect(handled).toEqual([1, 2]);
    expect(q.stats().processed).toBe(2);
  });

  it("respects the concurrency cap", async () => {
    const q = new WorkerQueue({ concurrency: 2, maxAttempts: 1 });
    let inFlight = 0;
    let peakInFlight = 0;
    q.on("slow", async () => {
      inFlight++;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
    });

    for (let i = 0; i < 6; i++) q.enqueue("slow", { i });
    await q.drain();

    expect(peakInFlight).toBeLessThanOrEqual(2);
    expect(q.stats().processed).toBe(6);
  });

  it("retries on failure up to maxAttempts then dead-letters", async () => {
    const q = new WorkerQueue({ concurrency: 1, maxAttempts: 3 });
    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    q.on("flaky", handler);

    q.enqueue("flaky", { x: 1 });
    await q.drain();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(q.stats().processed).toBe(0);
    expect(q.stats().failed).toBe(1);
    expect(q.stats().deadLetterCount).toBe(1);
  });

  it("recovers when retries eventually succeed", async () => {
    const q = new WorkerQueue({ concurrency: 1, maxAttempts: 3 });
    let attempts = 0;
    q.on("eventual", async () => {
      attempts++;
      if (attempts < 2) throw new Error("first try fails");
    });

    q.enqueue("eventual", {});
    await q.drain();

    expect(attempts).toBe(2);
    expect(q.stats().processed).toBe(1);
    expect(q.stats().failed).toBe(0);
  });

  it("dead-letters when no handler is registered", async () => {
    const q = new WorkerQueue({ concurrency: 1, maxAttempts: 3 });
    q.enqueue("unknown", {});
    await q.drain();

    expect(q.stats().failed).toBe(1);
    expect(q.stats().deadLetterCount).toBe(1);
  });

  it("returns the job id from enqueue with the j_ prefix", () => {
    const q = new WorkerQueue();
    const id = q.enqueue("noop", {});
    expect(id).toMatch(/^j_\d+$/);
  });

  it("stats handlers count reflects on() calls", () => {
    const q = new WorkerQueue();
    q.on("a", async () => {});
    q.on("b", async () => {});
    expect(q.stats().handlers).toBe(2);
  });
});
