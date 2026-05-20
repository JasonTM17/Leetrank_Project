/**
 * Seed fake users and submission history for load / demo testing.
 *
 * Generates USER_COUNT users with randomized profiles and
 * SUBS_PER_USER_AVG submissions per user (Poisson-distributed).
 *
 * Run:
 *   pnpm seed:users
 *   USER_COUNT=1000 SUBS_PER_USER_AVG=30 pnpm seed:users
 *
 * Or directly:
 *   DATABASE_URL="postgresql://leetrank:leetrank-dev@localhost:15432/leetrank" \
 *   USER_COUNT=500 SUBS_PER_USER_AVG=20 \
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-users-submissions.ts
 *
 * Uses chunked transactions (500 per batch) to keep memory bounded.
 * Deterministic PRNG so re-runs produce identical data.
 */

import { PrismaClient } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// ─── Config ──────────────────────────────────────────────────────────────────

const USER_COUNT = parseInt(process.env.USER_COUNT ?? "500", 10);
const SUBS_PER_USER_AVG = parseInt(process.env.SUBS_PER_USER_AVG ?? "20", 10);
const CHUNK = 500;
const RNG_SEED = 0xfade_cafe;

// ─── Deterministic PRNG (Mulberry32) ─────────────────────────────────────────

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ─── Name pools ──────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Alex",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Quinn",
  "Avery",
  "Harper",
  "Skyler",
  "Dakota",
  "Reese",
  "Finley",
  "Rowan",
  "Sage",
  "Blake",
  "Cameron",
  "Drew",
  "Emery",
  "Hayden",
  "Jamie",
  "Kendall",
  "Logan",
  "Micah",
  "Noel",
  "Parker",
  "River",
  "Shawn",
  "Tatum",
  "Val",
  "Wren",
  "Zion",
  "Aiden",
  "Bella",
  "Caleb",
  "Diana",
  "Ethan",
  "Fiona",
  "Gavin",
  "Hannah",
  "Isaac",
  "Julia",
  "Kevin",
  "Luna",
  "Mason",
  "Nina",
  "Oscar",
  "Priya",
] as const;

const LAST_NAMES = [
  "Chen",
  "Kim",
  "Patel",
  "Garcia",
  "Nguyen",
  "Smith",
  "Lee",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Davis",
  "Miller",
  "Wilson",
  "Moore",
  "Taylor",
  "Anderson",
  "Thomas",
  "Jackson",
  "White",
  "Harris",
  "Martin",
  "Thompson",
  "Robinson",
  "Clark",
  "Lewis",
  "Walker",
  "Hall",
  "Allen",
  "Young",
  "King",
  "Wright",
  "Lopez",
  "Hill",
  "Scott",
  "Green",
  "Adams",
  "Baker",
  "Nelson",
  "Carter",
  "Mitchell",
  "Perez",
  "Roberts",
  "Turner",
  "Phillips",
  "Campbell",
  "Parker",
  "Evans",
  "Edwards",
  "Collins",
  "Stewart",
  "Sanchez",
  "Morris",
] as const;

// ─── Submission constants ────────────────────────────────────────────────────

const STATUSES = [
  "ACCEPTED",
  "WRONG_ANSWER",
  "TIME_LIMIT_EXCEEDED",
  "RUNTIME_ERROR",
  "COMPILE_ERROR",
  "PENDING",
] as const;

// Cumulative distribution: AC 45%, WA 30%, TLE 10%, RE 8%, CE 5%, PENDING 2%
const STATUS_CDF = [0.45, 0.75, 0.85, 0.93, 0.98, 1.0];

function pickStatus(rng: () => number): string {
  const r = rng();
  for (let i = 0; i < STATUS_CDF.length; i++) {
    if (r < STATUS_CDF[i]!) return STATUSES[i]!;
  }
  return "PENDING";
}

const LANGUAGES = ["python", "javascript", "typescript", "go", "java", "cpp"] as const;

const CODE_SNIPPETS: Record<string, string> = {
  python:
    "def solve(nums):\n    return sum(nums)\n\nprint(solve(list(map(int, input().split()))))\n",
  javascript: "function solve(nums) {\n  return nums.reduce((a, b) => a + b, 0);\n}\n",
  typescript:
    "function solve(nums: number[]): number {\n  return nums.reduce((a, b) => a + b, 0);\n}\n",
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hello")\n}\n',
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("hello");\n  }\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\nint main() {\n  cout << "hello" << endl;\n  return 0;\n}\n',
};

