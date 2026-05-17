import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  createProblemSchema,
  updateProblemSchema,
  createContestSchema,
  createDiscussionSchema,
  createCommentSchema,
} from "@/lib/validations";

describe("registerSchema boundaries", () => {
  it("accepts a 30-char username (max length)", () => {
    const result = registerSchema.safeParse({
      username: "a".repeat(30),
      email: "a@example.com",
      password: "secure123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a 31-char username", () => {
    const result = registerSchema.safeParse({
      username: "a".repeat(31),
      email: "a@example.com",
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a 5-char password", () => {
    const result = registerSchema.safeParse({
      username: "alice",
      email: "a@example.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a 6-char password (min length)", () => {
    const result = registerSchema.safeParse({
      username: "alice",
      email: "a@example.com",
      password: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a 128-char password (max length)", () => {
    const result = registerSchema.safeParse({
      username: "alice",
      email: "a@example.com",
      password: "a".repeat(128),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a 129-char password", () => {
    const result = registerSchema.safeParse({
      username: "alice",
      email: "a@example.com",
      password: "a".repeat(129),
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("rejects empty email", () => {
    const r = loginSchema.safeParse({ email: "", password: "x" });
    expect(r.success).toBe(false);
  });
});

describe("createProblemSchema defaults", () => {
  it("populates default values for omitted optional fields", () => {
    const r = createProblemSchema.safeParse({
      title: "X",
      slug: "x",
      description: "d",
      difficulty: "easy",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.constraints).toBe("");
      expect(r.data.hints).toBe("");
      expect(r.data.editorial).toBe("");
      expect(r.data.starterCode).toBe("");
      expect(r.data.tags).toEqual([]);
      expect(r.data.testCases).toEqual([]);
      expect(r.data.order).toBe(0);
    }
  });
});

describe("updateProblemSchema", () => {
  it("accepts every field independently", () => {
    expect(updateProblemSchema.safeParse({ title: "x" }).success).toBe(true);
    expect(updateProblemSchema.safeParse({ description: "d" }).success).toBe(true);
    expect(updateProblemSchema.safeParse({ constraints: "c" }).success).toBe(true);
    expect(updateProblemSchema.safeParse({ hints: "h" }).success).toBe(true);
    expect(updateProblemSchema.safeParse({ editorial: "e" }).success).toBe(true);
    expect(updateProblemSchema.safeParse({ starterCode: "s" }).success).toBe(true);
  });
});

describe("createContestSchema", () => {
  it("rejects identical start and end times", () => {
    const r = createContestSchema.safeParse({
      title: "T",
      slug: "t",
      startTime: "2026-04-01T10:00:00Z",
      endTime: "2026-04-01T10:00:00Z",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a status override", () => {
    const r = createContestSchema.safeParse({
      title: "T",
      slug: "t",
      startTime: "2026-04-01T10:00:00Z",
      endTime: "2026-04-01T11:00:00Z",
      status: "active",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("active");
  });
});

describe("createDiscussionSchema boundaries", () => {
  it("rejects a 2-char title", () => {
    const r = createDiscussionSchema.safeParse({
      problemId: "p1", title: "ab", body: "x",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a 200-char title and 10000-char body (max)", () => {
    const r = createDiscussionSchema.safeParse({
      problemId: "p1",
      title: "a".repeat(200),
      body: "b".repeat(10_000),
    });
    expect(r.success).toBe(true);
  });

  it("rejects a 201-char title", () => {
    const r = createDiscussionSchema.safeParse({
      problemId: "p1", title: "a".repeat(201), body: "x",
    });
    expect(r.success).toBe(false);
  });
});

describe("createCommentSchema boundaries", () => {
  it("accepts a 5000-char body (max)", () => {
    const r = createCommentSchema.safeParse({ body: "a".repeat(5000) });
    expect(r.success).toBe(true);
  });

  it("rejects a 5001-char body", () => {
    const r = createCommentSchema.safeParse({ body: "a".repeat(5001) });
    expect(r.success).toBe(false);
  });

  it("rejects empty body", () => {
    const r = createCommentSchema.safeParse({ body: "" });
    expect(r.success).toBe(false);
  });
});
