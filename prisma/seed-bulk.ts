/**
 * Bulk seed for stress / scaling tests.
 *
 * Generates 10,000 problems and 1,000 contests deterministically from
 * templates so the same seed produces the same dataset on every run.
 * This is NOT meant to replace prisma/seed.ts (the canonical hand-curated
 * problem set) — run it explicitly when you need realistic load:
 *
 *   npm run seed:bulk
 *
 * Inserts in chunked transactions of 500 to keep memory and lock duration
 * bounded on Postgres. Tags are seeded first so problem→tag joins resolve.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const PROBLEM_COUNT = 10_000;
const CONTEST_COUNT = 1_000;
const CHUNK = 500;
const RNG_SEED = 0xC0DEC0DE;

// Mulberry32 — deterministic PRNG so identical seed produces identical data.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOPICS = [
  "array", "string", "hash-table", "dynamic-programming", "math", "sorting",
  "greedy", "depth-first-search", "binary-search", "tree", "breadth-first-search",
  "two-pointers", "bit-manipulation", "stack", "design", "graph", "linked-list",
  "heap", "recursion", "sliding-window", "union-find", "trie", "backtracking",
  "divide-and-conquer", "segment-tree", "queue", "geometry", "topological-sort",
  "shortest-path", "minimum-spanning-tree",
];

const VERBS = ["Find", "Compute", "Count", "Reverse", "Sort", "Group", "Merge", "Split", "Detect", "Match"];
const NOUNS = ["Subarray", "Substring", "Path", "Cycle", "Permutation", "Combination", "Tree", "Graph", "Interval", "Window"];
const QUALIFIERS = ["Maximum", "Minimum", "Longest", "Shortest", "Distinct", "Sorted", "Balanced", "Connected"];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

async function seedTags(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const slug of TOPICS) {
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: {
        name: slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
        slug,
      },
    });
    out.set(slug, tag.id);
  }
  return out;
}

async function seedProblems(rng: () => number, tagBySlug: Map<string, string>): Promise<string[]> {
  const ids: string[] = [];

  for (let chunkStart = 0; chunkStart < PROBLEM_COUNT; chunkStart += CHUNK) {
    const chunkEnd = Math.min(chunkStart + CHUNK, PROBLEM_COUNT);
    const created = await prisma.$transaction(
      Array.from({ length: chunkEnd - chunkStart }, (_, k) => {
        const i = chunkStart + k;
        const idx = String(i + 1).padStart(5, "0");
        const title = `${pick(rng, QUALIFIERS)} ${pick(rng, NOUNS)} ${pick(rng, VERBS)} ${idx}`;
        const slug = `bulk-${idx}-${pick(rng, NOUNS).toLowerCase()}`;
        const difficulty = pick(rng, DIFFICULTIES);
        return prisma.problem.create({
          data: {
            title,
            slug,
            description: `Synthetic problem ${idx}. ${pick(rng, VERBS)} the ${pick(rng, NOUNS).toLowerCase()} satisfying the given constraints.`,
            difficulty,
            constraints: "1 <= n <= 10^5\n1 <= values <= 10^9",
            order: i,
            testCases: {
              create: [
                { input: "1 2 3", expected: "6", isHidden: false, order: 0 },
                { input: "5 5 5", expected: "15", isHidden: true, order: 1 },
              ],
            },
            tags: {
              create: Array.from({ length: 1 + Math.floor(rng() * 3) }, () => ({
                tag: { connect: { id: tagBySlug.get(pick(rng, TOPICS))! } },
              })),
            },
          },
          select: { id: true },
        });
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 60_000 }
    );
    ids.push(...created.map((p) => p.id));
    process.stdout.write(`\rseeded problems: ${chunkEnd}/${PROBLEM_COUNT}`);
  }
  process.stdout.write("\n");
  return ids;
}

async function seedContests(rng: () => number, problemIds: string[]): Promise<void> {
  const baseStart = Date.UTC(2026, 0, 1);
  for (let chunkStart = 0; chunkStart < CONTEST_COUNT; chunkStart += CHUNK) {
    const chunkEnd = Math.min(chunkStart + CHUNK, CONTEST_COUNT);
    await prisma.$transaction(
      Array.from({ length: chunkEnd - chunkStart }, (_, k) => {
        const i = chunkStart + k;
        const idx = String(i + 1).padStart(4, "0");
        const start = baseStart + i * 86_400_000;
        const end = start + 2 * 3_600_000;
        const problemSet = Array.from({ length: 4 }, () => pick(rng, problemIds));
        return prisma.contest.create({
          data: {
            title: `Weekly Contest ${idx}`,
            slug: `weekly-${idx}`,
            description: `Auto-generated contest ${idx}.`,
            startTime: new Date(start),
            endTime: new Date(end),
            status: i < CONTEST_COUNT - 50 ? "ended" : "upcoming",
            problems: {
              create: problemSet.map((problemId, order) => ({
                problemId,
                order,
                points: 100 * (order + 1),
              })),
            },
          },
        });
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 60_000 }
    );
    process.stdout.write(`\rseeded contests: ${chunkEnd}/${CONTEST_COUNT}`);
  }
  process.stdout.write("\n");
}

async function main() {
  console.log(`Bulk seed: ${PROBLEM_COUNT} problems, ${CONTEST_COUNT} contests`);
  const t0 = Date.now();

  const tagBySlug = await seedTags();
  console.log(`tags: ${tagBySlug.size}`);

  const rng = makeRng(RNG_SEED);
  const problemIds = await seedProblems(rng, tagBySlug);
  await seedContests(rng, problemIds);

  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
