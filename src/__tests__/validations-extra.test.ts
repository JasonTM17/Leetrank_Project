import { describe, it, expect } from "vitest";
import {
  createContestSchema,
  updateProblemSchema,
  createProblemSchema,
} from "@/lib/validations";

describe("createContestSchema", () => {
  it("accepts a valid contest", () => {
    const result = createContestSchema.safeParse({
      title: "Spring Cup",
      slug: "spring-cup",
      startTime: "2026-04-01T10:00:00Z",
      endTime: "2026-04-01T12:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects endTime before startTime", () => {
    const result = createContestSchema.safeParse({
      title: "Reverse Cup",
      slug: "reverse-cup",
      startTime: "2026-04-01T12:00:00Z",
      endTime: "2026-04-01T10:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-ISO timestamps", () => {
    const result = createContestSchema.safeParse({
      title: "Bad Time Cup",
      slug: "bad-time",
      startTime: "yesterday",
      endTime: "today",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid slug", () => {
    const result = createContestSchema.safeParse({
      title: "Slug Cup",
      slug: "Spring Cup!",
      startTime: "2026-04-01T10:00:00Z",
      endTime: "2026-04-01T12:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("defaults status to upcoming", () => {
    const result = createContestSchema.safeParse({
      title: "Default Cup",
      slug: "default-cup",
      startTime: "2026-04-01T10:00:00Z",
      endTime: "2026-04-01T12:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("upcoming");
  });
});

describe("updateProblemSchema", () => {
  it("accepts a partial update", () => {
    const result = updateProblemSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
  });

  it("accepts an empty body (no-op)", () => {
    const result = updateProblemSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects an invalid difficulty", () => {
    const result = updateProblemSchema.safeParse({ difficulty: "easyish" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid slug shape", () => {
    const result = updateProblemSchema.safeParse({ slug: "Two Sum!" });
    expect(result.success).toBe(false);
  });

  it("rejects negative order", () => {
    const result = updateProblemSchema.safeParse({ order: -1 });
    expect(result.success).toBe(false);
  });
});

describe("createProblemSchema with testCases", () => {
  it("accepts nested test cases", () => {
    const result = createProblemSchema.safeParse({
      title: "Sum",
      slug: "sum",
      description: "Sum two numbers",
      difficulty: "easy",
      testCases: [
        { input: "1 2", expected: "3" },
        { input: "5 5", expected: "10", isHidden: true, order: 1 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.testCases).toHaveLength(2);
  });
});
