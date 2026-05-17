import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be at most 128 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createProblemSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: z.string().min(1, "Slug is required").max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens"),
  description: z.string().min(1, "Description is required"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  constraints: z.string().optional().default(""),
  hints: z.string().optional().default(""),
  starterCode: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
});

export const runCodeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  language: z.enum(["python", "javascript", "go", "ruby"]),
  testCases: z.array(z.object({
    input: z.string(),
    expected: z.string(),
  })).min(1, "At least one test case is required"),
});

export const submitCodeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  language: z.enum(["python", "javascript", "go", "ruby"]),
  problemId: z.string().min(1, "Problem ID is required"),
});
