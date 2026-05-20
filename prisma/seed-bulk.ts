/**
 * Bulk seed for stress / scaling tests.
 *
 * Generates a configurable number of problems and contests deterministically
 * from templates so the same seed produces the same dataset on every run.
 * This is NOT meant to replace prisma/seed.ts (the canonical hand-curated
 * problem set) — run it explicitly when you need realistic load.
 *
 *   npm run seed:1k          # 1000 problems + 1000 contests (default)
 *   npm run seed:bulk        # alias of seed:1k
 *   npm run seed:stress      # 10000 problems + 1000 contests
 *
 * Override via CLI or env:
 *   npx ts-node prisma/seed-bulk.ts 500 200
 *   SEED_PROBLEMS=2000 SEED_CONTESTS=300 npx ts-node prisma/seed-bulk.ts
 *
 * Inserts in chunked transactions of 500 to keep memory and lock duration
 * bounded on Postgres. Tags are seeded first so problem→tag joins resolve.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// CLI args win over env vars; both fall back to 1000.
const PROBLEM_COUNT = parseInt(process.argv[2] ?? process.env.SEED_PROBLEMS ?? "1000", 10);
const CONTEST_COUNT = parseInt(process.argv[3] ?? process.env.SEED_CONTESTS ?? "1000", 10);
const CHUNK = 500;
const RNG_SEED = 0xc0dec0de;

// Mulberry32 — deterministic PRNG so identical seed produces identical data.
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

const TOPICS = [
  "array",
  "string",
  "hash-table",
  "dynamic-programming",
  "math",
  "sorting",
  "greedy",
  "depth-first-search",
  "binary-search",
  "tree",
  "breadth-first-search",
  "two-pointers",
  "bit-manipulation",
  "stack",
  "design",
  "graph",
  "linked-list",
  "heap",
  "recursion",
  "sliding-window",
  "union-find",
  "trie",
  "backtracking",
  "divide-and-conquer",
  "segment-tree",
  "queue",
  "geometry",
  "topological-sort",
  "shortest-path",
  "minimum-spanning-tree",
  // ── Extra realistic tags (added in scale-up pass) ─────────────────────
  "matrix",
  "simulation",
  "bit-mask",
  "memoization",
  "monotonic-stack",
  "rolling-hash",
  "ordered-set",
  "prefix-sum",
  "suffix-array",
  "knapsack",
];

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ─── Problem templates ────────────────────────────────────────────────────────
//
// Each template owns:
//   - title pattern
//   - description (markdown, multi-paragraph)
//   - constraints
//   - hints (1-2 short hints)
//   - starter code in 4 languages (python, javascript, go, java)
//   - test-case generator that produces (input, expected) pairs from RNG
//
// Templates rotate by problem index, so the dataset has 5 distinct problem
// shapes instead of one. The generator must be deterministic from RNG so
// re-runs produce identical data.

interface Template {
  slug: string;
  titles: readonly string[];
  description: string;
  constraints: string;
  hints: readonly string[];
  starterCode: { python: string; javascript: string; go: string; java: string };
  generate: (rng: () => number) => { input: string; expected: string };
}

const TEMPLATES: readonly Template[] = [
  {
    slug: "max-subarray-sum",
    titles: ["Maximum Subarray Sum", "Largest Contiguous Sum", "Best Window of Numbers"],
    description: `Given an array of integers \`nums\`, find the contiguous subarray with the **largest sum**. Return the sum.

A subarray is a contiguous, non-empty slice of the array.

**Example:**
\`\`\`
Input: [-2, 1, -3, 4, -1, 2, 1, -5, 4]
Output: 6
Explanation: The subarray [4, -1, 2, 1] has sum 6.
\`\`\`

**Note:** Aim for O(n) time. The naive O(n²) solution will TLE on the hidden test cases.`,
    constraints: "1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4",
    hints: [
      "Track the running sum and reset it when it goes below zero.",
      "Kadane's algorithm runs in O(n) and one pass.",
    ],
    starterCode: {
      python:
        "def solve(nums):\n    # Read 'nums' as a list of ints.\n    # Return the maximum subarray sum.\n    pass\n",
      javascript: "function solve(nums) {\n  // Return the maximum subarray sum.\n}\n",
      go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  // Read nums and print the max subarray sum.\n}\n',
      java: "public class Main {\n  public static void main(String[] args) {\n    // Read nums; print max subarray sum.\n  }\n}\n",
    },
    generate(rng) {
      const n = randInt(rng, 5, 12);
      const nums = Array.from({ length: n }, () => randInt(rng, -10, 10));
      // Kadane reference.
      let best = nums[0]!;
      let cur = nums[0]!;
      for (let i = 1; i < n; i++) {
        cur = Math.max(nums[i]!, cur + nums[i]!);
        best = Math.max(best, cur);
      }
      return { input: nums.join(" "), expected: String(best) };
    },
  },
  {
    slug: "sum-of-input",
    titles: ["Sum of Numbers", "Total Reduction", "Cumulative Sum"],
    description: `You are given a sequence of integers separated by whitespace. Output their sum.

**Example:**
\`\`\`
Input: 1 2 3 4
Output: 10
\`\`\`

This is the warm-up tier — make sure your IO works before tackling the harder set.`,
    constraints: "1 <= n <= 10^5\n-10^9 <= nums[i] <= 10^9",
    hints: ["Watch out for integer overflow in fixed-width languages."],
    starterCode: {
      python: "def solve(nums):\n    return sum(nums)\n",
      javascript: "function solve(nums) {\n  return nums.reduce((a, b) => a + b, 0);\n}\n",
      go: "package main\n\nfunc main() {\n  // Read nums and print the sum.\n}\n",
      java: "public class Main {\n  public static void main(String[] args) {\n    // Print the sum.\n  }\n}\n",
    },
    generate(rng) {
      const n = randInt(rng, 3, 10);
      const nums = Array.from({ length: n }, () => randInt(rng, 1, 100));
      const sum = nums.reduce((a, b) => a + b, 0);
      return { input: nums.join(" "), expected: String(sum) };
    },
  },
  {
    slug: "reverse-string",
    titles: ["Reverse a String", "String Reversal", "Mirror Sequence"],
    description: `Given a string \`s\`, return its reverse.

The string consists of printable ASCII characters and may include whitespace.

**Example:**
\`\`\`
Input: hello
Output: olleh
\`\`\``,
    constraints: "1 <= s.length <= 10^4",
    hints: [
      "Most languages have a built-in reversal; reach for it.",
      "If the string is large, prefer in-place reversal in mutable languages.",
    ],
    starterCode: {
      python: "def solve(s):\n    return s[::-1]\n",
      javascript: "function solve(s) {\n  return [...s].reverse().join('');\n}\n",
      go: "package main\n\nfunc main() {\n  // Read s; print reversed.\n}\n",
      java: "public class Main {\n  public static void main(String[] args) {\n    // Read s; print reversed.\n  }\n}\n",
    },
    generate(rng) {
      const len = randInt(rng, 3, 12);
      const chars = "abcdefghijklmnopqrstuvwxyz";
      let s = "";
      for (let i = 0; i < len; i++) s += chars[Math.floor(rng() * chars.length)];
      return { input: s, expected: s.split("").reverse().join("") };
    },
  },
  {
    slug: "count-distinct",
    titles: ["Count Distinct Elements", "Unique Values", "Set Cardinality"],
    description: `Given a list of integers, return how many **distinct** values appear.

**Example:**
\`\`\`
Input: 1 2 2 3 3 3 4
Output: 4
\`\`\``,
    constraints: "1 <= n <= 10^5\n-10^9 <= nums[i] <= 10^9",
    hints: ["A hash set gives you O(n) average time."],
    starterCode: {
      python: "def solve(nums):\n    return len(set(nums))\n",
      javascript: "function solve(nums) {\n  return new Set(nums).size;\n}\n",
      go: "package main\n\nfunc main() {\n  // Read nums; print len(unique).\n}\n",
      java: "public class Main {\n  public static void main(String[] args) {\n    // Read nums; print distinct count.\n  }\n}\n",
    },
    generate(rng) {
      const n = randInt(rng, 4, 12);
      const nums = Array.from({ length: n }, () => randInt(rng, 1, 6));
      const distinct = new Set(nums).size;
      return { input: nums.join(" "), expected: String(distinct) };
    },
  },
  {
    slug: "fibonacci",
    titles: ["Nth Fibonacci Number", "Fibonacci Sequence", "Golden Sum"],
    description: `Given an integer \`n\`, return the n-th Fibonacci number where F(0) = 0 and F(1) = 1.

**Example:**
\`\`\`
Input: 6
Output: 8
\`\`\`

Hidden tests check up to n = 30. Iterative DP is sufficient; naive recursion will time out.`,
    constraints: "0 <= n <= 30",
    hints: ["Iterate; don't recurse.", "Two variables tracking F(i-1) and F(i-2) is enough."],
    starterCode: {
      python:
        "def solve(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n",
      javascript:
        "function solve(n) {\n  let a = 0, b = 1;\n  for (let i = 0; i < n; i++) [a, b] = [b, a + b];\n  return a;\n}\n",
      go: "package main\n\nfunc main() {\n  // Read n; print Fib(n).\n}\n",
      java: "public class Main {\n  public static void main(String[] args) {\n    // Read n; print Fib(n).\n  }\n}\n",
    },
    generate(rng) {
      const n = randInt(rng, 0, 20);
      let a = 0,
        b = 1;
      for (let i = 0; i < n; i++) [a, b] = [b, a + b];
      return { input: String(n), expected: String(a) };
    },
  },
];

async function seedTags(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const slug of TOPICS) {
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: {
        name: slug
          .split("-")
          .map((w) => w[0]!.toUpperCase() + w.slice(1))
          .join(" "),
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
        const tpl = TEMPLATES[i % TEMPLATES.length]!;
        const title = `${pick(rng, tpl.titles)} #${idx}`;
        const slug = `bulk-${idx}-${tpl.slug}`;
        const difficulty = pick(rng, DIFFICULTIES);

        // 3 visible + 5 hidden test cases — generated deterministically so
        // the same problem index always produces the same fixtures.
        const visibleTests = Array.from({ length: 3 }, (_, j) => {
          const tc = tpl.generate(rng);
          return { ...tc, isHidden: false, order: j };
        });
        const hiddenTests = Array.from({ length: 5 }, (_, j) => {
          const tc = tpl.generate(rng);
          return { ...tc, isHidden: true, order: j + 3 };
        });

        return prisma.problem.create({
          data: {
            title,
            slug,
            description: tpl.description,
            difficulty,
            constraints: tpl.constraints,
            hints: tpl.hints.join("\n\n"),
            starterCode: JSON.stringify(tpl.starterCode),
            order: i,
            testCases: {
              create: [...visibleTests, ...hiddenTests],
            },
            tags: {
              create: Array.from(
                new Set(Array.from({ length: 1 + Math.floor(rng() * 3) }, () => pick(rng, TOPICS)))
              ).map((slug) => ({
                tag: { connect: { id: tagBySlug.get(slug)! } },
              })),
            },
          },
          select: { id: true },
        });
      })
    );
    ids.push(...created.map((p) => p.id));
    process.stdout.write(`\rseeded problems: ${chunkEnd}/${PROBLEM_COUNT}`);
  }
  process.stdout.write("\n");
  return ids;
}

const CONTEST_TITLE_PATTERNS = [
  "Weekly Contest",
  "Biweekly Contest",
  "LeetRank Cup",
  "Daily Challenge",
  "Algorithm Sprint",
  "Speed Round",
];

const CONTEST_DURATIONS_MIN = [60, 90, 120, 180];

async function seedContests(rng: () => number, problemIds: string[]): Promise<void> {
  if (problemIds.length === 0) {
    console.log("no problems to attach to contests, skipping");
    return;
  }

  // Status mix: 70% ended, 20% upcoming, 10% active.
  // ended: scattered over the last 2 years
  // active: started in last 60 minutes, ends in next 60 minutes
  // upcoming: starts within next 30 days
  const now = Date.now();
  const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const ONE_HOUR_MS = 60 * 60 * 1000;

  for (let chunkStart = 0; chunkStart < CONTEST_COUNT; chunkStart += CHUNK) {
    const chunkEnd = Math.min(chunkStart + CHUNK, CONTEST_COUNT);
    await prisma.$transaction(
      Array.from({ length: chunkEnd - chunkStart }, (_, k) => {
        const i = chunkStart + k;
        const idx = String(i + 1).padStart(4, "0");

        const roll = rng();
        let status: "ended" | "active" | "upcoming";
        let start: number;
        let durationMs: number;
        if (roll < 0.1) {
          status = "active";
          start = now - randInt(rng, 0, 60) * 60 * 1000;
          durationMs = ONE_HOUR_MS * 2;
        } else if (roll < 0.3) {
          status = "upcoming";
          start = now + randInt(rng, 60, THIRTY_DAYS_MS / 60_000) * 60_000;
          durationMs = pick(rng, CONTEST_DURATIONS_MIN) * 60_000;
        } else {
          status = "ended";
          start = now - randInt(rng, ONE_HOUR_MS / 60_000, TWO_YEARS_MS / 60_000) * 60_000;
          durationMs = pick(rng, CONTEST_DURATIONS_MIN) * 60_000;
        }
        const end = start + durationMs;

        const numProblems = randInt(rng, 4, 6);
        const usedProblemIds = new Set<string>();
        const problemSet: string[] = [];
        // Pick distinct problems for this contest where possible.
        for (let attempts = 0; attempts < 20 && problemSet.length < numProblems; attempts++) {
          const candidate = pick(rng, problemIds);
          if (!usedProblemIds.has(candidate)) {
            usedProblemIds.add(candidate);
            problemSet.push(candidate);
          }
        }

        const titlePattern = pick(rng, CONTEST_TITLE_PATTERNS);
        return prisma.contest.create({
          data: {
            title: `${titlePattern} ${idx}`,
            slug: `bulk-contest-${idx}-${titlePattern.toLowerCase().replace(/\s+/g, "-")}`,
            description: `${titlePattern} ${idx} — ${numProblems} problems, ${(durationMs / 60_000) | 0} minutes. Auto-generated for load testing.`,
            startTime: new Date(start),
            endTime: new Date(end),
            status,
            problems: {
              create: problemSet.map((problemId, order) => ({
                problemId,
                order,
                points: 100 * (order + 1),
              })),
            },
          },
        });
      })
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
