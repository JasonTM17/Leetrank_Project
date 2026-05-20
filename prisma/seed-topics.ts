/**
 * LeetCode-style topic + company tag seeder.
 *
 * Layered on top of prisma/seed.ts. The base seed only knows about a small
 * algorithmic vocabulary ("Array", "String", "Hash Table", ...) and treats
 * every Tag the same. This script:
 *
 *   1. Backfills the canonical 25-topic taxonomy under category="topic".
 *   2. Adds 13 interview-source companies under category="company".
 *   3. Re-classifies pre-existing tags by name when the slug already exists,
 *      so the prior topics-only seed cleanly upgrades to the new schema.
 *
 * Idempotent — safe to run repeatedly. Run via:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-topics.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedTag {
  name: string;
  slug: string;
  category: "topic" | "company" | "skill";
}

const TOPICS: SeedTag[] = [
  { name: "Array", slug: "array", category: "topic" },
  { name: "String", slug: "string", category: "topic" },
  { name: "Hash Table", slug: "hash-table", category: "topic" },
  { name: "Dynamic Programming", slug: "dynamic-programming", category: "topic" },
  { name: "Math", slug: "math", category: "topic" },
  { name: "Sorting", slug: "sorting", category: "topic" },
  { name: "Greedy", slug: "greedy", category: "topic" },
  { name: "Depth-First Search", slug: "depth-first-search", category: "topic" },
  { name: "Breadth-First Search", slug: "breadth-first-search", category: "topic" },
  { name: "Tree", slug: "tree", category: "topic" },
  { name: "Binary Tree", slug: "binary-tree", category: "topic" },
  { name: "Binary Search", slug: "binary-search", category: "topic" },
  { name: "Two Pointers", slug: "two-pointers", category: "topic" },
  { name: "Stack", slug: "stack", category: "topic" },
  { name: "Queue", slug: "queue", category: "topic" },
  { name: "Heap (Priority Queue)", slug: "heap", category: "topic" },
  { name: "Graph", slug: "graph", category: "topic" },
  { name: "Backtracking", slug: "backtracking", category: "topic" },
  { name: "Bit Manipulation", slug: "bit-manipulation", category: "topic" },
  { name: "Linked List", slug: "linked-list", category: "topic" },
  { name: "Sliding Window", slug: "sliding-window", category: "topic" },
  { name: "Union Find", slug: "union-find", category: "topic" },
  { name: "Trie", slug: "trie", category: "topic" },
  { name: "Recursion", slug: "recursion", category: "topic" },
  { name: "Divide and Conquer", slug: "divide-and-conquer", category: "topic" },
];

const COMPANIES: SeedTag[] = [
  { name: "Google", slug: "google", category: "company" },
  { name: "Meta", slug: "meta", category: "company" },
  { name: "Amazon", slug: "amazon", category: "company" },
  { name: "Microsoft", slug: "microsoft", category: "company" },
  { name: "Apple", slug: "apple", category: "company" },
  { name: "Netflix", slug: "netflix", category: "company" },
  { name: "Uber", slug: "uber", category: "company" },
  { name: "Airbnb", slug: "airbnb", category: "company" },
  { name: "LinkedIn", slug: "linkedin", category: "company" },
  { name: "TikTok", slug: "tiktok", category: "company" },
  { name: "Bloomberg", slug: "bloomberg", category: "company" },
  { name: "Adobe", slug: "adobe", category: "company" },
  { name: "Oracle", slug: "oracle", category: "company" },
];

async function upsertTag(tag: SeedTag): Promise<void> {
  await prisma.tag.upsert({
    where: { slug: tag.slug },
    // Re-classify pre-existing rows if the slug already lived under the
    // previous topic-only world. `name` is also re-asserted in case the
    // canonical capitalisation drifted.
    update: { name: tag.name, category: tag.category },
    create: tag,
  });
}

async function main(): Promise<void> {
  let created = 0;
  for (const tag of [...TOPICS, ...COMPANIES]) {
    await upsertTag(tag);
    created += 1;
  }
   
  console.log(`[seed-topics] upserted ${created} tags (${TOPICS.length} topic, ${COMPANIES.length} company)`);
}

main()
  .catch((err) => {
     
    console.error("[seed-topics] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
