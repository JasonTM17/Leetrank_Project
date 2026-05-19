// Vote toggle + PATCH owner-only tests for shared solutions.
// Split from solutions.test.ts to keep each suite focused and to allow
// the vote suite to install its own raw-SQL stubs without bleeding into
// the POST/share suite.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";

vi.mock("@/lib/solutions", () => ({
  findSolutionRowById: vi.fn(),
  findSolutionById: vi.fn(),
  listSolutions: vi.fn(),
  createSolution: vi.fn(),
  updateSolution: vi.fn(),
  deleteSolution: vi.fn(),
}));

import * as dal from "@/lib/solutions";
const mockedDal = dal as unknown as {
  findSolutionRowById: ReturnType<typeof vi.fn>;
  updateSolution: ReturnType<typeof vi.fn>;
  deleteSolution: ReturnType<typeof vi.fn>;
};

interface RawStub {
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  process.env.SOLUTIONS_ENABLED = "true";
  for (const fn of Object.values(mockedDal)) {
    (fn as ReturnType<typeof vi.fn>).mockReset();
  }
  const raw = prismaMock as unknown as RawStub;
  raw.$queryRawUnsafe = vi.fn();
  raw.$executeRawUnsafe = vi.fn();
});

// ── POST /api/solutions/[id]/vote ─────────────────────────────────────────

