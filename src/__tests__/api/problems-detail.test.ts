import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/problems/[slug]/route";

function paramsFor(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("GET /api/problems/[slug]", () => {
  it("returns 404 when slug is unknown", async () => {
    prismaMock.problem.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/problems/missing")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("returns the problem with only public test cases", async () => {
    prismaMock.problem.findUnique.mockResolvedValue({
      id: "p1",
      title: "Two Sum",
      slug: "two-sum",
      description: "Find two numbers...",
      difficulty: "easy",
      hints: null,
      editorial: null,
      constraints: null,
      starterCode: null,
      tags: [{ tag: { id: "t1", name: "Array", slug: "array" } }],
      testCases: [
        { id: "tc1", input: "1 2", expected: "3", isHidden: false, order: 0 },
      ],
    } as never);

    const res = await GET(asNextRequest(new Request("http://x/api/problems/two-sum")), paramsFor("two-sum"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.problem.slug).toBe("two-sum");
    expect(data.problem.testCases).toHaveLength(1);
    // Verify the prisma call asked for non-hidden tests only.
    const args = prismaMock.problem.findUnique.mock.calls[0]?.[0];
    expect(args?.include?.testCases?.where?.isHidden).toBe(false);
  });
});
