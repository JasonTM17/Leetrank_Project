import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/problems/random/route";

describe("GET /api/problems/random", () => {
  it("returns 404 when no problems exist", async () => {
    prismaMock.problem.count.mockResolvedValue(0);
    const res = await GET(asNextRequest(new Request("http://x/api/problems/random")));
    expect(res.status).toBe(404);
  });

  it("returns a single problem", async () => {
    prismaMock.problem.count.mockResolvedValue(50);
    prismaMock.problem.findMany.mockResolvedValue([
      { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/problems/random")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.problem.slug).toBe("two-sum");

    const args = prismaMock.problem.findMany.mock.calls[0]?.[0];
    expect(args?.take).toBe(1);
  });

  it("filters by difficulty when provided", async () => {
    prismaMock.problem.count.mockResolvedValue(10);
    prismaMock.problem.findMany.mockResolvedValue([
      { id: "p1", title: "Hard Problem", slug: "hp", difficulty: "hard" },
    ] as never);

    await GET(asNextRequest(new Request("http://x/api/problems/random?difficulty=hard")));

    const countArgs = prismaMock.problem.count.mock.calls[0]?.[0];
    expect(countArgs?.where?.difficulty).toBe("hard");
    const findArgs = prismaMock.problem.findMany.mock.calls[0]?.[0];
    expect(findArgs?.where?.difficulty).toBe("hard");
  });

  it("returns 500 on db error", async () => {
    prismaMock.problem.count.mockRejectedValue(new Error("db down"));
    const res = await GET(asNextRequest(new Request("http://x/api/problems/random")));
    expect(res.status).toBe(500);
  });
});
