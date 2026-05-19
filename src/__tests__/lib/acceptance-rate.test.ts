import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../setup";
import {
  computeAcceptanceRate,
  refreshAcceptanceRate,
  refreshAllAcceptanceRates,
  equalRates,
} from "@/lib/acceptance-rate";

beforeEach(() => {
  prismaMock.submission.groupBy.mockReset();
  prismaMock.problem.findUnique.mockReset();
  prismaMock.problem.findMany.mockReset();
  prismaMock.problem.update.mockReset();
});

describe("equalRates", () => {
  it("treats two nulls as equal", () => {
    expect(equalRates(null, null)).toBe(true);
  });

  it("flags one-sided nulls as different", () => {
    expect(equalRates(null, 0)).toBe(false);
    expect(equalRates(0.5, null)).toBe(false);
  });

  it("ignores sub-epsilon drift", () => {
    expect(equalRates(0.5, 0.50001)).toBe(true);
  });

  it("flags meaningful drift as different", () => {
    expect(equalRates(0.5, 0.51)).toBe(false);
  });
});

describe("computeAcceptanceRate", () => {
  it("returns null rate when there are no submissions", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([]);
    const snap = await computeAcceptanceRate("p1");
    expect(snap).toEqual({ problemId: "p1", total: 0, accepted: 0, rate: null });
  });

  it("aggregates accepted vs other verdicts (case-insensitive)", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([
      { status: "Accepted", _count: { _all: 3 } },
      { status: "wrong_answer", _count: { _all: 7 } },
    ]);
    const snap = await computeAcceptanceRate("p1");
    expect(snap.total).toBe(10);
    expect(snap.accepted).toBe(3);
    expect(snap.rate).toBeCloseTo(0.3, 4);
  });
});

describe("refreshAcceptanceRate", () => {
  it("writes when the rate changes", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([
      { status: "accepted", _count: { _all: 4 } },
      { status: "wrong_answer", _count: { _all: 1 } },
    ]);
    prismaMock.problem.findUnique.mockResolvedValue({ acceptanceRate: 0.1 });

    await refreshAcceptanceRate("p1");

    expect(prismaMock.problem.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { acceptanceRate: 0.8 },
    });
  });

  it("skips the write when the rate is within epsilon", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([
      { status: "accepted", _count: { _all: 1 } },
      { status: "wrong_answer", _count: { _all: 1 } },
    ]);
    prismaMock.problem.findUnique.mockResolvedValue({ acceptanceRate: 0.5 });

    await refreshAcceptanceRate("p1");

    expect(prismaMock.problem.update).not.toHaveBeenCalled();
  });
});

describe("refreshAllAcceptanceRates", () => {
  it("counts only changed rows as updated", async () => {
    prismaMock.problem.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    // p1 already at 0.5 (no update); p2 was null -> now 1.0 (update).
    prismaMock.problem.findUnique
      .mockResolvedValueOnce({ acceptanceRate: 0.5 }) // refreshAcceptanceRate read for p1
      .mockResolvedValueOnce({ acceptanceRate: 0.5 }) // sweep read for p1
      .mockResolvedValueOnce({ acceptanceRate: null }) // refreshAcceptanceRate read for p2
      .mockResolvedValueOnce({ acceptanceRate: null }); // sweep read for p2
    prismaMock.submission.groupBy
      .mockResolvedValueOnce([
        { status: "accepted", _count: { _all: 1 } },
        { status: "wrong_answer", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([{ status: "accepted", _count: { _all: 2 } }]);

    const result = await refreshAllAcceptanceRates();
    expect(result.scanned).toBe(2);
    expect(result.updated).toBe(1);
  });
});
