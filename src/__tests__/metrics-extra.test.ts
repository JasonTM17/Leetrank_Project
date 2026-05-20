import { describe, it, expect } from "vitest";
import {
  recordHttp,
  snapshotHttp,
  recordSlowQuery,
  snapshotSlowQueries,
  recordMissingRequestId,
  snapshotMissingRequestId,
} from "@/lib/metrics";

describe("metrics counters", () => {
  // Module-level state. We don't have a reset hook, so each test
  // captures a baseline first and asserts deltas.
  it("recordHttp increments total + per-status counts", () => {
    const before = snapshotHttp();
    recordHttp(200);
    recordHttp(200);
    recordHttp(500);
    const after = snapshotHttp();
    expect(after.total - before.total).toBe(3);
    const got200 = (after.byStatus["200"] ?? 0) - (before.byStatus["200"] ?? 0);
    const got500 = (after.byStatus["500"] ?? 0) - (before.byStatus["500"] ?? 0);
    expect(got200).toBe(2);
    expect(got500).toBe(1);
  });

  it("snapshotHttp returns plain-object byStatus keyed by string", () => {
    recordHttp(404);
    const snap = snapshotHttp();
    expect(typeof snap.byStatus).toBe("object");
    expect(snap.byStatus["404"]).toBeGreaterThanOrEqual(1);
    // Should NOT be a Map — JSON-serializable.
    expect(snap.byStatus instanceof Map).toBe(false);
  });

  it("recordSlowQuery increments slow-query counter monotonically", () => {
    const before = snapshotSlowQueries().total;
    recordSlowQuery();
    recordSlowQuery();
    expect(snapshotSlowQueries().total - before).toBe(2);
  });

  it("recordMissingRequestId increments missing-id counter monotonically", () => {
    const before = snapshotMissingRequestId().total;
    recordMissingRequestId();
    expect(snapshotMissingRequestId().total - before).toBe(1);
  });
});
