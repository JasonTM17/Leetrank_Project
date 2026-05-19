import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  runCodeSchema,
  submitCodeSchema,
  createProblemSchema,
} from "@/lib/validations";

describe("registerSchema", () => {
  it("accepts valid input", () => {
    const result = registerSchema.safeParse({
      username: "john_doe",
      email: "john@example.com",
      password: "secure123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short username", () => {
    const result = registerSchema.safeParse({
      username: "ab",
      email: "john@example.com",
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects username with special characters", () => {
    const result = registerSchema.safeParse({
      username: "<script>alert(1)</script>",
      email: "john@example.com",
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      username: "john_doe",
      email: "not-an-email",
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = registerSchema.safeParse({
      username: "john_doe",
      email: "john@example.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid input", () => {
    const result = loginSchema.safeParse({
      email: "john@example.com",
      password: "secure123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "invalid",
      password: "secure123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "john@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("runCodeSchema", () => {
  it("accepts valid input", () => {
    const result = runCodeSchema.safeParse({
      code: "print('hello')",
      language: "python",
      testCases: [{ input: "", expected: "hello" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported language", () => {
    const result = runCodeSchema.safeParse({
      code: "print('hello')",
      language: "cobol",
      testCases: [{ input: "", expected: "hello" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty code", () => {
    const result = runCodeSchema.safeParse({
      code: "",
      language: "python",
      testCases: [{ input: "", expected: "hello" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty testCases array (stdin-only run)", () => {
    const result = runCodeSchema.safeParse({
      code: "print('hello')",
      language: "python",
      testCases: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("submitCodeSchema", () => {
  it("accepts valid input", () => {
    const result = submitCodeSchema.safeParse({
      code: "def solve(): pass",
      language: "python",
      problemId: "abc123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing problemId", () => {
    const result = submitCodeSchema.safeParse({
      code: "def solve(): pass",
      language: "python",
      problemId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("createProblemSchema", () => {
  it("accepts valid input", () => {
    const result = createProblemSchema.safeParse({
      title: "Two Sum",
      slug: "two-sum",
      description: "Find two numbers that add up to target",
      difficulty: "easy",
      tags: ["array", "hash-table"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid slug format", () => {
    const result = createProblemSchema.safeParse({
      title: "Two Sum",
      slug: "Two Sum!",
      description: "Find two numbers",
      difficulty: "easy",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid difficulty", () => {
    const result = createProblemSchema.safeParse({
      title: "Two Sum",
      slug: "two-sum",
      description: "Find two numbers",
      difficulty: "extreme",
    });
    expect(result.success).toBe(false);
  });
});
