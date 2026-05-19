import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { GET as listGET } from "@/app/api/study-plans/route";
import { GET as detailGET } from "@/app/api/study-plans/[slug]/route";
import { POST as startPOST } from "@/app/api/study-plans/[slug]/start/route";
import { DELETE as abandonDELETE } from "@/app/api/study-plans/[slug]/abandon/route";

function paramsFor(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("GET /api/study-plans", () => {
  it("returns the public catalogue without progress when signed out", async () => {
    prismaMock.studyPlan.findMany.mockResolvedValue([
      {
        id: "sp1",
        slug: "top-interview-150",
        title: "Top Interview 150",
        description: "Big tech",
        difficulty: "Mixed",
        estimatedHours: 60,
        coverImage: null,
        isOfficial: true,
        _count: { problems: 18 },
      },
    ] as never);

    const res = await listGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plans).toHaveLength(1);
    expect(data.plans[0].problemCount).toBe(18);
    expect(data.progress).toEqual({});
  });

  it("merges per-user progress when authenticated", async () => {
    await loginAs({ userId: "u1" });

    prismaMock.studyPlan.findMany.mockResolvedValue([
      {
        id: "sp1",
        slug: "two-pointers",
        title: "Two Pointers",
        description: "...",
        difficulty: "Medium",
        estimatedHours: 14,
        coverImage: null,
        isOfficial: true,
        _count: { problems: 3 },
      },
    ] as never);
    prismaMock.userStudyPlan.findMany.mockResolvedValue([
      { studyPlanId: "sp1", startedAt: new Date("2026-05-01T00:00:00Z"), completedAt: null },
    ] as never);
    prismaMock.studyPlanProblem.findMany.mockResolvedValue([
      { studyPlanId: "sp1", problemId: "p1" },
      { studyPlanId: "sp1", problemId: "p2" },
      { studyPlanId: "sp1", problemId: "p3" },
    ] as never);
    prismaMock.submission.findMany.mockResolvedValue([
      { problemId: "p1" },
      { problemId: "p2" },
    ] as never);

    const res = await listGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.progress.sp1.solved).toBe(2);
    expect(data.progress.sp1.completedAt).toBeNull();
  });
});

describe("GET /api/study-plans/[slug]", () => {
  it("returns 404 for unknown slug", async () => {
    prismaMock.studyPlan.findUnique.mockResolvedValue(null);
    const res = await detailGET(
      asNextRequest(new Request("http://x/api/study-plans/missing")),
      paramsFor("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("400 on malformed slug", async () => {
    const res = await detailGET(
      asNextRequest(new Request("http://x/api/study-plans/Has%20Space")),
      paramsFor("Has Space"),
    );
    expect(res.status).toBe(400);
  });

  it("returns the plan with day-grouped problems", async () => {
    prismaMock.studyPlan.findUnique.mockResolvedValue({
      id: "sp1",
      slug: "binary-search",
      title: "Binary Search",
      description: "...",
      difficulty: "Medium",
      estimatedHours: 16,
      coverImage: null,
      isOfficial: true,
      problems: [
        {
          order: 1,
          dayNumber: 1,
          problem: { id: "p1", title: "Binary Search", slug: "binary-search", difficulty: "Easy", acceptanceRate: 0.55 },
        },
        {
          order: 2,
          dayNumber: 2,
          problem: {
            id: "p2",
            title: "Search in Rotated Sorted Array",
            slug: "search-in-rotated-sorted-array",
            difficulty: "Medium",
            acceptanceRate: null,
          },
        },
      ],
    } as never);

    const res = await detailGET(
      asNextRequest(new Request("http://x/api/study-plans/binary-search")),
      paramsFor("binary-search"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plan.slug).toBe("binary-search");
    expect(data.plan.problems).toHaveLength(2);
    expect(data.plan.problems[0].dayNumber).toBe(1);
    expect(data.solvedProblemIds).toEqual([]);
    expect(data.enrollment).toBeNull();
  });
});

describe("POST /api/study-plans/[slug]/start", () => {
  it("401 when not authenticated", async () => {
    const res = await startPOST(
      asNextRequest(new Request("http://x/api/study-plans/binary-search/start", { method: "POST" })),
      paramsFor("binary-search"),
    );
    expect(res.status).toBe(401);
  });

  it("404 when slug does not exist", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.studyPlan.findUnique.mockResolvedValue(null);
    const res = await startPOST(
      asNextRequest(new Request("http://x/api/study-plans/missing/start", { method: "POST" })),
      paramsFor("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("creates a fresh enrollment (201)", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.studyPlan.findUnique.mockResolvedValue({ id: "sp1" } as never);
    const startedAt = new Date();
    prismaMock.userStudyPlan.upsert.mockResolvedValue({
      userId: "u1",
      studyPlanId: "sp1",
      startedAt,
      completedAt: null,
      lastActivityAt: startedAt,
    } as never);

    const res = await startPOST(
      asNextRequest(new Request("http://x/api/study-plans/binary-search/start", { method: "POST" })),
      paramsFor("binary-search"),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.alreadyStarted).toBe(false);
  });

  it("re-starting is idempotent and returns 200", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.studyPlan.findUnique.mockResolvedValue({ id: "sp1" } as never);
    const oldStartedAt = new Date(Date.now() - 1_000_000);
    prismaMock.userStudyPlan.upsert.mockResolvedValue({
      userId: "u1",
      studyPlanId: "sp1",
      startedAt: oldStartedAt,
      completedAt: null,
      lastActivityAt: new Date(),
    } as never);

    const res = await startPOST(
      asNextRequest(new Request("http://x/api/study-plans/binary-search/start", { method: "POST" })),
      paramsFor("binary-search"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alreadyStarted).toBe(true);
  });
});

describe("DELETE /api/study-plans/[slug]/abandon", () => {
  it("401 when not authenticated", async () => {
    const res = await abandonDELETE(
      asNextRequest(new Request("http://x/api/study-plans/binary-search/abandon", { method: "DELETE" })),
      paramsFor("binary-search"),
    );
    expect(res.status).toBe(401);
  });

  it("removes the enrollment when present", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.studyPlan.findUnique.mockResolvedValue({ id: "sp1" } as never);
    prismaMock.userStudyPlan.deleteMany.mockResolvedValue({ count: 1 } as never);

    const res = await abandonDELETE(
      asNextRequest(new Request("http://x/api/study-plans/binary-search/abandon", { method: "DELETE" })),
      paramsFor("binary-search"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.abandoned).toBe(true);
  });
});
