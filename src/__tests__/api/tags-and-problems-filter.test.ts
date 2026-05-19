import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET as TagsGET } from "@/app/api/tags/route";
import { GET as ProblemsGET } from "@/app/api/problems/route";

describe("GET /api/tags?category=...", () => {
  it("returns all tags when no category is supplied", async () => {
    prismaMock.tag.findMany.mockResolvedValue([
      { id: "1", name: "Array", slug: "array", category: "topic" },
      { id: "2", name: "Google", slug: "google", category: "company" },
    ]);
    const res = await TagsGET(asNextRequest(new Request("http://x/api/tags")));
    expect(res.status).toBe(200);
    expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    );
    const data = await res.json();
    expect(data.tags).toHaveLength(2);
  });

  it("filters by category=topic", async () => {
    prismaMock.tag.findMany.mockResolvedValue([
      { id: "1", name: "Array", slug: "array", category: "topic" },
    ]);
    await TagsGET(asNextRequest(new Request("http://x/api/tags?category=topic")));
    expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category: "topic" } })
    );
  });

  it("filters by category=company", async () => {
    prismaMock.tag.findMany.mockResolvedValue([]);
    await TagsGET(asNextRequest(new Request("http://x/api/tags?category=company")));
    expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category: "company" } })
    );
  });

  it("ignores unknown categories (no DB filter, falls through to all)", async () => {
    prismaMock.tag.findMany.mockResolvedValue([]);
    await TagsGET(asNextRequest(new Request("http://x/api/tags?category=evil")));
    expect(prismaMock.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    );
  });
});

describe("GET /api/problems with topic/company filters", () => {
  function setProblemsResponse() {
    prismaMock.problem.findMany.mockResolvedValue([]);
    prismaMock.problem.count.mockResolvedValue(0);
  }

  it("translates ?topic=array into a category-scoped tag filter", async () => {
    setProblemsResponse();
    await ProblemsGET(asNextRequest(new Request("http://x/api/problems?topic=array")));
    const callArgs = prismaMock.problem.findMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({
      tags: { some: { tag: { slug: "array", category: "topic" } } },
    });
  });

  it("translates ?company=google into a category-scoped tag filter", async () => {
    setProblemsResponse();
    await ProblemsGET(asNextRequest(new Request("http://x/api/problems?company=google")));
    const callArgs = prismaMock.problem.findMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({
      tags: { some: { tag: { slug: "google", category: "company" } } },
    });
  });

  it("intersects topic + company via AND when both are present", async () => {
    setProblemsResponse();
    await ProblemsGET(
      asNextRequest(new Request("http://x/api/problems?topic=array&company=google"))
    );
    const callArgs = prismaMock.problem.findMany.mock.calls[0][0];
    expect(callArgs.where.AND).toEqual([
      { tags: { some: { tag: { slug: "array", category: "topic" } } } },
      { tags: { some: { tag: { slug: "google", category: "company" } } } },
    ]);
  });

  it("still honours the legacy ?tag= param without a category", async () => {
    setProblemsResponse();
    await ProblemsGET(asNextRequest(new Request("http://x/api/problems?tag=hash-table")));
    const callArgs = prismaMock.problem.findMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({
      tags: { some: { tag: { slug: "hash-table" } } },
    });
    // No category clause when only the legacy param is present.
    expect(callArgs.where.tags.some.tag.category).toBeUndefined();
  });
});
