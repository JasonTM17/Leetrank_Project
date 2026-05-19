/**
 * Seed the six baseline LeetCode-style study plans.
 *
 * Idempotent: each plan is upserted by slug, then its problem mappings are
 * recomputed (delete + bulk createMany) so re-running the script always
 * produces the canonical curriculum, even after schema or curation changes.
 *
 * Run with: pnpm seed:study-plans
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PlanSeed {
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedHours: number;
  coverImage?: string;
  // Each entry maps a problem slug to its day number; `order` is implied by
  // array position so plan curators can reshuffle without bookkeeping.
  problems: { slug: string; dayNumber: number }[];
}

// Problem catalogue lives across multiple seed files. We tolerate missing
// slugs (skip + warn) so partial DBs still produce usable plans during local
// development — production seeds run everything in order so all slugs exist.
const PLANS: PlanSeed[] = [
  {
    slug: "top-interview-150",
    title: "Top Interview 150",
    description:
      "The 150 most-asked questions across Big Tech interviews, sequenced from warm-up to hard. Finish this and you have a fighting chance at any FAANG loop.",
    difficulty: "Mixed",
    estimatedHours: 60,
    problems: [
      { slug: "two-sum", dayNumber: 1 },
      { slug: "valid-parentheses", dayNumber: 1 },
      { slug: "merge-two-sorted-lists", dayNumber: 1 },
      { slug: "best-time-to-buy-and-sell-stock", dayNumber: 2 },
      { slug: "valid-anagram", dayNumber: 2 },
      { slug: "binary-search", dayNumber: 2 },
      { slug: "container-with-most-water", dayNumber: 3 },
      { slug: "3sum", dayNumber: 3 },
      { slug: "longest-substring-without-repeating-characters", dayNumber: 4 },
      { slug: "longest-palindromic-substring", dayNumber: 4 },
      { slug: "group-anagrams", dayNumber: 5 },
      { slug: "product-of-array-except-self", dayNumber: 5 },
      { slug: "rotate-image", dayNumber: 6 },
      { slug: "search-in-rotated-sorted-array", dayNumber: 6 },
      { slug: "trapping-rain-water", dayNumber: 7 },
      { slug: "merge-k-sorted-lists", dayNumber: 7 },
      { slug: "n-queens", dayNumber: 8 },
      { slug: "regular-expression-matching", dayNumber: 8 },
    ],
  },
  {
    slug: "easy-collection",
    title: "Easy Collection",
    description:
      "Twenty starter problems that cover arrays, strings, linked lists, and basic math. Perfect first stop if you are new to LeetCode-style practice.",
    difficulty: "Easy",
    estimatedHours: 12,
    problems: [
      { slug: "two-sum", dayNumber: 1 },
      { slug: "reverse-string", dayNumber: 1 },
      { slug: "fizzbuzz", dayNumber: 1 },
      { slug: "palindrome-number", dayNumber: 2 },
      { slug: "valid-parentheses", dayNumber: 2 },
      { slug: "merge-two-sorted-lists", dayNumber: 2 },
      { slug: "valid-anagram", dayNumber: 3 },
      { slug: "merge-sorted-array", dayNumber: 3 },
      { slug: "roman-to-integer", dayNumber: 3 },
      { slug: "fibonacci-number", dayNumber: 4 },
      { slug: "climbing-stairs", dayNumber: 4 },
      { slug: "best-time-to-buy-and-sell-stock", dayNumber: 4 },
      { slug: "remove-duplicates-from-sorted-array", dayNumber: 5 },
    ],
  },
  {
    slug: "dynamic-programming",
    title: "Dynamic Programming",
    description:
      "Build the DP intuition from 1D Fibonacci-style recurrences up to 2D grid problems. Each day adds one new pattern.",
    difficulty: "Medium",
    estimatedHours: 25,
    problems: [
      { slug: "fibonacci-number", dayNumber: 1 },
      { slug: "climbing-stairs", dayNumber: 1 },
      { slug: "maximum-subarray", dayNumber: 2 },
      { slug: "best-time-to-buy-and-sell-stock", dayNumber: 2 },
      { slug: "longest-palindromic-substring", dayNumber: 3 },
      { slug: "trapping-rain-water", dayNumber: 4 },
      { slug: "regular-expression-matching", dayNumber: 5 },
    ],
  },
  {
    slug: "graph-theory",
    title: "Graph Theory",
    description:
      "Backtracking and grid traversal as a stepping stone to formal graph algorithms. Strengthens recursion and state-space search habits.",
    difficulty: "Hard",
    estimatedHours: 22,
    problems: [
      { slug: "valid-parentheses", dayNumber: 1 },
      { slug: "generate-parentheses", dayNumber: 2 },
      { slug: "letter-combinations-of-a-phone-number", dayNumber: 2 },
      { slug: "rotate-image", dayNumber: 3 },
      { slug: "merge-k-sorted-lists", dayNumber: 4 },
      { slug: "n-queens", dayNumber: 5 },
    ],
  },
  {
    slug: "two-pointers",
    title: "Two Pointers",
    description:
      "Master the two-pointer pattern across arrays, strings, and linked lists. Each problem reinforces the invariant the pointers maintain.",
    difficulty: "Medium",
    estimatedHours: 14,
    problems: [
      { slug: "reverse-string", dayNumber: 1 },
      { slug: "merge-sorted-array", dayNumber: 1 },
      { slug: "remove-duplicates-from-sorted-array", dayNumber: 2 },
      { slug: "container-with-most-water", dayNumber: 2 },
      { slug: "3sum", dayNumber: 3 },
      { slug: "longest-substring-without-repeating-characters", dayNumber: 3 },
      { slug: "trapping-rain-water", dayNumber: 4 },
    ],
  },
  {
    slug: "binary-search",
    title: "Binary Search",
    description:
      "From the textbook search to rotated arrays and answer-search. Twelve problems that cover every common binary-search trap.",
    difficulty: "Medium",
    estimatedHours: 16,
    problems: [
      { slug: "binary-search", dayNumber: 1 },
      { slug: "search-in-rotated-sorted-array", dayNumber: 2 },
      { slug: "median-of-two-sorted-arrays", dayNumber: 3 },
    ],
  },
];

async function main() {
  console.log("Seeding study plans...");

  // Build slug -> id once so the inner loops are O(1) lookups instead of
  // hitting the DB per problem.
  const allSlugs = Array.from(
    new Set(PLANS.flatMap((p) => p.problems.map((q) => q.slug))),
  );
  const problems = await prisma.problem.findMany({
    where: { slug: { in: allSlugs } },
    select: { id: true, slug: true },
  });
  const slugToId = new Map(problems.map((p) => [p.slug, p.id]));

  let created = 0;
  let updated = 0;

  for (const plan of PLANS) {
    const existing = await prisma.studyPlan.findUnique({
      where: { slug: plan.slug },
      select: { id: true },
    });

    const persisted = existing
      ? await prisma.studyPlan.update({
          where: { slug: plan.slug },
          data: {
            title: plan.title,
            description: plan.description,
            difficulty: plan.difficulty,
            estimatedHours: plan.estimatedHours,
            coverImage: plan.coverImage,
            isOfficial: true,
          },
        })
      : await prisma.studyPlan.create({
          data: {
            slug: plan.slug,
            title: plan.title,
            description: plan.description,
            difficulty: plan.difficulty,
            estimatedHours: plan.estimatedHours,
            coverImage: plan.coverImage,
            isOfficial: true,
          },
        });

    if (existing) updated += 1;
    else created += 1;

    // Reset mappings; createMany with skipDuplicates handles partial replays.
    await prisma.studyPlanProblem.deleteMany({
      where: { studyPlanId: persisted.id },
    });

    const rows = plan.problems
      .map((q, i) => {
        const problemId = slugToId.get(q.slug);
        if (!problemId) {
          console.warn(`  - skipping missing problem: ${q.slug}`);
          return null;
        }
        return {
          studyPlanId: persisted.id,
          problemId,
          order: i + 1,
          dayNumber: q.dayNumber,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length > 0) {
      await prisma.studyPlanProblem.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }

    console.log(`  ${plan.slug}: ${rows.length} problems mapped`);
  }

  console.log(
    `Done. Created ${created} new plans, updated ${updated} existing.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
