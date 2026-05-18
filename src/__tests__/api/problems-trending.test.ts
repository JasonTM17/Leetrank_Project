import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/problems/trending/route";

describe("GET /api/problems/trending", () => {
  it("returns empty array when no recent acceptance", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([] as never);
    const res = await GET(asNextRequest(new Request("http://x/api/problems/trending")));
    const data = await res.json();
    expect(data.problems).toEqual([]);
  });

  it("ranks problems by recent acceptance count", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([
      { problemId: "p1", _count: { _all: 50 } },
      { problemId: "p2", _count: { _all: 30 } },
    ] as never);
    prismaMock.problem.findMany.mockResolvedValue([
      { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
      { id: "p2", title: "Reverse List", slug: "reverse-list", difficulty: "easy" },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/problems/trending")));
    const data = await res.json();
    expect(data.problems).toHaveLength(2);
    expect(data.problems[0].slug).toBe("two-sum");
    expect(data.problems[0].recentAccepted).toBe(50);
  });

  it("clamps limit to 30", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([] as never);
    await GET(asNextRequest(new Request("http://x/api/problems/trending?limit=999")));
    const args = prismaMock.submission.groupBy.mock.calls[0]?.[0];
    expect(args?.take).toBe(30);
  });

  it("returns 500 on db error", async () => {
    prismaMock.submission.groupBy.mockRejectedValue(new Error("db down"));
    const res = await GET(asNextRequest(new Request("http://x/api/problems/trending")));
    expect(res.status).toBe(500);
  });
});
