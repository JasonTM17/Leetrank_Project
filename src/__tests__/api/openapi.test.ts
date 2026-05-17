import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/openapi/route";

describe("GET /api/openapi", () => {
  it("returns YAML content type", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/yaml/);
  });

  it("returns the spec body", async () => {
    const res = await GET();
    const body = await res.text();
    expect(body).toContain("openapi:");
    expect(body).toContain("LeetRank API");
  });

  it("sends a Cache-Control header", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toMatch(/max-age/);
  });
});

void prismaMock; void asNextRequest;
