import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function seedExtra() {
  // Get existing tags
  const tags = await prisma.tag.findMany();
  const tagMap = Object.fromEntries(tags.map((t: { name: string; id: string }) => [t.name, t.id]));

  // Get existing users
  const users = await prisma.user.findMany();
  const userMap = Object.fromEntries(users.map((u: { username: string; id: string }) => [u.username, u.id]));

  // Helper to get tag ids by name
  function tagIds(names: string[]): string[] {
    return names.map((n) => tagMap[n]).filter(Boolean);
  }

  // ── EASY PROBLEMS ──────────────────────────────────────────────────────────

  const fibProblem = await prisma.problem.upsert({
    where: { slug: "fibonacci-number" },
    update: {},
    create: {
      title: "Fibonacci Number",
      slug: "fibonacci-number",
      difficulty: "Easy",
      order: 11,
      description: `The **Fibonacci numbers**, commonly denoted \`F(n)\`, form a sequence called the Fibonacci sequence, such that each number is the sum of the two preceding ones, starting from 0 and 1.

That is, \`F(0) = 0\`, \`F(1) = 1\`, and \`F(n) = F(n - 1) + F(n - 2)\` for \`n > 1\`.

Given \`n\`, calculate \`F(n)\`.

**Example 1:**
\`\`\`
Input: n = 2
Output: 1
Explanation: F(2) = F(1) + F(0) = 1 + 0 = 1.
\`\`\`

**Example 2:**
\`\`\`
Input: n = 3
Output: 2
Explanation: F(3) = F(2) + F(1) = 1 + 1 = 2.
\`\`\`

**Example 3:**
\`\`\`
Input: n = 4
Output: 3
Explanation: F(4) = F(3) + F(2) = 2 + 1 = 3.
\`\`\``,
      constraints: `- 0 <= n <= 30`,
      hints: JSON.stringify([
        "The recursive solution is elegant but has exponential time complexity.",
        "Use memoization or bottom-up DP to achieve O(n) time.",
        "You can even solve it in O(1) space with just two variables.",
      ]),
      starterCode: JSON.stringify({
        python: `def fib(n: int) -> int:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {number} n\n * @return {number}\n */\nfunction fib(n) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["Math", "Dynamic Programming"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: fibProblem.id, tagId: id } },
      update: {},
      create: { problemId: fibProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: fibProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: fibProblem.id, input: "2", expected: "1", isHidden: false, order: 1 },
      { problemId: fibProblem.id, input: "3", expected: "2", isHidden: false, order: 2 },
      { problemId: fibProblem.id, input: "4", expected: "3", isHidden: false, order: 3 },
      { problemId: fibProblem.id, input: "0", expected: "0", isHidden: true, order: 4 },
      { problemId: fibProblem.id, input: "10", expected: "55", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Fibonacci Number");

  // Remove Duplicates from Sorted Array
  const removeDupsProblem = await prisma.problem.upsert({
    where: { slug: "remove-duplicates-from-sorted-array" },
    update: {},
    create: {
      title: "Remove Duplicates from Sorted Array",
      slug: "remove-duplicates-from-sorted-array",
      difficulty: "Easy",
      order: 12,
      description: `Given an integer array \`nums\` sorted in **non-decreasing order**, remove the duplicates **in-place** such that each unique element appears only once. The **relative order** of the elements should be kept the same. Then return the number of unique elements in \`nums\`.

Consider the number of unique elements of \`nums\` to be \`k\`. To get accepted, you need to do the following things:
- Change the array \`nums\` such that the first \`k\` elements of \`nums\` contain the unique elements in the order they were present in \`nums\` initially.
- The remaining elements of \`nums\` are not important as well as the size of \`nums\`.
- Return \`k\`.

**Example 1:**
\`\`\`
Input: nums = [1,1,2]
Output: 2, nums = [1,2,_]
Explanation: Your function should return k = 2, with the first two elements of nums being 1 and 2 respectively.
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [0,0,1,1,1,2,2,3,3,4]
Output: 5, nums = [0,1,2,3,4,_,_,_,_,_]
Explanation: Your function should return k = 5, with the first five elements of nums being 0, 1, 2, 3, and 4 respectively.
\`\`\``,
      constraints: `- 1 <= nums.length <= 3 * 10^4\n- -100 <= nums[i] <= 100\n- nums is sorted in non-decreasing order.`,
      hints: JSON.stringify([
        "Use two pointers: a slow pointer k and a fast pointer i.",
        "When nums[i] != nums[k], increment k and copy nums[i] to nums[k].",
        "The slow pointer always points to the last unique element found.",
      ]),
      starterCode: JSON.stringify({
        python: `def removeDuplicates(nums: list[int]) -> int:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {number[]} nums\n * @return {number}\n */\nfunction removeDuplicates(nums) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["Array", "Two Pointers"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: removeDupsProblem.id, tagId: id } },
      update: {},
      create: { problemId: removeDupsProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: removeDupsProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: removeDupsProblem.id, input: "[1,1,2]", expected: "2", isHidden: false, order: 1 },
      { problemId: removeDupsProblem.id, input: "[0,0,1,1,1,2,2,3,3,4]", expected: "5", isHidden: false, order: 2 },
      { problemId: removeDupsProblem.id, input: "[1]", expected: "1", isHidden: false, order: 3 },
      { problemId: removeDupsProblem.id, input: "[1,2,3]", expected: "3", isHidden: true, order: 4 },
      { problemId: removeDupsProblem.id, input: "[-3,-1,-1,0,0,0,1]", expected: "4", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Remove Duplicates from Sorted Array");

  // Maximum Subarray
  const maxSubarrayProblem = await prisma.problem.upsert({
    where: { slug: "maximum-subarray" },
    update: {},
    create: {
      title: "Maximum Subarray",
      slug: "maximum-subarray",
      difficulty: "Easy",
      order: 13,
      description: `Given an integer array \`nums\`, find the **subarray** with the largest sum, and return its sum.

A **subarray** is a contiguous non-empty sequence of elements within an array.

**Example 1:**
\`\`\`
Input: nums = [-2,1,-3,4,-1,2,1,-5,4]
Output: 6
Explanation: The subarray [4,-1,2,1] has the largest sum 6.
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [1]
Output: 1
Explanation: The subarray [1] has the largest sum 1.
\`\`\`

**Example 3:**
\`\`\`
Input: nums = [5,4,-1,7,8]
Output: 23
Explanation: The subarray [5,4,-1,7,8] has the largest sum 23.
\`\`\``,
      constraints: `- 1 <= nums.length <= 10^5\n- -10^4 <= nums[i] <= 10^4`,
      hints: JSON.stringify([
        "Kadane's algorithm: keep a running sum and reset it to 0 when it goes negative.",
        "At each step, the current subarray sum is max(nums[i], currentSum + nums[i]).",
        "Track the global maximum as you iterate.",
      ]),
      starterCode: JSON.stringify({
        python: `def maxSubArray(nums: list[int]) -> int:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {number[]} nums\n * @return {number}\n */\nfunction maxSubArray(nums) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["Array", "Dynamic Programming"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: maxSubarrayProblem.id, tagId: id } },
      update: {},
      create: { problemId: maxSubarrayProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: maxSubarrayProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: maxSubarrayProblem.id, input: "[-2,1,-3,4,-1,2,1,-5,4]", expected: "6", isHidden: false, order: 1 },
      { problemId: maxSubarrayProblem.id, input: "[1]", expected: "1", isHidden: false, order: 2 },
      { problemId: maxSubarrayProblem.id, input: "[5,4,-1,7,8]", expected: "23", isHidden: false, order: 3 },
      { problemId: maxSubarrayProblem.id, input: "[-1]", expected: "-1", isHidden: true, order: 4 },
      { problemId: maxSubarrayProblem.id, input: "[-2,-1]", expected: "-1", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Maximum Subarray");

  // Valid Anagram
  const validAnagramProblem = await prisma.problem.upsert({
    where: { slug: "valid-anagram" },
    update: {},
    create: {
      title: "Valid Anagram",
      slug: "valid-anagram",
      difficulty: "Easy",
      order: 14,
      description: `Given two strings \`s\` and \`t\`, return \`true\` if \`t\` is an **anagram** of \`s\`, and \`false\` otherwise.

An **anagram** is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.

**Example 1:**
\`\`\`
Input: s = "anagram", t = "nagaram"
Output: true
\`\`\`

**Example 2:**
\`\`\`
Input: s = "rat", t = "car"
Output: false
\`\`\`

**Follow-up:** What if the inputs contain Unicode characters? How would you adapt your solution?`,
      constraints: `- 1 <= s.length, t.length <= 5 * 10^4\n- s and t consist of lowercase English letters.`,
      hints: JSON.stringify([
        "If the lengths differ, they cannot be anagrams.",
        "Count the frequency of each character in both strings and compare.",
        "A hash map or a fixed-size array of 26 integers works well here.",
      ]),
      starterCode: JSON.stringify({
        python: `def isAnagram(s: str, t: str) -> bool:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {string} s\n * @param {string} t\n * @return {boolean}\n */\nfunction isAnagram(s, t) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["String", "Hash Table", "Sorting"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: validAnagramProblem.id, tagId: id } },
      update: {},
      create: { problemId: validAnagramProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: validAnagramProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: validAnagramProblem.id, input: "anagram\nnagaram", expected: "true", isHidden: false, order: 1 },
      { problemId: validAnagramProblem.id, input: "rat\ncar", expected: "false", isHidden: false, order: 2 },
      { problemId: validAnagramProblem.id, input: "a\na", expected: "true", isHidden: false, order: 3 },
      { problemId: validAnagramProblem.id, input: "ab\nba", expected: "true", isHidden: true, order: 4 },
      { problemId: validAnagramProblem.id, input: "listen\nsilent", expected: "true", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Valid Anagram");

  // Merge Sorted Array
  const mergeSortedArrayProblem = await prisma.problem.upsert({
    where: { slug: "merge-sorted-array" },
    update: {},
    create: {
      title: "Merge Sorted Array",
      slug: "merge-sorted-array",
      difficulty: "Easy",
      order: 15,
      description: `You are given two integer arrays \`nums1\` and \`nums2\`, sorted in **non-decreasing order**, and two integers \`m\` and \`n\`, representing the number of elements in \`nums1\` and \`nums2\` respectively.

**Merge** \`nums1\` and \`nums2\` into a single array sorted in **non-decreasing order**.

The final sorted array should not be returned by the function, but instead be stored inside the array \`nums1\`. To accommodate this, \`nums1\` has a length of \`m + n\`, where the first \`m\` elements denote the elements that should be merged, and the last \`n\` elements are set to \`0\` and should be ignored. \`nums2\` has a length of \`n\`.

**Example 1:**
\`\`\`
Input: nums1 = [1,2,3,0,0,0], m = 3, nums2 = [2,5,6], n = 3
Output: [1,2,2,3,5,6]
\`\`\`

**Example 2:**
\`\`\`
Input: nums1 = [1], m = 1, nums2 = [], n = 0
Output: [1]
\`\`\`

**Example 3:**
\`\`\`
Input: nums1 = [0], m = 0, nums2 = [1], n = 1
Output: [1]
\`\`\``,
      constraints: `- nums1.length == m + n\n- nums2.length == n\n- 0 <= m, n <= 200\n- 1 <= m + n <= 200\n- -10^9 <= nums1[i], nums2[j] <= 10^9`,
      hints: JSON.stringify([
        "Start filling from the end of nums1 to avoid overwriting elements.",
        "Use three pointers: one at the end of nums1's valid part, one at the end of nums2, one at the very end of nums1.",
        "Compare from the back and place the larger element at the current tail position.",
      ]),
      starterCode: JSON.stringify({
        python: `def merge(nums1: list[int], m: int, nums2: list[int], n: int) -> None:\n    # Modify nums1 in-place, do not return anything\n    pass`,
        javascript: `/**\n * @param {number[]} nums1\n * @param {number} m\n * @param {number[]} nums2\n * @param {number} n\n * @return {void}\n */\nfunction merge(nums1, m, nums2, n) {\n    // Modify nums1 in-place, do not return anything\n}`,
      }),
    },
  });
  for (const id of tagIds(["Array", "Two Pointers", "Sorting"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: mergeSortedArrayProblem.id, tagId: id } },
      update: {},
      create: { problemId: mergeSortedArrayProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: mergeSortedArrayProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: mergeSortedArrayProblem.id, input: "[1,2,3,0,0,0]\n3\n[2,5,6]\n3", expected: "[1,2,2,3,5,6]", isHidden: false, order: 1 },
      { problemId: mergeSortedArrayProblem.id, input: "[1]\n1\n[]\n0", expected: "[1]", isHidden: false, order: 2 },
      { problemId: mergeSortedArrayProblem.id, input: "[0]\n0\n[1]\n1", expected: "[1]", isHidden: false, order: 3 },
      { problemId: mergeSortedArrayProblem.id, input: "[2,0]\n1\n[1]\n1", expected: "[1,2]", isHidden: true, order: 4 },
      { problemId: mergeSortedArrayProblem.id, input: "[4,5,6,0,0,0]\n3\n[1,2,3]\n3", expected: "[1,2,3,4,5,6]", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Merge Sorted Array");

  // Roman to Integer
  const romanToIntProblem = await prisma.problem.upsert({
    where: { slug: "roman-to-integer" },
    update: {},
    create: {
      title: "Roman to Integer",
      slug: "roman-to-integer",
      difficulty: "Easy",
      order: 16,
      description: `Roman numerals are represented by seven different symbols: \`I\`, \`V\`, \`X\`, \`L\`, \`C\`, \`D\` and \`M\`.

| Symbol | Value |
|--------|-------|
| I      | 1     |
| V      | 5     |
| X      | 10    |
| L      | 50    |
| C      | 100   |
| D      | 500   |
| M      | 1000  |

Roman numerals are usually written largest to smallest from left to right. However, there are six special subtraction cases: \`IV\` = 4, \`IX\` = 9, \`XL\` = 40, \`XC\` = 90, \`CD\` = 400, \`CM\` = 900.

Given a roman numeral, convert it to an integer.

**Example 1:**
\`\`\`
Input: s = "III"
Output: 3
\`\`\`

**Example 2:**
\`\`\`
Input: s = "LVIII"
Output: 58
Explanation: L = 50, V = 5, III = 3.
\`\`\`

**Example 3:**
\`\`\`
Input: s = "MCMXCIV"
Output: 1994
Explanation: M = 1000, CM = 900, XC = 90, IV = 4.
\`\`\``,
      constraints: `- 1 <= s.length <= 15\n- s contains only the characters ('I', 'V', 'X', 'L', 'C', 'D', 'M').\n- It is guaranteed that s is a valid roman numeral in the range [1, 3999].`,
      hints: JSON.stringify([
        "Build a map from symbol to value.",
        "Iterate left to right. If the current value is less than the next value, subtract it; otherwise add it.",
        "This handles all six subtraction cases automatically.",
      ]),
      starterCode: JSON.stringify({
        python: `def romanToInt(s: str) -> int:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {string} s\n * @return {number}\n */\nfunction romanToInt(s) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["String", "Math", "Hash Table"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: romanToIntProblem.id, tagId: id } },
      update: {},
      create: { problemId: romanToIntProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: romanToIntProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: romanToIntProblem.id, input: "III", expected: "3", isHidden: false, order: 1 },
      { problemId: romanToIntProblem.id, input: "LVIII", expected: "58", isHidden: false, order: 2 },
      { problemId: romanToIntProblem.id, input: "MCMXCIV", expected: "1994", isHidden: false, order: 3 },
      { problemId: romanToIntProblem.id, input: "IV", expected: "4", isHidden: true, order: 4 },
      { problemId: romanToIntProblem.id, input: "IX", expected: "9", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Roman to Integer");

  // Climbing Stairs
  const climbingStairsProblem = await prisma.problem.upsert({
    where: { slug: "climbing-stairs" },
    update: {},
    create: {
      title: "Climbing Stairs",
      slug: "climbing-stairs",
      difficulty: "Easy",
      order: 17,
      description: `You are climbing a staircase. It takes \`n\` steps to reach the top.

Each time you can either climb \`1\` or \`2\` steps. In how many distinct ways can you climb to the top?

**Example 1:**
\`\`\`
Input: n = 2
Output: 2
Explanation: There are two ways to climb to the top.
1. 1 step + 1 step
2. 2 steps
\`\`\`

**Example 2:**
\`\`\`
Input: n = 3
Output: 3
Explanation: There are three ways to climb to the top.
1. 1 step + 1 step + 1 step
2. 1 step + 2 steps
3. 2 steps + 1 step
\`\`\`

Notice that the number of ways to reach step \`n\` equals the number of ways to reach step \`n-1\` plus the number of ways to reach step \`n-2\` — this is the Fibonacci sequence!`,
      constraints: `- 1 <= n <= 45`,
      hints: JSON.stringify([
        "Think recursively: to reach step n, you came from step n-1 or step n-2.",
        "The recurrence is climbStairs(n) = climbStairs(n-1) + climbStairs(n-2).",
        "Use DP or just two variables to avoid recomputation.",
      ]),
      starterCode: JSON.stringify({
        python: `def climbStairs(n: int) -> int:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {number} n\n * @return {number}\n */\nfunction climbStairs(n) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["Math", "Dynamic Programming"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: climbingStairsProblem.id, tagId: id } },
      update: {},
      create: { problemId: climbingStairsProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: climbingStairsProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: climbingStairsProblem.id, input: "2", expected: "2", isHidden: false, order: 1 },
      { problemId: climbingStairsProblem.id, input: "3", expected: "3", isHidden: false, order: 2 },
      { problemId: climbingStairsProblem.id, input: "1", expected: "1", isHidden: false, order: 3 },
      { problemId: climbingStairsProblem.id, input: "5", expected: "8", isHidden: true, order: 4 },
      { problemId: climbingStairsProblem.id, input: "10", expected: "89", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Climbing Stairs");

  // Best Time to Buy and Sell Stock
  const stockProblem = await prisma.problem.upsert({
    where: { slug: "best-time-to-buy-and-sell-stock" },
    update: {},
    create: {
      title: "Best Time to Buy and Sell Stock",
      slug: "best-time-to-buy-and-sell-stock",
      difficulty: "Easy",
      order: 18,
      description: `You are given an array \`prices\` where \`prices[i]\` is the price of a given stock on the \`i\`th day.

You want to maximize your profit by choosing a **single day** to buy one stock and choosing a **different day in the future** to sell that stock.

Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return \`0\`.

**Example 1:**
\`\`\`
Input: prices = [7,1,5,3,6,4]
Output: 5
Explanation: Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6-1 = 5.
Note that buying on day 2 and selling on day 1 is not allowed because you must buy before you sell.
\`\`\`

**Example 2:**
\`\`\`
Input: prices = [7,6,4,3,1]
Output: 0
Explanation: In this case, no transactions are done and the max profit = 0.
\`\`\``,
      constraints: `- 1 <= prices.length <= 10^5\n- 0 <= prices[i] <= 10^4`,
      hints: JSON.stringify([
        "Track the minimum price seen so far as you iterate.",
        "At each day, the best profit is currentPrice - minPriceSoFar.",
        "Update the global max profit at each step.",
      ]),
      starterCode: JSON.stringify({
        python: `def maxProfit(prices: list[int]) -> int:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {number[]} prices\n * @return {number}\n */\nfunction maxProfit(prices) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["Array", "Dynamic Programming"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: stockProblem.id, tagId: id } },
      update: {},
      create: { problemId: stockProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: stockProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: stockProblem.id, input: "[7,1,5,3,6,4]", expected: "5", isHidden: false, order: 1 },
      { problemId: stockProblem.id, input: "[7,6,4,3,1]", expected: "0", isHidden: false, order: 2 },
      { problemId: stockProblem.id, input: "[1,2]", expected: "1", isHidden: false, order: 3 },
      { problemId: stockProblem.id, input: "[2,4,1]", expected: "2", isHidden: true, order: 4 },
      { problemId: stockProblem.id, input: "[3,3,3,3]", expected: "0", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Best Time to Buy and Sell Stock");

  // ── MEDIUM PROBLEMS ────────────────────────────────────────────────────────

  // Group Anagrams
  const groupAnagramsProblem = await prisma.problem.upsert({
    where: { slug: "group-anagrams" },
    update: {},
    create: {
      title: "Group Anagrams",
      slug: "group-anagrams",
      difficulty: "Medium",
      order: 19,
      description: `Given an array of strings \`strs\`, group the **anagrams** together. You can return the answer in **any order**.

An **anagram** is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.

**Example 1:**
\`\`\`
Input: strs = ["eat","tea","tan","ate","nat","bat"]
Output: [["bat"],["nat","tan"],["ate","eat","tea"]]
\`\`\`

**Example 2:**
\`\`\`
Input: strs = [""]
Output: [[""]]
\`\`\`

**Example 3:**
\`\`\`
Input: strs = ["a"]
Output: [["a"]]
\`\`\``,
      constraints: `- 1 <= strs.length <= 10^4\n- 0 <= strs[i].length <= 100\n- strs[i] consists of lowercase English letters.`,
      hints: JSON.stringify([
        "Two strings are anagrams if and only if their sorted characters are equal.",
        "Use a hash map where the key is the sorted string and the value is the list of anagrams.",
        "Alternatively, use a character frequency tuple as the key.",
      ]),
      starterCode: JSON.stringify({
        python: `def groupAnagrams(strs: list[str]) -> list[list[str]]:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {string[]} strs\n * @return {string[][]}\n */\nfunction groupAnagrams(strs) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["String", "Hash Table", "Sorting"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: groupAnagramsProblem.id, tagId: id } },
      update: {},
      create: { problemId: groupAnagramsProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: groupAnagramsProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: groupAnagramsProblem.id, input: '["eat","tea","tan","ate","nat","bat"]', expected: '[["bat"],["nat","tan"],["ate","eat","tea"]]', isHidden: false, order: 1 },
      { problemId: groupAnagramsProblem.id, input: '[""]', expected: '[[""]]', isHidden: false, order: 2 },
      { problemId: groupAnagramsProblem.id, input: '["a"]', expected: '[["a"]]', isHidden: false, order: 3 },
      { problemId: groupAnagramsProblem.id, input: '["abc","bca","cab","xyz"]', expected: '[["abc","bca","cab"],["xyz"]]', isHidden: true, order: 4 },
      { problemId: groupAnagramsProblem.id, input: '["ab","ba","cd","dc","ef"]', expected: '[["ab","ba"],["cd","dc"],["ef"]]', isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Group Anagrams");

  // 3Sum
  const threeSumProblem = await prisma.problem.upsert({
    where: { slug: "3sum" },
    update: {},
    create: {
      title: "3Sum",
      slug: "3sum",
      difficulty: "Medium",
      order: 20,
      description: `Given an integer array \`nums\`, return all the triplets \`[nums[i], nums[j], nums[k]]\` such that \`i != j\`, \`i != k\`, and \`j != k\`, and \`nums[i] + nums[j] + nums[k] == 0\`.

Notice that the solution set must not contain duplicate triplets.

**Example 1:**
\`\`\`
Input: nums = [-1,0,1,2,-1,-4]
Output: [[-1,-1,2],[-1,0,1]]
Explanation: nums[0] + nums[1] + nums[2] = (-1) + 0 + 1 = 0.
nums[1] + nums[2] + nums[4] = 0 + 1 + (-1) = 0.
The distinct triplets are [-1,0,1] and [-1,-1,2].
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [0,1,1]
Output: []
\`\`\`

**Example 3:**
\`\`\`
Input: nums = [0,0,0]
Output: [[0,0,0]]
\`\`\``,
      constraints: `- 3 <= nums.length <= 3000\n- -10^5 <= nums[i] <= 10^5`,
      hints: JSON.stringify([
        "Sort the array first. This makes it easy to skip duplicates.",
        "Fix one element and use two pointers on the remaining sorted subarray.",
        "Skip duplicate values for the fixed element and for the two pointers to avoid duplicate triplets.",
      ]),
      starterCode: JSON.stringify({
        python: `def threeSum(nums: list[int]) -> list[list[int]]:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {number[]} nums\n * @return {number[][]}\n */\nfunction threeSum(nums) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["Array", "Two Pointers", "Sorting"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: threeSumProblem.id, tagId: id } },
      update: {},
      create: { problemId: threeSumProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: threeSumProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: threeSumProblem.id, input: "[-1,0,1,2,-1,-4]", expected: "[[-1,-1,2],[-1,0,1]]", isHidden: false, order: 1 },
      { problemId: threeSumProblem.id, input: "[0,1,1]", expected: "[]", isHidden: false, order: 2 },
      { problemId: threeSumProblem.id, input: "[0,0,0]", expected: "[[0,0,0]]", isHidden: false, order: 3 },
      { problemId: threeSumProblem.id, input: "[-2,0,1,1,2]", expected: "[[-2,0,2],[-2,1,1]]", isHidden: true, order: 4 },
      { problemId: threeSumProblem.id, input: "[-4,-2,-2,-2,0,1,2,2,2,3,3,4,4,6,6]", expected: "[[-4,-2,6],[-4,0,4],[-4,1,3],[-4,2,2],[-2,-2,4],[-2,0,2]]", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: 3Sum");

  // Longest Palindromic Substring
  const longestPalindromeProblem = await prisma.problem.upsert({
    where: { slug: "longest-palindromic-substring" },
    update: {},
    create: {
      title: "Longest Palindromic Substring",
      slug: "longest-palindromic-substring",
      difficulty: "Medium",
      order: 21,
      description: `Given a string \`s\`, return the **longest palindromic substring** in \`s\`.

A **palindrome** is a string that reads the same forward and backward.

**Example 1:**
\`\`\`
Input: s = "babad"
Output: "bab"
Explanation: "aba" is also a valid answer.
\`\`\`

**Example 2:**
\`\`\`
Input: s = "cbbd"
Output: "bb"
\`\`\`

**Example 3:**
\`\`\`
Input: s = "racecar"
Output: "racecar"
\`\`\``,
      constraints: `- 1 <= s.length <= 1000\n- s consist of only digits and English letters.`,
      hints: JSON.stringify([
        "Expand around center: for each character (and each pair of adjacent characters), expand outward while the characters match.",
        "There are 2n-1 possible centers for a string of length n.",
        "Dynamic programming also works: dp[i][j] = true if s[i..j] is a palindrome.",
      ]),
      starterCode: JSON.stringify({
        python: `def longestPalindrome(s: str) -> str:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {string} s\n * @return {string}\n */\nfunction longestPalindrome(s) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["String", "Dynamic Programming", "Two Pointers"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: longestPalindromeProblem.id, tagId: id } },
      update: {},
      create: { problemId: longestPalindromeProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: longestPalindromeProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: longestPalindromeProblem.id, input: "babad", expected: "bab", isHidden: false, order: 1 },
      { problemId: longestPalindromeProblem.id, input: "cbbd", expected: "bb", isHidden: false, order: 2 },
      { problemId: longestPalindromeProblem.id, input: "a", expected: "a", isHidden: false, order: 3 },
      { problemId: longestPalindromeProblem.id, input: "racecar", expected: "racecar", isHidden: true, order: 4 },
      { problemId: longestPalindromeProblem.id, input: "abacaba", expected: "abacaba", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Longest Palindromic Substring");

  // Product of Array Except Self
  const productExceptSelfProblem = await prisma.problem.upsert({
    where: { slug: "product-of-array-except-self" },
    update: {},
    create: {
      title: "Product of Array Except Self",
      slug: "product-of-array-except-self",
      difficulty: "Medium",
      order: 22,
      description: `Given an integer array \`nums\`, return an array \`answer\` such that \`answer[i]\` is equal to the product of all the elements of \`nums\` except \`nums[i]\`.

The product of any prefix or suffix of \`nums\` is **guaranteed** to fit in a **32-bit** integer.

You must write an algorithm that runs in **O(n)** time and **without using the division operation**.

**Example 1:**
\`\`\`
Input: nums = [1,2,3,4]
Output: [24,12,8,6]
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [-1,1,0,-3,3]
Output: [0,0,9,0,0]
\`\`\`

**Follow-up:** Can you solve the problem in O(1) extra space complexity? (The output array does not count as extra space for this problem.)`,
      constraints: `- 2 <= nums.length <= 10^5\n- -30 <= nums[i] <= 30\n- The product of any prefix or suffix of nums is guaranteed to fit in a 32-bit integer.`,
      hints: JSON.stringify([
        "Build a prefix product array and a suffix product array.",
        "answer[i] = prefix[i-1] * suffix[i+1].",
        "To achieve O(1) space, use the output array itself to store prefix products, then do a right-to-left pass with a running suffix product.",
      ]),
      starterCode: JSON.stringify({
        python: `def productExceptSelf(nums: list[int]) -> list[int]:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {number[]} nums\n * @return {number[]}\n */\nfunction productExceptSelf(nums) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["Array"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: productExceptSelfProblem.id, tagId: id } },
      update: {},
      create: { problemId: productExceptSelfProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: productExceptSelfProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: productExceptSelfProblem.id, input: "[1,2,3,4]", expected: "[24,12,8,6]", isHidden: false, order: 1 },
      { problemId: productExceptSelfProblem.id, input: "[-1,1,0,-3,3]", expected: "[0,0,9,0,0]", isHidden: false, order: 2 },
      { problemId: productExceptSelfProblem.id, input: "[1,1]", expected: "[1,1]", isHidden: false, order: 3 },
      { problemId: productExceptSelfProblem.id, input: "[2,3,4,5]", expected: "[60,40,30,24]", isHidden: true, order: 4 },
      { problemId: productExceptSelfProblem.id, input: "[0,0]", expected: "[0,0]", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Product of Array Except Self");

  // Rotate Image
  const rotateImageProblem = await prisma.problem.upsert({
    where: { slug: "rotate-image" },
    update: {},
    create: {
      title: "Rotate Image",
      slug: "rotate-image",
      difficulty: "Medium",
      order: 23,
      description: `You are given an \`n x n\` 2D \`matrix\` representing an image, rotate the image by **90 degrees** (clockwise).

You have to rotate the image **in-place**, which means you have to modify the input 2D matrix directly. **DO NOT** allocate another 2D matrix and do the rotation.

**Example 1:**
\`\`\`
Input: matrix = [[1,2,3],[4,5,6],[7,8,9]]
Output: [[7,4,1],[8,5,2],[9,6,3]]
\`\`\`

**Example 2:**
\`\`\`
Input: matrix = [[5,1,9,11],[2,4,8,10],[13,3,6,7],[15,14,12,16]]
Output: [[15,13,2,5],[14,3,4,1],[12,6,8,9],[16,7,10,11]]
\`\`\``,
      constraints: `- n == matrix.length == matrix[i].length\n- 1 <= n <= 20\n- -1000 <= matrix[i][j] <= 1000`,
      hints: JSON.stringify([
        "A 90-degree clockwise rotation = transpose + reverse each row.",
        "First transpose the matrix (swap matrix[i][j] with matrix[j][i]).",
        "Then reverse each row in place.",
      ]),
      starterCode: JSON.stringify({
        python: `def rotate(matrix: list[list[int]]) -> None:\n    # Modify matrix in-place, do not return anything\n    pass`,
        javascript: `/**\n * @param {number[][]} matrix\n * @return {void}\n */\nfunction rotate(matrix) {\n    // Modify matrix in-place, do not return anything\n}`,
      }),
    },
  });
  for (const id of tagIds(["Array", "Math"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: rotateImageProblem.id, tagId: id } },
      update: {},
      create: { problemId: rotateImageProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: rotateImageProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: rotateImageProblem.id, input: "[[1,2,3],[4,5,6],[7,8,9]]", expected: "[[7,4,1],[8,5,2],[9,6,3]]", isHidden: false, order: 1 },
      { problemId: rotateImageProblem.id, input: "[[5,1,9,11],[2,4,8,10],[13,3,6,7],[15,14,12,16]]", expected: "[[15,13,2,5],[14,3,4,1],[12,6,8,9],[16,7,10,11]]", isHidden: false, order: 2 },
      { problemId: rotateImageProblem.id, input: "[[1]]", expected: "[[1]]", isHidden: false, order: 3 },
      { problemId: rotateImageProblem.id, input: "[[1,2],[3,4]]", expected: "[[3,1],[4,2]]", isHidden: true, order: 4 },
      { problemId: rotateImageProblem.id, input: "[[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16]]", expected: "[[13,9,5,1],[14,10,6,2],[15,11,7,3],[16,12,8,4]]", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Rotate Image");

  // Search in Rotated Sorted Array
  const searchRotatedProblem = await prisma.problem.upsert({
    where: { slug: "search-in-rotated-sorted-array" },
    update: {},
    create: {
      title: "Search in Rotated Sorted Array",
      slug: "search-in-rotated-sorted-array",
      difficulty: "Medium",
      order: 24,
      description: `There is an integer array \`nums\` sorted in ascending order (with **distinct** values).

Prior to being passed to your function, \`nums\` is **possibly rotated** at an unknown pivot index \`k\` (\`1 <= k < nums.length\`) such that the resulting array is \`[nums[k], nums[k+1], ..., nums[n-1], nums[0], nums[1], ..., nums[k-1]]\` (0-indexed). For example, \`[0,1,2,4,5,6,7]\` might be rotated at pivot index \`3\` and become \`[4,5,6,7,0,1,2]\`.

Given the array \`nums\` after the possible rotation and an integer \`target\`, return the index of \`target\` if it is in \`nums\`, or \`-1\` if it is not in \`nums\`.

You must write an algorithm with **O(log n)** runtime complexity.

**Example 1:**
\`\`\`
Input: nums = [4,5,6,7,0,1,2], target = 0
Output: 4
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [4,5,6,7,0,1,2], target = 3
Output: -1
\`\`\`

**Example 3:**
\`\`\`
Input: nums = [1], target = 0
Output: -1
\`\`\``,
      constraints: `- 1 <= nums.length <= 5000\n- -10^4 <= nums[i] <= 10^4\n- All values of nums are unique.\n- nums is an ascending array that is possibly rotated.\n- -10^4 <= target <= 10^4`,
      hints: JSON.stringify([
        "Use binary search. At each step, determine which half is sorted.",
        "If nums[left] <= nums[mid], the left half is sorted. Check if target falls in that range.",
        "Otherwise the right half is sorted. Check if target falls in that range.",
      ]),
      starterCode: JSON.stringify({
        python: `def search(nums: list[int], target: int) -> int:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number}\n */\nfunction search(nums, target) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["Array", "Binary Search"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: searchRotatedProblem.id, tagId: id } },
      update: {},
      create: { problemId: searchRotatedProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: searchRotatedProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: searchRotatedProblem.id, input: "[4,5,6,7,0,1,2]\n0", expected: "4", isHidden: false, order: 1 },
      { problemId: searchRotatedProblem.id, input: "[4,5,6,7,0,1,2]\n3", expected: "-1", isHidden: false, order: 2 },
      { problemId: searchRotatedProblem.id, input: "[1]\n0", expected: "-1", isHidden: false, order: 3 },
      { problemId: searchRotatedProblem.id, input: "[3,1]\n1", expected: "1", isHidden: true, order: 4 },
      { problemId: searchRotatedProblem.id, input: "[5,1,3]\n3", expected: "2", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Search in Rotated Sorted Array");

  // Letter Combinations of a Phone Number
  const letterCombinationsProblem = await prisma.problem.upsert({
    where: { slug: "letter-combinations-of-a-phone-number" },
    update: {},
    create: {
      title: "Letter Combinations of a Phone Number",
      slug: "letter-combinations-of-a-phone-number",
      difficulty: "Medium",
      order: 25,
      description: `Given a string containing digits from \`2-9\` inclusive, return all possible letter combinations that the number could represent. Return the answer in **any order**.

A mapping of digits to letters (just like on the telephone buttons) is given below. Note that 1 does not map to any letters.

| Digit | Letters |
|-------|---------|
| 2     | abc     |
| 3     | def     |
| 4     | ghi     |
| 5     | jkl     |
| 6     | mno     |
| 7     | pqrs    |
| 8     | tuv     |
| 9     | wxyz    |

**Example 1:**
\`\`\`
Input: digits = "23"
Output: ["ad","ae","af","bd","be","bf","cd","ce","cf"]
\`\`\`

**Example 2:**
\`\`\`
Input: digits = ""
Output: []
\`\`\`

**Example 3:**
\`\`\`
Input: digits = "2"
Output: ["a","b","c"]
\`\`\``,
      constraints: `- 0 <= digits.length <= 4\n- digits[i] is a digit in the range ['2', '9'].`,
      hints: JSON.stringify([
        "Use backtracking or BFS to build combinations character by character.",
        "Maintain a phone map from digit to its letters.",
        "At each step, append each possible letter for the current digit and recurse.",
      ]),
      starterCode: JSON.stringify({
        python: `def letterCombinations(digits: str) -> list[str]:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {string} digits\n * @return {string[]}\n */\nfunction letterCombinations(digits) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["String", "Hash Table"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: letterCombinationsProblem.id, tagId: id } },
      update: {},
      create: { problemId: letterCombinationsProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: letterCombinationsProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: letterCombinationsProblem.id, input: "23", expected: '["ad","ae","af","bd","be","bf","cd","ce","cf"]', isHidden: false, order: 1 },
      { problemId: letterCombinationsProblem.id, input: "", expected: "[]", isHidden: false, order: 2 },
      { problemId: letterCombinationsProblem.id, input: "2", expected: '["a","b","c"]', isHidden: false, order: 3 },
      { problemId: letterCombinationsProblem.id, input: "9", expected: '["w","x","y","z"]', isHidden: true, order: 4 },
      { problemId: letterCombinationsProblem.id, input: "234", expected: '["adg","adh","adi","aeg","aeh","aei","afg","afh","afi","bdg","bdh","bdi","beg","beh","bei","bfg","bfh","bfi","cdg","cdh","cdi","ceg","ceh","cei","cfg","cfh","cfi"]', isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Letter Combinations of a Phone Number");

  // Generate Parentheses
  const generateParenthesesProblem = await prisma.problem.upsert({
    where: { slug: "generate-parentheses" },
    update: {},
    create: {
      title: "Generate Parentheses",
      slug: "generate-parentheses",
      difficulty: "Medium",
      order: 26,
      description: `Given \`n\` pairs of parentheses, write a function to generate all combinations of well-formed parentheses.

**Example 1:**
\`\`\`
Input: n = 3
Output: ["((()))","(()())","(())()","()(())","()()()"]
\`\`\`

**Example 2:**
\`\`\`
Input: n = 1
Output: ["()"]
\`\`\`

A combination is **well-formed** if every opening bracket has a corresponding closing bracket and they are properly nested.`,
      constraints: `- 1 <= n <= 8`,
      hints: JSON.stringify([
        "Use backtracking. Track the count of open and close brackets used so far.",
        "You can add an open bracket if open < n.",
        "You can add a close bracket if close < open.",
        "When open == close == n, you have a valid combination.",
      ]),
      starterCode: JSON.stringify({
        python: `def generateParenthesis(n: int) -> list[str]:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {number} n\n * @return {string[]}\n */\nfunction generateParenthesis(n) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["String", "Dynamic Programming"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: generateParenthesesProblem.id, tagId: id } },
      update: {},
      create: { problemId: generateParenthesesProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: generateParenthesesProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: generateParenthesesProblem.id, input: "3", expected: '["((()))","(()())","(())()","()(())","()()()"]', isHidden: false, order: 1 },
      { problemId: generateParenthesesProblem.id, input: "1", expected: '["()"]', isHidden: false, order: 2 },
      { problemId: generateParenthesesProblem.id, input: "2", expected: '["(())","()()"]', isHidden: false, order: 3 },
      { problemId: generateParenthesesProblem.id, input: "4", expected: '["(((())))","((()()))","((()))()","(()(()))","(()()())","(()())()","(())(())","(())()()","()((())) ","()((()))","()(()())","()(())()","()()(())","()()()()"]', isHidden: true, order: 4 },
    ],
  });
  console.log("Created: Generate Parentheses");

  // ── HARD PROBLEMS ──────────────────────────────────────────────────────────

  // Trapping Rain Water
  const trappingRainProblem = await prisma.problem.upsert({
    where: { slug: "trapping-rain-water" },
    update: {},
    create: {
      title: "Trapping Rain Water",
      slug: "trapping-rain-water",
      difficulty: "Hard",
      order: 27,
      description: `Given \`n\` non-negative integers representing an elevation map where the width of each bar is \`1\`, compute how much water it can trap after raining.

**Example 1:**
\`\`\`
Input: height = [0,1,0,2,1,0,1,3,2,1,2,1]
Output: 6
Explanation: The elevation map is represented by array [0,1,0,2,1,0,1,3,2,1,2,1].
In this case, 6 units of rain water are being trapped.
\`\`\`

**Example 2:**
\`\`\`
Input: height = [4,2,0,3,2,5]
Output: 9
\`\`\`

The water trapped at position \`i\` is determined by the minimum of the maximum heights to its left and right, minus the height at \`i\` itself. The key insight is that you only need to track the running max from each side.`,
      constraints: `- n == height.length\n- 1 <= n <= 2 * 10^4\n- 0 <= height[i] <= 10^5`,
      hints: JSON.stringify([
        "For each position, water = min(maxLeft, maxRight) - height[i]. Precompute prefix max and suffix max arrays.",
        "Two-pointer approach: maintain left and right pointers. Move the pointer with the smaller max inward.",
        "The two-pointer approach achieves O(n) time and O(1) space.",
      ]),
      starterCode: JSON.stringify({
        python: `def trap(height: list[int]) -> int:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {number[]} height\n * @return {number}\n */\nfunction trap(height) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["Array", "Two Pointers", "Dynamic Programming", "Stack"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: trappingRainProblem.id, tagId: id } },
      update: {},
      create: { problemId: trappingRainProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: trappingRainProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: trappingRainProblem.id, input: "[0,1,0,2,1,0,1,3,2,1,2,1]", expected: "6", isHidden: false, order: 1 },
      { problemId: trappingRainProblem.id, input: "[4,2,0,3,2,5]", expected: "9", isHidden: false, order: 2 },
      { problemId: trappingRainProblem.id, input: "[1,0,1]", expected: "1", isHidden: false, order: 3 },
      { problemId: trappingRainProblem.id, input: "[3,0,2,0,4]", expected: "7", isHidden: true, order: 4 },
      { problemId: trappingRainProblem.id, input: "[0,0,0]", expected: "0", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Trapping Rain Water");

  // Merge K Sorted Lists
  const mergeKListsProblem = await prisma.problem.upsert({
    where: { slug: "merge-k-sorted-lists" },
    update: {},
    create: {
      title: "Merge K Sorted Lists",
      slug: "merge-k-sorted-lists",
      difficulty: "Hard",
      order: 28,
      description: `You are given an array of \`k\` linked-lists \`lists\`, each linked-list is sorted in ascending order.

Merge all the linked-lists into one sorted linked-list and return it.

**Example 1:**
\`\`\`
Input: lists = [[1,4,5],[1,3,4],[2,6]]
Output: [1,1,2,3,4,4,5,6]
Explanation: The linked-lists are:
[
  1->4->5,
  1->3->4,
  2->6
]
merging them into one sorted list:
1->1->2->3->4->4->5->6
\`\`\`

**Example 2:**
\`\`\`
Input: lists = []
Output: []
\`\`\`

**Example 3:**
\`\`\`
Input: lists = [[]]
Output: []
\`\`\``,
      constraints: `- k == lists.length\n- 0 <= k <= 10^4\n- 0 <= lists[i].length <= 500\n- -10^4 <= lists[i][j] <= 10^4\n- lists[i] is sorted in ascending order.\n- The sum of lists[i].length will not exceed 10^4.`,
      hints: JSON.stringify([
        "A min-heap (priority queue) of size k lets you always extract the smallest current node in O(log k).",
        "Divide and conquer: repeatedly merge pairs of lists. This gives O(N log k) time.",
        "Avoid the naive O(kN) approach of merging one list at a time from left to right.",
      ]),
      starterCode: JSON.stringify({
        python: `from typing import Optional\n\nclass ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef mergeKLists(lists: list[Optional[ListNode]]) -> Optional[ListNode]:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * function ListNode(val, next) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.next = (next===undefined ? null : next)\n * }\n * @param {ListNode[]} lists\n * @return {ListNode}\n */\nfunction mergeKLists(lists) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["Linked List", "Sorting"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: mergeKListsProblem.id, tagId: id } },
      update: {},
      create: { problemId: mergeKListsProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: mergeKListsProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: mergeKListsProblem.id, input: "[[1,4,5],[1,3,4],[2,6]]", expected: "[1,1,2,3,4,4,5,6]", isHidden: false, order: 1 },
      { problemId: mergeKListsProblem.id, input: "[]", expected: "[]", isHidden: false, order: 2 },
      { problemId: mergeKListsProblem.id, input: "[[]]", expected: "[]", isHidden: false, order: 3 },
      { problemId: mergeKListsProblem.id, input: "[[1],[2],[3]]", expected: "[1,2,3]", isHidden: true, order: 4 },
      { problemId: mergeKListsProblem.id, input: "[[-1,0,1],[-2,0,2]]", expected: "[-2,-1,0,0,1,2]", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Merge K Sorted Lists");

  // Regular Expression Matching
  const regexMatchingProblem = await prisma.problem.upsert({
    where: { slug: "regular-expression-matching" },
    update: {},
    create: {
      title: "Regular Expression Matching",
      slug: "regular-expression-matching",
      difficulty: "Hard",
      order: 29,
      description: `Given an input string \`s\` and a pattern \`p\`, implement regular expression matching with support for \`'.'\` and \`'*'\` where:

- \`'.'\` Matches any single character.
- \`'*'\` Matches zero or more of the preceding element.

The matching should cover the **entire** input string (not partial).

**Example 1:**
\`\`\`
Input: s = "aa", p = "a"
Output: false
Explanation: "a" does not match the entire string "aa".
\`\`\`

**Example 2:**
\`\`\`
Input: s = "aa", p = "a*"
Output: true
Explanation: '*' means zero or more of the preceding element, 'a'. Therefore, by repeating 'a' once, it becomes "aa".
\`\`\`

**Example 3:**
\`\`\`
Input: s = "ab", p = ".*"
Output: true
Explanation: ".*" means "zero or more (*) of any character (.)".
\`\`\``,
      constraints: `- 1 <= s.length <= 20\n- 1 <= p.length <= 20\n- s contains only lowercase English letters.\n- p contains only lowercase English letters, '.', and '*'.\n- It is guaranteed for each appearance of the character '*', there will be a previous valid character to match.`,
      hints: JSON.stringify([
        "Use dynamic programming. Let dp[i][j] = true if s[0..i-1] matches p[0..j-1].",
        "Base case: dp[0][0] = true. Handle patterns like a* or a*b* that can match empty string.",
        "Transition: if p[j-1] == '*', dp[i][j] = dp[i][j-2] (zero occurrences) OR (p[j-2] matches s[i-1] AND dp[i-1][j]).",
      ]),
      starterCode: JSON.stringify({
        python: `def isMatch(s: str, p: str) -> bool:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {string} s\n * @param {string} p\n * @return {boolean}\n */\nfunction isMatch(s, p) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["String", "Dynamic Programming"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: regexMatchingProblem.id, tagId: id } },
      update: {},
      create: { problemId: regexMatchingProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: regexMatchingProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: regexMatchingProblem.id, input: "aa\na", expected: "false", isHidden: false, order: 1 },
      { problemId: regexMatchingProblem.id, input: "aa\na*", expected: "true", isHidden: false, order: 2 },
      { problemId: regexMatchingProblem.id, input: "ab\n.*", expected: "true", isHidden: false, order: 3 },
      { problemId: regexMatchingProblem.id, input: "aab\nc*a*b", expected: "true", isHidden: true, order: 4 },
      { problemId: regexMatchingProblem.id, input: "mississippi\nmis*is*p*.", expected: "false", isHidden: true, order: 5 },
    ],
  });
  console.log("Created: Regular Expression Matching");

  // N-Queens
  const nQueensProblem = await prisma.problem.upsert({
    where: { slug: "n-queens" },
    update: {},
    create: {
      title: "N-Queens",
      slug: "n-queens",
      difficulty: "Hard",
      order: 30,
      description: `The **n-queens** puzzle is the problem of placing \`n\` queens on an \`n x n\` chessboard such that no two queens attack each other.

Given an integer \`n\`, return all distinct solutions to the **n-queens puzzle**. You may return the answer in **any order**.

Each solution contains a distinct board configuration of the n-queens' placement, where \`'Q'\` and \`'.'\` both indicate a queen and an empty space, respectively.

**Example 1:**
\`\`\`
Input: n = 4
Output: [[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]]
Explanation: There exist two distinct solutions to the 4-queens puzzle as shown above.
\`\`\`

**Example 2:**
\`\`\`
Input: n = 1
Output: [["Q"]]
\`\`\`

A queen can attack any piece in the same row, column, or diagonal. The challenge is to place all n queens so none threatens another.`,
      constraints: `- 1 <= n <= 9`,
      hints: JSON.stringify([
        "Use backtracking. Place queens row by row.",
        "Track which columns and diagonals are already occupied using sets.",
        "For diagonals, use (row - col) for one diagonal direction and (row + col) for the other.",
        "When all n rows are filled, record the board configuration.",
      ]),
      starterCode: JSON.stringify({
        python: `def solveNQueens(n: int) -> list[list[str]]:\n    # Write your solution here\n    pass`,
        javascript: `/**\n * @param {number} n\n * @return {string[][]}\n */\nfunction solveNQueens(n) {\n    // Write your solution here\n}`,
      }),
    },
  });
  for (const id of tagIds(["Array", "String"])) {
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: nQueensProblem.id, tagId: id } },
      update: {},
      create: { problemId: nQueensProblem.id, tagId: id },
    });
  }
  await prisma.testCase.deleteMany({ where: { problemId: nQueensProblem.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: nQueensProblem.id, input: "4", expected: '[[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]]', isHidden: false, order: 1 },
      { problemId: nQueensProblem.id, input: "1", expected: '[["Q"]]', isHidden: false, order: 2 },
      { problemId: nQueensProblem.id, input: "2", expected: "[]", isHidden: false, order: 3 },
      { problemId: nQueensProblem.id, input: "3", expected: "[]", isHidden: true, order: 4 },
      { problemId: nQueensProblem.id, input: "5", expected: '[[".Q...","...Q.","Q....","..Q..","....Q"],["..Q..","Q....","...Q.",".Q...","....Q"],["..Q..","....Q",".Q...","...Q.","Q...."],["...Q.","Q....","..Q..","....Q",".Q..."],["...Q.",".Q...","....Q","..Q..","Q...."],["....Q",".Q...","...Q.","Q....","..Q.."],["....Q","..Q..","Q....","...Q.",".Q..."],["Q....","..Q..","....Q",".Q...","...Q."],["Q....","...Q.",".Q...","....Q","..Q.."],["Q....","....Q","..Q..",".Q...","...Q."]]', isHidden: true, order: 5 },
    ],
  });
  console.log("Created: N-Queens");

  // ── CONTESTS ───────────────────────────────────────────────────────────────

  const now = new Date();

  // Active contest (started 1 hour ago, ends in 1 hour)
  const activeStart = new Date(now.getTime() - 60 * 60 * 1000);
  const activeEnd = new Date(now.getTime() + 60 * 60 * 1000);
  const activeContest = await prisma.contest.upsert({
    where: { slug: "weekly-contest-2" },
    update: {},
    create: {
      title: "LeetRank Weekly Contest #2",
      slug: "weekly-contest-2",
      description: "The second LeetRank weekly contest is live! Tackle array and string problems under time pressure.",
      startTime: activeStart,
      endTime: activeEnd,
      status: "active",
    },
  });

  // Assign problems to active contest
  const activeContestProblems = [
    { slug: "fibonacci-number", order: 1, points: 100 },
    { slug: "valid-anagram", order: 2, points: 100 },
    { slug: "maximum-subarray", order: 3, points: 200 },
    { slug: "group-anagrams", order: 4, points: 300 },
    { slug: "trapping-rain-water", order: 5, points: 500 },
  ];
  for (const cp of activeContestProblems) {
    const prob = await prisma.problem.findUnique({ where: { slug: cp.slug } });
    if (prob) {
      await prisma.contestProblem.upsert({
        where: { contestId_problemId: { contestId: activeContest.id, problemId: prob.id } },
        update: {},
        create: { contestId: activeContest.id, problemId: prob.id, order: cp.order, points: cp.points },
      });
    }
  }
  console.log("Created: Active contest (Weekly #2)");

  // Ended contest (ended 2 days ago)
  const endedStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const endedEnd = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const endedContest = await prisma.contest.upsert({
    where: { slug: "biweekly-contest-1" },
    update: {},
    create: {
      title: "LeetRank Biweekly Contest #1",
      slug: "biweekly-contest-1",
      description: "The first LeetRank biweekly contest. Focused on dynamic programming and binary search.",
      startTime: endedStart,
      endTime: endedEnd,
      status: "ended",
    },
  });

  // Assign problems to ended contest
  const endedContestProblems = [
    { slug: "climbing-stairs", order: 1, points: 100 },
    { slug: "best-time-to-buy-and-sell-stock", order: 2, points: 100 },
    { slug: "search-in-rotated-sorted-array", order: 3, points: 300 },
    { slug: "longest-palindromic-substring", order: 4, points: 300 },
    { slug: "regular-expression-matching", order: 5, points: 500 },
    { slug: "n-queens", order: 6, points: 500 },
  ];
  for (const cp of endedContestProblems) {
    const prob = await prisma.problem.findUnique({ where: { slug: cp.slug } });
    if (prob) {
      await prisma.contestProblem.upsert({
        where: { contestId_problemId: { contestId: endedContest.id, problemId: prob.id } },
        update: {},
        create: { contestId: endedContest.id, problemId: prob.id, order: cp.order, points: cp.points },
      });
    }
  }
  console.log("Created: Ended contest (Biweekly #1)");

  // ── SUBMISSIONS ────────────────────────────────────────────────────────────

  const allProblems = await prisma.problem.findMany();
  const user1Id = userMap["user1"];
  const user2Id = userMap["user2"];

  if (!user1Id || !user2Id) {
    console.warn("user1 or user2 not found — skipping submissions");
  } else {
    const statuses = ["accepted", "wrong_answer", "runtime_error", "accepted", "accepted"];
    const languages = ["python", "javascript"];

    const sampleCodes: Record<string, Record<string, string>> = {
      python: {
        accepted: `def solution(nums):\n    seen = {}\n    for i, n in enumerate(nums):\n        if n in seen:\n            return [seen[n], i]\n        seen[n] = i\n    return []`,
        wrong_answer: `def solution(nums):\n    return [0, 1]`,
        runtime_error: `def solution(nums):\n    return nums[999999]`,
      },
      javascript: {
        accepted: `function solution(nums) {\n    const map = {};\n    for (let i = 0; i < nums.length; i++) {\n        if (map[nums[i]] !== undefined) return [map[nums[i]], i];\n        map[nums[i]] = i;\n    }\n}`,
        wrong_answer: `function solution(nums) {\n    return [0, 1];\n}`,
        runtime_error: `function solution(nums) {\n    return nums[999999].toString();\n}`,
      },
    };

    let submissionCount = 0;
    const targetCount = 100;

    // Spread submissions across problems and users
    for (let i = 0; i < targetCount; i++) {
      const problem = allProblems[i % allProblems.length];
      const userId = i % 3 === 0 ? user2Id : user1Id;
      const lang = languages[i % languages.length];
      const statusKey = statuses[i % statuses.length] as "accepted" | "wrong_answer" | "runtime_error";
      const code = sampleCodes[lang][statusKey] || sampleCodes[lang]["accepted"];

      const createdAt = new Date(now.getTime() - (targetCount - i) * 15 * 60 * 1000); // spaced 15 min apart

      await prisma.submission.create({
        data: {
          userId,
          problemId: problem.id,
          language: lang,
          code,
          status: statusKey,
          runtime: statusKey === "accepted" ? Math.floor(Math.random() * 200) + 20 : null,
          memory: statusKey === "accepted" ? Math.floor(Math.random() * 30000) + 10000 : null,
          output: statusKey === "accepted" ? "All test cases passed" : null,
          error: statusKey === "runtime_error" ? "IndexError: list index out of range" : null,
          createdAt,
        },
      });
      submissionCount++;
    }
    console.log(`Created ${submissionCount} submissions`);
  }
}

seedExtra()
  .then(() => {
    console.log("Extra seed complete");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
