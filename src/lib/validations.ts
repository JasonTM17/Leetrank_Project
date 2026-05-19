import { z } from "zod";
import { LANGUAGE_IDS } from "@/lib/languages";

const languageEnum = z.enum(LANGUAGE_IDS as [string, ...string[]]);

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

const slugRegex = /^[a-z0-9-]+$/;
const difficultyEnum = z.enum(["easy", "medium", "hard"]);

const testCaseSchema = z.object({
  input: z.string(),
  expected: z.string(),
  isHidden: z.boolean().optional(),
  order: z.number().int().nonnegative().optional(),
});

export const createProblemSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: z.string().min(1, "Slug is required").max(200).regex(slugRegex, "Slug must be lowercase with hyphens"),
  description: z.string().min(1, "Description is required"),
  difficulty: difficultyEnum,
  constraints: z.string().optional().default(""),
  hints: z.string().optional().default(""),
  editorial: z.string().optional().default(""),
  starterCode: z.string().optional().default(""),
  order: z.number().int().nonnegative().optional().default(0),
  tags: z.array(z.string()).optional().default([]),
  testCases: z.array(testCaseSchema).optional().default([]),
});

export const updateProblemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(slugRegex).optional(),
  description: z.string().min(1).optional(),
  difficulty: difficultyEnum.optional(),
  constraints: z.string().optional(),
  hints: z.string().optional(),
  editorial: z.string().optional(),
  starterCode: z.string().optional(),
  order: z.number().int().nonnegative().optional(),
});

export const createContestSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    slug: z.string().min(1).max(200).regex(slugRegex, "Slug must be lowercase with hyphens"),
    description: z.string().optional().default(""),
    startTime: z.string().datetime({ message: "startTime must be ISO 8601" }),
    endTime: z.string().datetime({ message: "endTime must be ISO 8601" }),
    status: z.enum(["upcoming", "active", "ended"]).optional().default("upcoming"),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const runCodeSchema = z.object({
  code: z.string().min(1, "code is required"),
  language: languageEnum,
  // testCases is optional — when omitted (or empty) the runner falls back
  // to a single stdin-only run with empty input/expected, which matches the
  // editor "Run" button that doesn't have testcases on hand.
  testCases: z
    .array(
      z.object({
        input: z.string(),
        expected: z.string(),
      })
    )
    .optional(),
});

export const submitCodeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  language: languageEnum,
  problemId: z.string().min(1, "Problem ID is required"),
});

export const createDiscussionSchema = z.object({
  problemId: z.string().min(1, "Problem ID is required"),
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title too long"),
  body: z.string().min(1, "Body is required").max(10_000, "Body too long"),
});

export const createCommentSchema = z.object({
  body: z.string().min(1, "Body is required").max(5_000, "Body too long"),
});

export function firstZodError(error: { errors: Array<{ message: string }> }): string {
  return error.errors[0]?.message ?? "Invalid input";
}
