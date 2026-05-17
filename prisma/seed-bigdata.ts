import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const NEW_USERS = [
  "algo_master",
  "code_ninja",
  "python_pro",
  "js_wizard",
  "ruby_dev",
  "data_guru",
  "sys_admin",
  "web_dev",
  "ml_engineer",
  "devops_hero",
];

const STATUS_DISTRIBUTION: Array<{ status: string; weight: number }> = [
  { status: "accepted", weight: 60 },
  { status: "wrong_answer", weight: 20 },
  { status: "runtime_error", weight: 10 },
  { status: "time_limit_exceeded", weight: 5 },
  { status: "compilation_error", weight: 5 },
];

const LANGUAGE_DISTRIBUTION: Array<{ language: string; weight: number }> = [
  { language: "python", weight: 40 },
  { language: "javascript", weight: 40 },
  { language: "ruby", weight: 20 },
];

const CODE_SNIPPETS: Record<string, Record<string, string>> = {
  python: {
    accepted: `def solve(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return []`,
    wrong_answer: `def solve(nums, target):
    # Off-by-one bug
    for i in range(len(nums) - 1):
        for j in range(i + 1, len(nums) - 1):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []`,
    runtime_error: `def solve(nums, target):
    return nums[len(nums) + 10]`,
    time_limit_exceeded: `def solve(nums, target):
    while True:
        for i in range(len(nums)):
            for j in range(len(nums)):
                if i != j and nums[i] + nums[j] == target:
                    pass
    return []`,
    compilation_error: `def solve(nums, target)
    # Missing colon above
    return []`,
  },
  javascript: {
    accepted: `function solve(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) return [map.get(complement), i];
        map.set(nums[i], i);
    }
    return [];
}`,
    wrong_answer: `function solve(nums, target) {
    return [0, 1];
}`,
    runtime_error: `function solve(nums, target) {
    return nums[nums.length + 100].toString();
}`,
    time_limit_exceeded: `function solve(nums, target) {
    while (true) {
        for (let i = 0; i < nums.length; i++) {
            for (let j = 0; j < nums.length; j++) {}
        }
    }
}`,
    compilation_error: `function solve(nums, target) {
    return [
}`,
  },
  ruby: {
    accepted: `def solve(nums, target)
  seen = {}
  nums.each_with_index do |n, i|
    return [seen[target - n], i] if seen.key?(target - n)
    seen[n] = i
  end
  []
end`,
    wrong_answer: `def solve(nums, target)
  [0, 1]
end`,
    runtime_error: `def solve(nums, target)
  nums.fetch(99999)
end`,
    time_limit_exceeded: `def solve(nums, target)
  loop do
    nums.each { |n| nums.each { |m| } }
  end
end`,
    compilation_error: `def solve(nums, target)
  [0, 1
end`,
  },
};

function weightedPick<T>(items: Array<{ weight: number } & T>): T {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("Big-data seed starting...");

  const password = await bcrypt.hash("password123", 10);

  let createdUsers = 0;
  for (let i = 0; i < NEW_USERS.length; i++) {
    const username = NEW_USERS[i];
    const userIndex = i + 3;
    await prisma.user.upsert({
      where: { email: `${username}@leetrank.dev` },
      update: {},
      create: {
        email: `${username}@leetrank.dev`,
        username: `user${userIndex}`,
        password,
        role: "user",
        bio: `Hi, I'm ${username}. Solving problems daily.`,
      },
    });
    createdUsers++;
  }
  console.log(`Upserted ${createdUsers} users (user3..user${NEW_USERS.length + 2})`);

  const allUsers = await prisma.user.findMany({ where: { role: "user" } });
  const allProblems = await prisma.problem.findMany();

  if (allProblems.length === 0) {
    console.warn("No problems found — run prisma/seed.ts first. Skipping submissions.");
  } else if (allUsers.length === 0) {
    console.warn("No users found — skipping submissions.");
  } else {
    console.log(`Generating 500 submissions across ${allProblems.length} problems and ${allUsers.length} users...`);

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const TARGET = 500;
    const BATCH = 50;

    for (let batchStart = 0; batchStart < TARGET; batchStart += BATCH) {
      const rows = [];
      for (let i = 0; i < BATCH && batchStart + i < TARGET; i++) {
        const user = allUsers[randomInt(0, allUsers.length - 1)];
        const problem = allProblems[randomInt(0, allProblems.length - 1)];
        const { status } = weightedPick(STATUS_DISTRIBUTION);
        const { language } = weightedPick(LANGUAGE_DISTRIBUTION);
        const code = CODE_SNIPPETS[language][status];
        const createdAt = new Date(now - Math.floor(Math.random() * thirtyDaysMs));

        rows.push({
          userId: user.id,
          problemId: problem.id,
          language,
          code,
          status,
          runtime: status === "accepted" ? randomInt(20, 500) : null,
          memory: status === "accepted" ? randomInt(10000, 50000) : null,
          output:
            status === "accepted"
              ? "All test cases passed"
              : status === "wrong_answer"
                ? "Expected [0,1] but got [1,2]"
                : null,
          error:
            status === "runtime_error"
              ? "RuntimeError: index out of range"
              : status === "time_limit_exceeded"
                ? "Execution exceeded 5000ms"
                : status === "compilation_error"
                  ? "SyntaxError: invalid syntax"
                  : null,
          createdAt,
        });
      }
      await prisma.submission.createMany({ data: rows });
      console.log(`  ${Math.min(batchStart + BATCH, TARGET)}/${TARGET} submissions inserted`);
    }
  }

  const contests = await prisma.contest.findMany();
  if (contests.length === 0) {
    console.warn("No contests found — skipping contest entries.");
  } else if (allUsers.length === 0) {
    console.warn("No users found — skipping contest entries.");
  } else {
    let entryCount = 0;
    for (const contest of contests) {
      const participantCount = randomInt(Math.min(5, allUsers.length), allUsers.length);
      const shuffled = [...allUsers].sort(() => Math.random() - 0.5);
      const participants = shuffled.slice(0, participantCount);

      for (const user of participants) {
        await prisma.contestEntry.upsert({
          where: { contestId_userId: { contestId: contest.id, userId: user.id } },
          update: {},
          create: {
            contestId: contest.id,
            userId: user.id,
            score: randomInt(0, 1500),
            rank: randomInt(1, participantCount),
          },
        });
        entryCount++;
      }
    }
    console.log(`Created ${entryCount} contest entries across ${contests.length} contests`);
  }

  console.log("Big-data seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
