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
    $queryRaw: vi.fn(),
    $disconnect: vi.fn(),
  };

  return { prisma };
});

import { prisma } from "../db.js";

// Reset implementations between tests AND re-arm $queryRaw + $disconnect
// defaults so /readyz stays healthy unless a test overrides explicitly.
// (vi.clearAllMocks() wipes implementations set in the factory above; we
// have to re-apply defaults here.)
beforeEach(() => {
  vi.resetAllMocks();
  const p = prisma as unknown as {
    $queryRaw: ReturnType<typeof vi.fn>;
    $disconnect: ReturnType<typeof vi.fn>;
  };
  p.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  p.$disconnect.mockResolvedValue(undefined);
});