// ─── Roles ───────────────────────────────────────────────────────────────────

function pickRole(rng: () => number): string {
  const r = rng();
  if (r < 0.01) return "admin";
  if (r < 0.05) return "moderator";
  return "user";
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seed users+submissions: ${USER_COUNT} users, ~${SUBS_PER_USER_AVG} subs/user`);
  const t0 = Date.now();
  const rng = makeRng(RNG_SEED);

  // Pre-compute bcrypt hash once (expensive operation).
  const hashedPassword: string = bcrypt.hashSync("password123", 10);

  // Fetch existing problem IDs to assign submissions to.
  const problems = await prisma.problem.findMany({ select: { id: true } });
  if (problems.length === 0) {
    console.error("ERROR: No problems in DB. Run seed:bulk first.");
    process.exit(1);
  }
  const problemIds = problems.map((p) => p.id);
  console.log(`found ${problemIds.length} problems to reference`);

  // Timestamp range: last 6 months.
  const now = Date.now();
  const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

  // ─── Seed users in chunks ────────────────────────────────────────────────

  const userIds: string[] = [];

  for (let chunkStart = 0; chunkStart < USER_COUNT; chunkStart += CHUNK) {
    const chunkEnd = Math.min(chunkStart + CHUNK, USER_COUNT);
    const created = await prisma.$transaction(
      Array.from({ length: chunkEnd - chunkStart }, (_, k) => {
        const i = chunkStart + k;
        const firstName = pick(rng, FIRST_NAMES);
        const lastName = pick(rng, LAST_NAMES);
        const createdAt = new Date(now - Math.floor(rng() * SIX_MONTHS_MS));

        return prisma.user.create({
          data: {
            email: `user${i}@leetrank.test`,
            username: `user_${i}`,
            password: hashedPassword,
            role: pickRole(rng),
            avatar: null,
            bio: `Hi, I'm ${firstName} ${lastName}. I love solving algorithms!`,
            rating: randInt(rng, 800, 2800),
            maxRating: randInt(rng, 1200, 3000),
            ratingDeviation: randInt(rng, 50, 350),
            ratingVolatility: 0.04 + rng() * 0.04,
            createdAt,
          },
          select: { id: true },
        });
      })
    );
    userIds.push(...created.map((u) => u.id));

    if (chunkEnd % 100 === 0 || chunkEnd === USER_COUNT) {
      process.stdout.write(`\rusers: ${chunkEnd}/${USER_COUNT}`);
    }
  }
  process.stdout.write("\n");

  // ─── Seed submissions in chunks ──────────────────────────────────────────

  let totalSubs = 0;

  for (let ui = 0; ui < userIds.length; ui++) {
    const userId = userIds[ui]!;
    // Poisson-ish: uniform [0.5x, 1.5x] of average.
    const subCount = randInt(
      rng,
      Math.max(1, Math.floor(SUBS_PER_USER_AVG * 0.5)),
      Math.floor(SUBS_PER_USER_AVG * 1.5)
    );

    // Build submission data for this user.
    const subs = Array.from({ length: subCount }, () => {
      const status = pickStatus(rng);
      const language = pick(rng, LANGUAGES);
      const problemId = pick(rng, problemIds);
      const createdAt = new Date(now - Math.floor(rng() * SIX_MONTHS_MS));

      return {
        userId,
        problemId,
        language,
        code: CODE_SNIPPETS[language] ?? "// solution\n",
        status,
        runtime: status === "ACCEPTED" ? randInt(rng, 10, 2000) : null,
        memory: status === "ACCEPTED" ? randInt(rng, 1024, 262144) : null,
        output: status === "ACCEPTED" ? "Accepted" : null,
        error:
          status === "COMPILE_ERROR"
            ? "SyntaxError: unexpected token"
            : status === "RUNTIME_ERROR"
              ? "IndexError: list index out of range"
              : null,
        createdAt,
      };
    });

    // Insert in chunks.
    for (let si = 0; si < subs.length; si += CHUNK) {
      const batch = subs.slice(si, si + CHUNK);
      await prisma.submission.createMany({ data: batch });
    }

    totalSubs += subCount;

    if ((ui + 1) % 100 === 0 || ui === userIds.length - 1) {
      process.stdout.write(`\rsubmissions: user ${ui + 1}/${userIds.length} (${totalSubs} total)`);
    }
  }
  process.stdout.write("\n");

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`done: ${userIds.length} users, ${totalSubs} submissions in ${elapsed}s`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
