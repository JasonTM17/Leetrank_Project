import { describe, it, expect } from "vitest";
import { recordHttp, snapshotHttp } from "@/lib/metrics";

describe("metrics counters", () => {
  it("recordHttp increments total and per-status counts", () => {
    const before = snapshotHttp();
    recordHttp(200);
    recordHttp(200);
    recordHttp(404);
    const after = snapshotHttp();
    expect(after.total - before.total).toBe(3);
    expect((after.byStatus["200"] ?? 0) - (before.byStatus["200"] ?? 0)).toBe(2);
    expect((after.byStatus["404"] ?? 0) - (before.byStatus["404"] ?? 0)).toBe(1);
  });
});
