import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Primitives                                                                 */
/* -------------------------------------------------------------------------- */

export const difficultyEnum = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultyEnum>;

export const roleEnum = z.enum(["user", "admin"]);
export type Role = z.infer<typeof roleEnum>;

export const contestStatusEnum = z.enum(["upcoming", "active", "ended"]);
export type ContestStatus = z.infer<typeof contestStatusEnum>;

export const submissionStatusEnum = z.enum([
  "accepted",
  "wrong_answer",
  "runtime_error",
  "time_limit_exceeded",
]);
export type SubmissionStatus = z.infer<typeof submissionStatusEnum>;

export const languageEnum = z.enum([
  "python", "javascript", "typescript", "ruby", "php", "bash",
  "go", "rust", "c", "cpp", "java", "kotlin", "csharp", "swift", "sql",
]);
export type Language = z.infer<typeof languageEnum>;

/* -------------------------------------------------------------------------- */
/*  Resources                                                                 */
/* -------------------------------------------------------------------------- */

export const publicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  avatar: z.string().nullable(),
  bio: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const tagSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type Tag = z.infer<typeof tagSchema>;

export const problemSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  difficulty: difficultyEnum,
});
export type ProblemSummary = z.infer<typeof problemSummarySchema>;

export const leaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  user: publicUserSchema.pick({ id: true, username: true, avatar: true }),
  solved: z.number().int().nonnegative(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

/* -------------------------------------------------------------------------- */
/*  Endpoint envelopes                                                         */
/* -------------------------------------------------------------------------- */

export const leaderboardTopResponseSchema = z.object({
  leaderboard: z.array(leaderboardEntrySchema),
});

export const tagsResponseSchema = z.object({
  tags: z.array(tagSchema),
});

export const errorResponseSchema = z.object({
  error: z.string(),
});

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  service: z.string().optional(),
  timestamp: z.string(),
});
