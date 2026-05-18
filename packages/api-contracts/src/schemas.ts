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

/* -------------------------------------------------------------------------- */
/*  GET /problems (list)                                                       */
/* -------------------------------------------------------------------------- */

export const problemListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  difficulty: difficultyEnum,
  tags: z.array(tagSchema),
  submissionCount: z.number().int().nonnegative(),
});
export type ProblemListItem = z.infer<typeof problemListItemSchema>;

export const problemListResponseSchema = z.object({
  problems: z.array(problemListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type ProblemListResponse = z.infer<typeof problemListResponseSchema>;

export const problemListQuerySchema = z.object({
  difficulty: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type ProblemListQuery = z.infer<typeof problemListQuerySchema>;

/* -------------------------------------------------------------------------- */
/*  GET /problems/:slug (detail)                                               */
/* -------------------------------------------------------------------------- */

export const testCaseSchema = z.object({
  id: z.string(),
  input: z.string(),
  expected: z.string(),
  isHidden: z.boolean(),
  order: z.number().int(),
});
export type TestCase = z.infer<typeof testCaseSchema>;

export const problemDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  difficulty: difficultyEnum,
  constraints: z.string().nullable(),
  hints: z.string().nullable(),
  editorial: z.string().nullable(),
  starterCode: z.string().nullable(),
  tags: z.array(tagSchema),
  testCases: z.array(testCaseSchema),
});
export type ProblemDetail = z.infer<typeof problemDetailSchema>;

export const problemDetailResponseSchema = z.object({
  problem: problemDetailSchema,
});
export type ProblemDetailResponse = z.infer<typeof problemDetailResponseSchema>;

/* -------------------------------------------------------------------------- */
/*  GET /problems/trending                                                     */
/* -------------------------------------------------------------------------- */

export const trendingProblemSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  difficulty: difficultyEnum,
  recentAccepted: z.number().int().nonnegative(),
});
export type TrendingProblem = z.infer<typeof trendingProblemSchema>;

export const trendingResponseSchema = z.object({
  problems: z.array(trendingProblemSchema),
});
export type TrendingResponse = z.infer<typeof trendingResponseSchema>;

/* -------------------------------------------------------------------------- */
/*  GET /problems/random                                                       */
/* -------------------------------------------------------------------------- */

export const randomProblemResponseSchema = z.object({
  problem: problemSummarySchema,
});
export type RandomProblemResponse = z.infer<typeof randomProblemResponseSchema>;

/* -------------------------------------------------------------------------- */
/*  GET /contests (list)                                                       */
/* -------------------------------------------------------------------------- */

export const contestSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  status: contestStatusEnum,
});
export type Contest = z.infer<typeof contestSchema>;

export const contestsListResponseSchema = z.object({
  contests: z.array(contestSchema),
});
export type ContestsListResponse = z.infer<typeof contestsListResponseSchema>;

export const contestWithCountsSchema = contestSchema.extend({
  _count: z.object({
    entries: z.number().optional(),
    problems: z.number(),
  }),
});
export type ContestWithCounts = z.infer<typeof contestWithCountsSchema>;

export const contestsWithCountsResponseSchema = z.object({
  contests: z.array(contestWithCountsSchema),
});
export type ContestsWithCountsResponse = z.infer<typeof contestsWithCountsResponseSchema>;

/* -------------------------------------------------------------------------- */
/*  GET /contests/:slug (detail)                                               */
/* -------------------------------------------------------------------------- */

export const contestProblemEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  difficulty: difficultyEnum,
  points: z.number().int(),
  order: z.number().int(),
  tags: z.array(tagSchema),
});
export type ContestProblemEntry = z.infer<typeof contestProblemEntrySchema>;

export const contestDetailSchema = contestSchema.extend({
  problems: z.array(contestProblemEntrySchema),
});
export type ContestDetail = z.infer<typeof contestDetailSchema>;

export const contestDetailResponseSchema = z.object({
  contest: contestDetailSchema,
});
export type ContestDetailResponse = z.infer<typeof contestDetailResponseSchema>;

/* -------------------------------------------------------------------------- */
/*  GET /tags/:slug                                                            */
/* -------------------------------------------------------------------------- */

export const tagProblemSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  difficulty: difficultyEnum,
  _count: z.object({
    submissions: z.number().int().nonnegative(),
  }),
});
export type TagProblemSummary = z.infer<typeof tagProblemSummarySchema>;

export const tagDetailResponseSchema = z.object({
  tag: tagSchema,
  problems: z.array(tagProblemSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type TagDetailResponse = z.infer<typeof tagDetailResponseSchema>;

/* -------------------------------------------------------------------------- */
/*  GET /stats                                                                 */
/* -------------------------------------------------------------------------- */

export const statsResponseSchema = z.object({
  problems: z.number().int().nonnegative(),
  contests: z.number().int().nonnegative(),
  users: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
});
export type StatsResponse = z.infer<typeof statsResponseSchema>;
