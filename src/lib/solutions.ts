// Shared-solutions data-access layer. Wraps raw SQL so the feature ships
// without a Prisma client regenerate (schema.prisma is locked by another
// agent during this work). When the SharedSolution model lands in
// schema.prisma the call sites can swap to `prisma.sharedSolution.*`
// without changing the rest of the code or tests.
//
// Tables: SharedSolution, SharedSolutionVote — see
// prisma/migrations/20260526000000_shared_solutions/migration.sql.

import { prisma } from "@/lib/db";
import crypto from "node:crypto";

export interface SolutionAuthor {
  id: string;
  username: string;
  avatar: string | null;
}

export interface SolutionRow {
  id: string;
  problemId: string;
  userId: string;
  submissionId: string;
  title: string;
  writeup: string;
  language: string;
  voteCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SolutionWithAuthor extends SolutionRow {
  author: SolutionAuthor;
  userVote?: number;
}

function newId(): string {
  // cuid-ish fallback that works without the cuid dep — random 24-char
  // identifier prefixed with `s_` so logs visibly tag shared-solution rows.
  return "s_" + crypto.randomBytes(12).toString("hex");
}

// Test seam: vitest mocks @/lib/db whose prisma exposes $queryRaw +
// $executeRaw + $transaction. We dispatch through these helpers so tests
// can stub a single method per assertion without standing up Postgres.

type RawClient = {
  $queryRawUnsafe: (sql: string, ...args: unknown[]) => Promise<unknown[]>;
  $executeRawUnsafe: (sql: string, ...args: unknown[]) => Promise<number>;
};

function raw(): RawClient {
  return prisma as unknown as RawClient;
}

export async function findSolutionById(id: string): Promise<SolutionWithAuthor | null> {
  const rows = (await raw().$queryRawUnsafe(
    `SELECT s.*, u.id AS author_id, u.username AS author_username, u.avatar AS author_avatar
     FROM "SharedSolution" s JOIN "User" u ON u.id = s."userId"
     WHERE s.id = $1 LIMIT 1`,
    id
  )) as Array<SolutionRow & { author_id: string; author_username: string; author_avatar: string | null }>;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    problemId: r.problemId,
    userId: r.userId,
    submissionId: r.submissionId,
    title: r.title,
    writeup: r.writeup,
    language: r.language,
    voteCount: Number(r.voteCount ?? 0),
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    author: {
      id: r.author_id,
      username: r.author_username,
      avatar: r.author_avatar,
    },
  };
}

export interface ListOptions {
  problemId: string;
  sort: "top" | "new";
  page: number;
  limit: number;
}

export async function listSolutions(opts: ListOptions): Promise<{
  items: SolutionWithAuthor[];
  total: number;
}> {
  const orderBy =
    opts.sort === "top"
      ? `s."voteCount" DESC, s."createdAt" DESC`
      : `s."createdAt" DESC`;

  const offset = (opts.page - 1) * opts.limit;

  const rows = (await raw().$queryRawUnsafe(
    `SELECT s.*, u.id AS author_id, u.username AS author_username, u.avatar AS author_avatar
     FROM "SharedSolution" s JOIN "User" u ON u.id = s."userId"
     WHERE s."problemId" = $1
     ORDER BY ${orderBy}
     LIMIT $2 OFFSET $3`,
    opts.problemId,
    opts.limit,
    offset
  )) as Array<SolutionRow & { author_id: string; author_username: string; author_avatar: string | null }>;

  const totalRows = (await raw().$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "SharedSolution" WHERE "problemId" = $1`,
    opts.problemId
  )) as Array<{ n: number }>;

  return {
    items: rows.map((r) => ({
      id: r.id,
      problemId: r.problemId,
      userId: r.userId,
      submissionId: r.submissionId,
      title: r.title,
      writeup: r.writeup,
      language: r.language,
      voteCount: Number(r.voteCount ?? 0),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      author: {
        id: r.author_id,
        username: r.author_username,
        avatar: r.author_avatar,
      },
    })),
    total: Number(totalRows[0]?.n ?? 0),
  };
}

export interface CreateSolutionInput {
  problemId: string;
  userId: string;
  submissionId: string;
  title: string;
  writeup: string;
  language: string;
}

/** Throws when submissionId is already used (UNIQUE violation surfaces). */
export async function createSolution(input: CreateSolutionInput): Promise<SolutionRow> {
  const id = newId();
  const rows = (await raw().$queryRawUnsafe(
    `INSERT INTO "SharedSolution"
       (id, "problemId", "userId", "submissionId", title, writeup, language)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    id,
    input.problemId,
    input.userId,
    input.submissionId,
    input.title,
    input.writeup,
    input.language
  )) as SolutionRow[];
  return rows[0]!;
}

export async function updateSolution(
  id: string,
  patch: { title?: string; writeup?: string }
): Promise<SolutionRow | null> {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.title !== undefined) {
    args.push(patch.title);
    sets.push(`title = $${args.length}`);
  }
  if (patch.writeup !== undefined) {
    args.push(patch.writeup);
    sets.push(`writeup = $${args.length}`);
  }
  if (!sets.length) return findSolutionRowById(id);
  sets.push(`"updatedAt" = NOW()`);
  args.push(id);
  const rows = (await raw().$queryRawUnsafe(
    `UPDATE "SharedSolution" SET ${sets.join(", ")} WHERE id = $${args.length} RETURNING *`,
    ...args
  )) as SolutionRow[];
  return rows[0] ?? null;
}

export async function deleteSolution(id: string): Promise<boolean> {
  const n = await raw().$executeRawUnsafe(
    `DELETE FROM "SharedSolution" WHERE id = $1`,
    id
  );
  return Number(n) > 0;
}

export async function findSolutionRowById(id: string): Promise<SolutionRow | null> {
  const rows = (await raw().$queryRawUnsafe(
    `SELECT * FROM "SharedSolution" WHERE id = $1 LIMIT 1`,
    id
  )) as SolutionRow[];
  return rows[0] ?? null;
}
