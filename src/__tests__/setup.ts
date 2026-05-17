import { vi, beforeEach } from "vitest";

// Stable JWT secret across all tests so signed tokens round-trip.
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-32-chars-minimum-aaaa";
process.env.NODE_ENV = "test";

// Per-test in-memory cookie jar so tests can act as different users
// without bleeding state across files.
const cookies = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookies.set(name, value);
    },
    delete: (name: string) => {
      cookies.delete(name);
    },
  }),
}));

// Default Prisma mock — individual tests override the methods they care
// about via prismaMock.<model>.<method>.mockResolvedValue(...).
// Each model exposes the methods our routes actually call.
function makeModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  };
}

export const prismaMock = {
  user: makeModel(),
  problem: makeModel(),
  tag: makeModel(),
  testCase: makeModel(),
  submission: makeModel(),
  contest: makeModel(),
  contestProblem: makeModel(),
  contestEntry: makeModel(),
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

// Reset jar + every mock between tests.
beforeEach(() => {
  cookies.clear();
  for (const model of Object.values(prismaMock)) {
    if (typeof model === "function") {
      (model as ReturnType<typeof vi.fn>).mockReset();
      continue;
    }
    for (const fn of Object.values(model)) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  }
});

export function setCookie(name: string, value: string) {
  cookies.set(name, value);
}
