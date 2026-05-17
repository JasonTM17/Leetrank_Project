import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/contests/[slug]/route";

function paramsFor(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("GET /api/contests/[slug]", () => {
  it("returns 404 for unknown slug", async () => {
    prismaMock.contest.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/contests/missing")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("returns the contest with embedded problems", async () => {
    prismaMock.contest.findUnique.mockResolvedValue({
      id: "c1",
      title: "Spring Cup",
      slug: "spring-cup",
      description: "kickoff",
      startTime: new Date("2026-05-01T10:00:00Z"),
      endTime: new Date("2026-05-01T12:00:00Z"),
      status: "upcoming",
      problems: [
        {
          order: 0,
          points: 100,
          problem: {
            id: "p1",
            title: "Two Sum",
            slug: "two-sum",
            difficulty: "easy",
            tags: [{ tag: { id: "t1", name: "Array", slug: "array" } }],
          },
        },
      ],
    } as never);

    const res = await GET(asNextRequest(new Request("http://x/api/contests/spring-cup")), paramsFor("spring-cup"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contest.slug).toBe("spring-cup");
    expect(data.contest.problems).toHaveLength(1);
    expect(data.contest.problems[0].slug).toBe("two-sum");
    expect(data.contest.problems[0].points).toBe(100);
  });
});
