import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { POST as POST_create } from "@/app/api/admin/problems/route";

describe("POST /api/admin/problems", () => {
  const valid = {
    title: "Two Sum",
    slug: "two-sum",
    description: "Find two numbers",
    difficulty: "easy",
  };

  it("403 for non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await POST_create(asNextRequest(jsonRequest("http://x/api/admin/problems", valid)));
    expect(res.status).toBe(403);
  });

  it("400 on invalid slug shape", async () => {
    await loginAs({ role: "admin" });
    const res = await POST_create(asNextRequest(jsonRequest("http://x/api/admin/problems", {
      ...valid, slug: "Two Sum!",
    })));
    expect(res.status).toBe(400);
  });

  it("400 on invalid difficulty enum", async () => {
    await loginAs({ role: "admin" });
    const res = await POST_create(asNextRequest(jsonRequest("http://x/api/admin/problems", {
      ...valid, difficulty: "expert",
    })));
    expect(res.status).toBe(400);
  });

  it("creates problem with tags + testCases on full payload", async () => {
    await loginAs({ role: "admin" });
    prismaMock.problem.create.mockResolvedValue({
      id: "p1",
      ...valid,
      tags: [],
      testCases: [],
    } as never);

    const res = await POST_create(asNextRequest(jsonRequest("http://x/api/admin/problems", {
      ...valid,
      tags: ["tag1", "tag2"],
      testCases: [{ input: "1 2", expected: "3" }],
    })));
    expect(res.status).toBe(201);
  });
});

void vi;
