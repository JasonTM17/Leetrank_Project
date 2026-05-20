// Shared-solutions API tests. Mocks @/lib/db (default Prisma surface) plus
// @/lib/solutions (the raw-SQL DAL) so individual endpoints can be tested
// in isolation without a live database.
//
// Coverage targets per task brief:
// - vote toggle (create / untoggle / flip)
// - PATCH owner-only
// - POST accepted-submission gate + auth
// - rate limit on POST

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";

// Hoisted DAL mock — every test references the same fns and resets per case.
vi.mock("@/lib/solutions", () => ({
  findSolutionById: vi.fn(),
  findSolutionRowById: vi.fn(),
  listSolutions: vi.fn(),
  createSolution: vi.fn(),
  updateSolution: vi.fn(),
  deleteSolution: vi.fn(),
}));

import * as dal from "@/lib/solutions";
const mockedDal = dal as unknown as {
  findSolutionById: ReturnType<typeof vi.fn>;
  findSolutionRowById: ReturnType<typeof vi.fn>;
  listSolutions: ReturnType<typeof vi.fn>;
  createSolution: ReturnType<typeof vi.fn>;
  updateSolution: ReturnType<typeof vi.fn>;
  deleteSolution: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  process.env.SOLUTIONS_ENABLED = "true";
  for (const fn of Object.values(mockedDal)) {
    (fn as ReturnType<typeof vi.fn>).mockReset();
  }
  // Default raw helpers — vote route uses these directly on prismaMock.
  prismaMock.$queryRaw.mockReset?.();
  (prismaMock as unknown as { $queryRawUnsafe: ReturnType<typeof vi.fn> }).$queryRawUnsafe =
    vi.fn();
  (prismaMock as unknown as { $executeRawUnsafe: ReturnType<typeof vi.fn> }).$executeRawUnsafe =
    vi.fn();
});

// ── POST /api/problems/[slug]/solutions ───────────────────────────────────

describe("POST /api/problems/[slug]/solutions", () => {
  const url = (slug: string) => `http://x/api/problems/${slug}/solutions`;
  const paramsFor = (slug: string) => ({ params: Promise.resolve({ slug }) });

  function validBody(over: Partial<Record<string, unknown>> = {}) {
    return {
      submissionId: "sub-1",
      title: "DP solution explained",
      writeup: "x".repeat(120),
      ...over,
    };
  }

  it("404 when SOLUTIONS_ENABLED is unset", async () => {
    process.env.SOLUTIONS_ENABLED = "false";
    const { POST } = await import("@/app/api/problems/[slug]/solutions/route");
    const res = await POST(asNextRequest(jsonRequest(url("two-sum"), validBody())), paramsFor("two-sum"));
    expect(res.status).toBe(404);
  });

  it("401 unauthenticated", async () => {
    const { POST } = await import("@/app/api/problems/[slug]/solutions/route");
    const res = await POST(asNextRequest(jsonRequest(url("two-sum"), validBody())), paramsFor("two-sum"));
    expect(res.status).toBe(401);
  });

  it("404 when problem not found", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.problem.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/problems/[slug]/solutions/route");
    const res = await POST(asNextRequest(jsonRequest(url("missing"), validBody())), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("400 when writeup < 100 chars", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.problem.findUnique.mockResolvedValue({ id: "p1" } as never);
    const { POST } = await import("@/app/api/problems/[slug]/solutions/route");
    const res = await POST(
      asNextRequest(jsonRequest(url("two-sum"), validBody({ writeup: "too short" }))),
      paramsFor("two-sum")
    );
    expect(res.status).toBe(400);
  });

  it("403 when submission belongs to another user", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.problem.findUnique.mockResolvedValue({ id: "p1" } as never);
    prismaMock.submission.findUnique.mockResolvedValue({
      id: "sub-1",
      userId: "someone-else",
      problemId: "p1",
      status: "accepted",
      language: "python",
    } as never);
    const { POST } = await import("@/app/api/problems/[slug]/solutions/route");
    const res = await POST(asNextRequest(jsonRequest(url("two-sum"), validBody())), paramsFor("two-sum"));
    expect(res.status).toBe(403);
  });

  it("400 when submission is not accepted", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.problem.findUnique.mockResolvedValue({ id: "p1" } as never);
    prismaMock.submission.findUnique.mockResolvedValue({
      id: "sub-1",
      userId: "u1",
      problemId: "p1",
      status: "wrong_answer",
      language: "python",
    } as never);
    const { POST } = await import("@/app/api/problems/[slug]/solutions/route");
    const res = await POST(asNextRequest(jsonRequest(url("two-sum"), validBody())), paramsFor("two-sum"));
    expect(res.status).toBe(400);
  });

  it("404 when submission is from a different problem", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.problem.findUnique.mockResolvedValue({ id: "p1" } as never);
    prismaMock.submission.findUnique.mockResolvedValue({
      id: "sub-1",
      userId: "u1",
      problemId: "p-other",
      status: "accepted",
      language: "python",
    } as never);
    const { POST } = await import("@/app/api/problems/[slug]/solutions/route");
    const res = await POST(asNextRequest(jsonRequest(url("two-sum"), validBody())), paramsFor("two-sum"));
    expect(res.status).toBe(404);
  });

  it("201 on accepted-submission share with valid writeup", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.problem.findUnique.mockResolvedValue({ id: "p1" } as never);
    prismaMock.submission.findUnique.mockResolvedValue({
      id: "sub-1",
      userId: "u1",
      problemId: "p1",
      status: "accepted",
      language: "python",
    } as never);
    mockedDal.createSolution.mockResolvedValue({
      id: "s1",
      problemId: "p1",
      userId: "u1",
      submissionId: "sub-1",
      title: "DP solution explained",
      writeup: "x".repeat(120),
      language: "python",
      voteCount: 0,
    } as never);
    const { POST } = await import("@/app/api/problems/[slug]/solutions/route");
    const res = await POST(asNextRequest(jsonRequest(url("two-sum"), validBody())), paramsFor("two-sum"));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.solution.id).toBe("s1");
  });
});
