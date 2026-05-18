// Env vars MUST be set before any module import so env.ts parseEnv() succeeds.
process.env["NODE_ENV"] = "test";
process.env["DATABASE_URL"] = "postgresql://x:y@localhost:5432/test";
process.env["JWT_SECRET"] = "test-secret-32-chars-minimum-aaaa";
process.env["CORS_ALLOWED_ORIGINS"] = "";

import { vi, beforeEach } from "vitest";

vi.mock("../db.js", () => {
  const makeCrud = () => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  });

  const prisma = {
    problem: makeCrud(),
    tag: makeCrud(),
    contest: makeCrud(),
    submission: makeCrud(),
    user: makeCrud(),
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };

  return { prisma };
});

// Clear call history between tests but keep mock implementations intact
// so $queryRaw keeps its default resolved value.
beforeEach(() => {
  vi.clearAllMocks();
});
