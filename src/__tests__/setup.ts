import { vi, beforeEach } from "vitest";
import { cache } from "@/lib/cache";
import { _resetRateLimit } from "@/lib/rate-limit";
import { _resetAuthBuckets } from "@/lib/auth-buckets";

// Stable JWT secret across all tests so signed tokens round-trip.
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-32-chars-minimum-aaaa";
vi.stubEnv("NODE_ENV", "test");

// Per-test in-memory cookie jar so tests can act as different users
// without bleeding state across files.
const cookies = new Map<string, string>();

// Stub next-intl for component tests so useTranslations / useLocale resolve
// without a NextIntlClientProvider wrapper. Translation calls return the key
// itself, which keeps tests focused on shape/behavior, not copy.
vi.mock("next-intl", () => {
  const t = (key: string) => key;
  // The factory next-intl exports — t("namespace.key") flavor.
  const useTranslations = () => t;
  const useLocale = () => "en";
  return {
    useTranslations,
    useLocale,
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

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
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
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
  discussion: makeModel(),
  discussionComment: makeModel(),
  // Bug-sweep 2026-05: votes are queried via groupBy/aggregate from
  // discussions list + detail routes; without this mock the routes throw
  // "Cannot read properties of undefined (reading 'groupBy')" in tests.
  discussionVote: makeModel(),
  bookmark: makeModel(),
  ratingChange: makeModel(),
  dailyChallenge: makeModel(),
  dailyChallengeStreak: makeModel(),
  // Code-playback feature: SubmissionEvent rows are queried via
  // findMany / createMany from the playback routes. Stub the surface
  // so tests for those routes can drive prisma without binding to a
  // real DB.
  submissionEvent: { ...makeModel(), createMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

// Reset jar + every mock between tests.
beforeEach(() => {
  cookies.clear();
  cache.clear();
  _resetRateLimit();
  _resetAuthBuckets();
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
