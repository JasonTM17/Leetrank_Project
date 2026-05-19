import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "../setup";
import { GET } from "@/app/api/tags/route";

describe("GET /api/tags", () => {
  it("returns sorted tags", async () => {
    prismaMock.tag.findMany.mockResolvedValue([
      { id: "1", name: "Array", slug: "array" },
      { id: "2", name: "DP", slug: "dp" },
    ] as never);

    const res = await GET(new NextRequest("http://localhost/api/tags"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags).toHaveLength(2);
  });

  it("returns empty array on db error (graceful degradation)", async () => {
    prismaMock.tag.findMany.mockRejectedValue(new Error("db down"));

    const res = await GET(new NextRequest("http://localhost/api/tags"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags).toEqual([]);
  });
});