describe("POST /api/solutions/[id]/vote", () => {
  const url = (id: string) => `http://x/api/solutions/${id}/vote`;
  const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

  it("401 unauthenticated", async () => {
    const { POST } = await import("@/app/api/solutions/[id]/vote/route");
    const res = await POST(asNextRequest(jsonRequest(url("s1"), { value: 1 })), paramsFor("s1"));
    expect(res.status).toBe(401);
  });

  it("400 invalid value", async () => {
    await loginAs({ userId: "u1" });
    const { POST } = await import("@/app/api/solutions/[id]/vote/route");
    const res = await POST(asNextRequest(jsonRequest(url("s1"), { value: 7 })), paramsFor("s1"));
    expect(res.status).toBe(400);
  });

  it("404 when solution missing", async () => {
    await loginAs({ userId: "u1" });
    mockedDal.findSolutionRowById.mockResolvedValue(null);
    const { POST } = await import("@/app/api/solutions/[id]/vote/route");
    const res = await POST(asNextRequest(jsonRequest(url("missing"), { value: 1 })), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("creates +1 vote when none exists; returns aggregate score", async () => {
    await loginAs({ userId: "u1" });
    mockedDal.findSolutionRowById.mockResolvedValue({ id: "s1" } as never);
    const raw = prismaMock as unknown as RawStub;
    // 1) lookup existing vote → none
    // 2) recompute SUM after insert → 1
    raw.$queryRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT value")) return [];
      if (sql.includes("SUM(value)")) return [{ sum: 1 }];
      return [];
    });
    raw.$executeRawUnsafe.mockResolvedValue(1);

    const { POST } = await import("@/app/api/solutions/[id]/vote/route");
    const res = await POST(asNextRequest(jsonRequest(url("s1"), { value: 1 })), paramsFor("s1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(1);
    expect(data.userVote).toBe(1);
    // INSERT + UPDATE (mirror) — two execute calls.
    expect(raw.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it("removes the vote when toggling the same direction (untoggle)", async () => {
    await loginAs({ userId: "u1" });
    mockedDal.findSolutionRowById.mockResolvedValue({ id: "s1" } as never);
    const raw = prismaMock as unknown as RawStub;
    raw.$queryRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT value")) return [{ value: 1 }];
      if (sql.includes("SUM(value)")) return [{ sum: 0 }];
      return [];
    });
    raw.$executeRawUnsafe.mockResolvedValue(1);

    const { POST } = await import("@/app/api/solutions/[id]/vote/route");
    const res = await POST(asNextRequest(jsonRequest(url("s1"), { value: 1 })), paramsFor("s1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.userVote).toBe(0);
    expect(data.score).toBe(0);
    // DELETE branch: first execute call SQL must be DELETE.
    const firstCall = raw.$executeRawUnsafe.mock.calls[0]?.[0] as string;
    expect(firstCall).toMatch(/^DELETE/);
  });

  it("flips the vote when toggling opposite direction", async () => {
    await loginAs({ userId: "u1" });
    mockedDal.findSolutionRowById.mockResolvedValue({ id: "s1" } as never);
    const raw = prismaMock as unknown as RawStub;
    raw.$queryRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT value")) return [{ value: 1 }];
      if (sql.includes("SUM(value)")) return [{ sum: -1 }];
      return [];
    });
    raw.$executeRawUnsafe.mockResolvedValue(1);

    const { POST } = await import("@/app/api/solutions/[id]/vote/route");
    const res = await POST(asNextRequest(jsonRequest(url("s1"), { value: -1 })), paramsFor("s1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.userVote).toBe(-1);
    expect(data.score).toBe(-1);
    // UPDATE branch: first execute call SQL must be UPDATE.
    const firstCall = raw.$executeRawUnsafe.mock.calls[0]?.[0] as string;
    expect(firstCall).toMatch(/^UPDATE/);
  });
});

// ── PATCH /api/solutions/[id] (owner-only) ────────────────────────────────

describe("PATCH /api/solutions/[id]", () => {
  const url = (id: string) => `http://x/api/solutions/${id}`;
  const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

  function patchReq(id: string, body: unknown) {
    return new Request(url(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("401 unauthenticated", async () => {
    const { PATCH } = await import("@/app/api/solutions/[id]/route");
    const res = await PATCH(asNextRequest(patchReq("s1", { title: "new title" })), paramsFor("s1"));
    expect(res.status).toBe(401);
  });

  it("404 when solution missing", async () => {
    await loginAs({ userId: "u1" });
    mockedDal.findSolutionRowById.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/solutions/[id]/route");
    const res = await PATCH(asNextRequest(patchReq("s1", { title: "new title" })), paramsFor("s1"));
    expect(res.status).toBe(404);
  });

  it("403 when caller is not the author (admin still cannot PATCH)", async () => {
    await loginAs({ userId: "admin", role: "admin" });
    mockedDal.findSolutionRowById.mockResolvedValue({
      id: "s1",
      userId: "someone-else",
    } as never);
    const { PATCH } = await import("@/app/api/solutions/[id]/route");
    const res = await PATCH(asNextRequest(patchReq("s1", { title: "new title" })), paramsFor("s1"));
    expect(res.status).toBe(403);
  });

  it("200 when author updates their own solution", async () => {
    await loginAs({ userId: "u1" });
    mockedDal.findSolutionRowById.mockResolvedValue({ id: "s1", userId: "u1" } as never);
    mockedDal.updateSolution.mockResolvedValue({
      id: "s1",
      userId: "u1",
      title: "Edited",
      writeup: "z".repeat(120),
    } as never);
    const { PATCH } = await import("@/app/api/solutions/[id]/route");
    const res = await PATCH(
      asNextRequest(patchReq("s1", { title: "Edited", writeup: "z".repeat(120) })),
      paramsFor("s1")
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.solution.title).toBe("Edited");
  });

  it("400 when writeup patch is < 100 chars", async () => {
    await loginAs({ userId: "u1" });
    mockedDal.findSolutionRowById.mockResolvedValue({ id: "s1", userId: "u1" } as never);
    const { PATCH } = await import("@/app/api/solutions/[id]/route");
    const res = await PATCH(
      asNextRequest(patchReq("s1", { writeup: "tiny" })),
      paramsFor("s1")
    );
    expect(res.status).toBe(400);
  });
});

// ── POST /api/problems/[slug]/solutions rate limit ────────────────────────

describe("POST /api/problems/[slug]/solutions rate limit", () => {
  const url = (slug: string) => `http://x/api/problems/${slug}/solutions`;
  const paramsFor = (slug: string) => ({ params: Promise.resolve({ slug }) });

  it("returns 429 after exceeding 3 posts in the window", async () => {
    await loginAs({ userId: "spammer" });
    prismaMock.problem.findUnique.mockResolvedValue({ id: "p1" } as never);
    prismaMock.submission.findUnique.mockResolvedValue({
      id: "sub-1",
      userId: "spammer",
      problemId: "p1",
      status: "accepted",
      language: "python",
    } as never);
    // Each successful POST consumes a token; the 4th must 429 even with
    // distinct submission ids.
    const { POST } = await import("@/app/api/problems/[slug]/solutions/route");
    let last;
    for (let i = 0; i < 4; i++) {
      last = await POST(
        asNextRequest(
          jsonRequest(url("two-sum"), {
            submissionId: `sub-${i}`,
            title: "title",
            writeup: "x".repeat(120),
          })
        ),
        paramsFor("two-sum")
      );
    }
    expect(last?.status).toBe(429);
  });
});
