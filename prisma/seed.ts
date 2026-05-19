import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedAchievements } from "./seed-achievements";

const prisma = new PrismaClient();

const tags = [
  { name: "Array", slug: "array" },
  { name: "String", slug: "string" },
  { name: "Math", slug: "math" },
  { name: "Stack", slug: "stack" },
  { name: "Linked List", slug: "linked-list" },
  { name: "Binary Search", slug: "binary-search" },
  { name: "Two Pointers", slug: "two-pointers" },
  { name: "Dynamic Programming", slug: "dynamic-programming" },
  { name: "Hash Table", slug: "hash-table" },
  { name: "Sorting", slug: "sorting" },
];

const problems = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  {
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "Easy",
    order: 1,
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.

**Example 1:**
\`\`\`
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [3,2,4], target = 6
Output: [1,2]
\`\`\`

**Example 3:**
\`\`\`
Input: nums = [3,3], target = 6
Output: [0,1]
\`\`\``,
    constraints: `- 2 <= nums.length <= 10^4
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Only one valid answer exists.`,
    hints: JSON.stringify([
      "A brute force approach is O(n²). Can you do better?",
      "Think about using a hash map to store complements.",
      "For each number x, check if target - x exists in the map.",
    ]),
    starterCode: JSON.stringify({
      python: `def twoSum(nums: list[int], target: int) -> list[int]:
    # Write your solution here
    pass

# ─── Judge harness — do not remove ───────────────────────────────────────────
# Reads two lines of stdin: a JSON array of nums and a target int. Auto-detects
# either a top-level twoSum() or a LeetCode-style Solution.twoSum() so the
# canonical class-based answer also works.
if __name__ == "__main__":
    import sys, json
    _raw = sys.stdin.read().splitlines()
    _nums = json.loads(_raw[0])
    _target = int(_raw[1])
    if "Solution" in globals():
        _ans = Solution().twoSum(_nums, _target)
    else:
        _ans = twoSum(_nums, _target)
    print(json.dumps(_ans, separators=(",", ":")))`,
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
    // Write your solution here
}

// ─── Judge harness — do not remove ──────────────────────────────────────────
let __data = "";
process.stdin.on("data", (c) => { __data += c; });
process.stdin.on("end", () => {
    const __lines = __data.trim().split("\\n");
    const __nums = JSON.parse(__lines[0]);
    const __target = parseInt(__lines[1], 10);
    console.log(JSON.stringify(twoSum(__nums, __target)));
});`,
    }),
    tags: ["array", "hash-table"],
    testCases: [
      { input: "[2,7,11,15]\n9", expected: "[0,1]", isHidden: false, order: 1 },
      { input: "[3,2,4]\n6", expected: "[1,2]", isHidden: false, order: 2 },
      { input: "[3,3]\n6", expected: "[0,1]", isHidden: false, order: 3 },
      { input: "[1,2,3,4,5]\n9", expected: "[3,4]", isHidden: true, order: 4 },
      { input: "[-1,-2,-3,-4,-5]\n-8", expected: "[2,4]", isHidden: true, order: 5 },
    ],
  },
  {
    title: "Reverse String",
    slug: "reverse-string",
    difficulty: "Easy",
    order: 2,
    description: `Write a function that reverses a string. The input string is given as an array of characters \`s\`.

You must do this by modifying the input array **in-place** with O(1) extra memory.

**Example 1:**
\`\`\`
Input: s = ["h","e","l","l","o"]
Output: ["o","l","l","e","h"]
\`\`\`

**Example 2:**
\`\`\`
Input: s = ["H","a","n","n","a","h"]
Output: ["h","a","n","n","a","H"]
\`\`\``,
    constraints: `- 1 <= s.length <= 10^5
- s[i] is a printable ASCII character.`,
    hints: JSON.stringify([
      "Use two pointers — one at the start and one at the end.",
      "Swap the characters at the two pointers, then move them toward the center.",
    ]),
    starterCode: JSON.stringify({
      python: `def reverseString(s: list[str]) -> None:
    # Modify s in-place, do not return anything
    pass`,
      javascript: `/**
 * @param {character[]} s
 * @return {void}
 */
function reverseString(s) {
    // Modify s in-place, do not return anything
}`,
    }),
    tags: ["string", "two-pointers"],
    testCases: [
      { input: '["h","e","l","l","o"]', expected: '["o","l","l","e","h"]', isHidden: false, order: 1 },
      { input: '["H","a","n","n","a","h"]', expected: '["h","a","n","n","a","H"]', isHidden: false, order: 2 },
      { input: '["a"]', expected: '["a"]', isHidden: false, order: 3 },
      { input: '["a","b"]', expected: '["b","a"]', isHidden: true, order: 4 },
    ],
  },
  {
    title: "FizzBuzz",
    slug: "fizzbuzz",
    difficulty: "Easy",
    order: 3,
    description: `Given an integer \`n\`, return a string array \`answer\` (**1-indexed**) where:

- \`answer[i] == "FizzBuzz"\` if \`i\` is divisible by 3 and 5.
- \`answer[i] == "Fizz"\` if \`i\` is divisible by 3.
- \`answer[i] == "Buzz"\` if \`i\` is divisible by 5.
- \`answer[i] == i\` (as a string) if none of the above conditions are true.

**Example 1:**
\`\`\`
Input: n = 3
Output: ["1","2","Fizz"]
\`\`\`

**Example 2:**
\`\`\`
Input: n = 5
Output: ["1","2","Fizz","4","Buzz"]
\`\`\`

**Example 3:**
\`\`\`
Input: n = 15
Output: ["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]
\`\`\``,
    constraints: `- 1 <= n <= 10^4`,
    hints: JSON.stringify([
      "Check divisibility by 15 first (both 3 and 5), then 3, then 5.",
      "Use the modulo operator %.",
    ]),
    starterCode: JSON.stringify({
      python: `def fizzBuzz(n: int) -> list[str]:
    # Write your solution here
    pass`,
      javascript: `/**
 * @param {number} n
 * @return {string[]}
 */
function fizzBuzz(n) {
    // Write your solution here
}`,
    }),
    tags: ["math", "string"],
    testCases: [
      { input: "3", expected: '["1","2","Fizz"]', isHidden: false, order: 1 },
      { input: "5", expected: '["1","2","Fizz","4","Buzz"]', isHidden: false, order: 2 },
      { input: "15", expected: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]', isHidden: false, order: 3 },
      { input: "1", expected: '["1"]', isHidden: true, order: 4 },
    ],
  },
  {
    title: "Palindrome Number",
    slug: "palindrome-number",
    difficulty: "Easy",
    order: 4,
    description: `Given an integer \`x\`, return \`true\` if \`x\` is a **palindrome**, and \`false\` otherwise.

An integer is a palindrome when it reads the same forward and backward. For example, \`121\` is a palindrome while \`123\` is not.

**Example 1:**
\`\`\`
Input: x = 121
Output: true
Explanation: 121 reads as 121 from left to right and from right to left.
\`\`\`

**Example 2:**
\`\`\`
Input: x = -121
Output: false
Explanation: From left to right, it reads -121. From right to left, it becomes 121-. Therefore it is not a palindrome.
\`\`\`

**Example 3:**
\`\`\`
Input: x = 10
Output: false
Explanation: Reads 01 from right to left. Therefore it is not a palindrome.
\`\`\``,
    constraints: `- -2^31 <= x <= 2^31 - 1`,
    hints: JSON.stringify([
      "Negative numbers are never palindromes.",
      "Numbers ending in 0 (except 0 itself) are not palindromes.",
      "Try reversing only half the number to avoid overflow.",
    ]),
    starterCode: JSON.stringify({
      python: `def isPalindrome(x: int) -> bool:
    # Write your solution here
    pass`,
      javascript: `/**
 * @param {number} x
 * @return {boolean}
 */
function isPalindrome(x) {
    // Write your solution here
}`,
    }),
    tags: ["math"],
    testCases: [
      { input: "121", expected: "true", isHidden: false, order: 1 },
      { input: "-121", expected: "false", isHidden: false, order: 2 },
      { input: "10", expected: "false", isHidden: false, order: 3 },
      { input: "0", expected: "true", isHidden: true, order: 4 },
      { input: "1221", expected: "true", isHidden: true, order: 5 },
    ],
  },

  // ── Medium ────────────────────────────────────────────────────────────────
  {
    title: "Valid Parentheses",
    slug: "valid-parentheses",
    difficulty: "Medium",
    order: 5,
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

**Example 1:**
\`\`\`
Input: s = "()"
Output: true
\`\`\`

**Example 2:**
\`\`\`
Input: s = "()[]{}"
Output: true
\`\`\`

**Example 3:**
\`\`\`
Input: s = "(]"
Output: false
\`\`\`

**Example 4:**
\`\`\`
Input: s = "([)]"
Output: false
\`\`\``,
    constraints: `- 1 <= s.length <= 10^4
- s consists of parentheses only '()[]{}'.`,
    hints: JSON.stringify([
      "Use a stack data structure.",
      "Push opening brackets onto the stack.",
      "When you see a closing bracket, check if the top of the stack is the matching opener.",
    ]),
    starterCode: JSON.stringify({
      python: `def isValid(s: str) -> bool:
    # Write your solution here
    pass`,
      javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
    // Write your solution here
}`,
    }),
    tags: ["string", "stack"],
    testCases: [
      { input: "()", expected: "true", isHidden: false, order: 1 },
      { input: "()[]{}", expected: "true", isHidden: false, order: 2 },
      { input: "(]", expected: "false", isHidden: false, order: 3 },
      { input: "([)]", expected: "false", isHidden: true, order: 4 },
      { input: "{[]}", expected: "true", isHidden: true, order: 5 },
    ],
  },
  {
    title: "Merge Two Sorted Lists",
    slug: "merge-two-sorted-lists",
    difficulty: "Medium",
    order: 6,
    description: `You are given the heads of two sorted linked lists \`list1\` and \`list2\`.

Merge the two lists into one **sorted** list. The list should be made by splicing together the nodes of the first two lists.

Return the head of the merged linked list.

**Example 1:**
\`\`\`
Input: list1 = [1,2,4], list2 = [1,3,4]
Output: [1,1,2,3,4,4]
\`\`\`

**Example 2:**
\`\`\`
Input: list1 = [], list2 = []
Output: []
\`\`\`

**Example 3:**
\`\`\`
Input: list1 = [], list2 = [0]
Output: [0]
\`\`\``,
    constraints: `- The number of nodes in both lists is in the range [0, 50].
- -100 <= Node.val <= 100
- Both list1 and list2 are sorted in non-decreasing order.`,
    hints: JSON.stringify([
      "Use a dummy head node to simplify edge cases.",
      "Compare the current nodes of both lists and advance the pointer of the smaller one.",
      "Recursion also works cleanly here.",
    ]),
    starterCode: JSON.stringify({
      python: `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def mergeTwoLists(list1: ListNode | None, list2: ListNode | None) -> ListNode | None:
    # Write your solution here
    pass`,
      javascript: `/**
 * function ListNode(val, next) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.next = (next===undefined ? null : next)
 * }
 * @param {ListNode} list1
 * @param {ListNode} list2
 * @return {ListNode}
 */
function mergeTwoLists(list1, list2) {
    // Write your solution here
}`,
    }),
    tags: ["linked-list", "sorting"],
    testCases: [
      { input: "[1,2,4]\n[1,3,4]", expected: "[1,1,2,3,4,4]", isHidden: false, order: 1 },
      { input: "[]\n[]", expected: "[]", isHidden: false, order: 2 },
      { input: "[]\n[0]", expected: "[0]", isHidden: false, order: 3 },
      { input: "[1,3,5]\n[2,4,6]", expected: "[1,2,3,4,5,6]", isHidden: true, order: 4 },
      { input: "[5]\n[1,2,3,4]", expected: "[1,2,3,4,5]", isHidden: true, order: 5 },
    ],
  },
  {
    title: "Binary Search",
    slug: "binary-search",
    difficulty: "Medium",
    order: 7,
    description: `Given an array of integers \`nums\` which is sorted in ascending order, and an integer \`target\`, write a function to search \`target\` in \`nums\`. If \`target\` exists, then return its index. Otherwise, return \`-1\`.

You must write an algorithm with **O(log n)** runtime complexity.

**Example 1:**
\`\`\`
Input: nums = [-1,0,3,5,9,12], target = 9
Output: 4
Explanation: 9 exists in nums and its index is 4
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [-1,0,3,5,9,12], target = 2
Output: -1
Explanation: 2 does not exist in nums so return -1
\`\`\``,
    constraints: `- 1 <= nums.length <= 10^4
- -10^4 < nums[i], target < 10^4
- All the integers in nums are unique.
- nums is sorted in ascending order.`,
    hints: JSON.stringify([
      "Maintain left and right pointers.",
      "Calculate mid = left + (right - left) / 2 to avoid overflow.",
      "If nums[mid] < target, search the right half; otherwise search the left half.",
    ]),
    starterCode: JSON.stringify({
      python: `def search(nums: list[int], target: int) -> int:
    # Write your solution here
    pass`,
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
function search(nums, target) {
    // Write your solution here
}`,
    }),
    tags: ["array", "binary-search"],
    testCases: [
      { input: "[-1,0,3,5,9,12]\n9", expected: "4", isHidden: false, order: 1 },
      { input: "[-1,0,3,5,9,12]\n2", expected: "-1", isHidden: false, order: 2 },
      { input: "[5]\n5", expected: "0", isHidden: false, order: 3 },
      { input: "[1,2,3,4,5]\n1", expected: "0", isHidden: true, order: 4 },
      { input: "[1,2,3,4,5]\n5", expected: "4", isHidden: true, order: 5 },
    ],
  },
  {
    title: "Container With Most Water",
    slug: "container-with-most-water",
    difficulty: "Medium",
    order: 8,
    description: `You are given an integer array \`height\` of length \`n\`. There are \`n\` vertical lines drawn such that the two endpoints of the \`i\`th line are \`(i, 0)\` and \`(i, height[i])\`.

Find two lines that together with the x-axis form a container, such that the container contains the most water.

Return the maximum amount of water a container can store.

**Notice** that you may not slant the container.

**Example 1:**
\`\`\`
Input: height = [1,8,6,2,5,4,8,3,7]
Output: 49
Explanation: The above vertical lines are represented by array [1,8,6,2,5,4,8,3,7].
In this case, the max area of water the container can contain is 49.
\`\`\`

**Example 2:**
\`\`\`
Input: height = [1,1]
Output: 1
\`\`\``,
    constraints: `- n == height.length
- 2 <= n <= 10^5
- 0 <= height[i] <= 10^4`,
    hints: JSON.stringify([
      "Start with the widest container (left=0, right=n-1).",
      "The area is limited by the shorter line. Move the pointer at the shorter line inward.",
      "This greedy two-pointer approach is O(n).",
    ]),
    starterCode: JSON.stringify({
      python: `def maxArea(height: list[int]) -> int:
    # Write your solution here
    pass`,
      javascript: `/**
 * @param {number[]} height
 * @return {number}
 */
function maxArea(height) {
    // Write your solution here
}`,
    }),
    tags: ["array", "two-pointers"],
    testCases: [
      { input: "[1,8,6,2,5,4,8,3,7]", expected: "49", isHidden: false, order: 1 },
      { input: "[1,1]", expected: "1", isHidden: false, order: 2 },
      { input: "[4,3,2,1,4]", expected: "16", isHidden: false, order: 3 },
      { input: "[1,2,1]", expected: "2", isHidden: true, order: 4 },
      { input: "[2,3,4,5,18,17,6]", expected: "17", isHidden: true, order: 5 },
    ],
  },

  // ── Hard ──────────────────────────────────────────────────────────────────
  {
    title: "Longest Substring Without Repeating Characters",
    slug: "longest-substring-without-repeating-characters",
    difficulty: "Hard",
    order: 9,
    description: `Given a string \`s\`, find the length of the **longest substring** without repeating characters.

**Example 1:**
\`\`\`
Input: s = "abcabcbb"
Output: 3
Explanation: The answer is "abc", with the length of 3.
\`\`\`

**Example 2:**
\`\`\`
Input: s = "bbbbb"
Output: 1
Explanation: The answer is "b", with the length of 1.
\`\`\`

**Example 3:**
\`\`\`
Input: s = "pwwkew"
Output: 3
Explanation: The answer is "wke", with the length of 3.
Notice that the answer must be a substring, "pwke" is a subsequence and not a substring.
\`\`\``,
    constraints: `- 0 <= s.length <= 5 * 10^4
- s consists of English letters, digits, symbols and spaces.`,
    hints: JSON.stringify([
      "Use a sliding window with two pointers.",
      "Keep a set (or map) of characters in the current window.",
      "When a duplicate is found, shrink the window from the left until the duplicate is removed.",
    ]),
    starterCode: JSON.stringify({
      python: `def lengthOfLongestSubstring(s: str) -> int:
    # Write your solution here
    pass`,
      javascript: `/**
 * @param {string} s
 * @return {number}
 */
function lengthOfLongestSubstring(s) {
    // Write your solution here
}`,
    }),
    tags: ["string", "hash-table", "two-pointers"],
    testCases: [
      { input: "abcabcbb", expected: "3", isHidden: false, order: 1 },
      { input: "bbbbb", expected: "1", isHidden: false, order: 2 },
      { input: "pwwkew", expected: "3", isHidden: false, order: 3 },
      { input: "", expected: "0", isHidden: true, order: 4 },
      { input: "dvdf", expected: "3", isHidden: true, order: 5 },
    ],
  },
  {
    title: "Median of Two Sorted Arrays",
    slug: "median-of-two-sorted-arrays",
    difficulty: "Hard",
    order: 10,
    description: `Given two sorted arrays \`nums1\` and \`nums2\` of size \`m\` and \`n\` respectively, return **the median** of the two sorted arrays.

The overall run time complexity should be **O(log (m+n))**.

**Example 1:**
\`\`\`
Input: nums1 = [1,3], nums2 = [2]
Output: 2.00000
Explanation: merged array = [1,2,3] and median is 2.
\`\`\`

**Example 2:**
\`\`\`
Input: nums1 = [1,2], nums2 = [3,4]
Output: 2.50000
Explanation: merged array = [1,2,3,4] and median is (2 + 3) / 2 = 2.5.
\`\`\``,
    constraints: `- nums1.length == m
- nums2.length == n
- 0 <= m <= 1000
- 0 <= n <= 1000
- 1 <= m + n <= 2000
- -10^6 <= nums1[i], nums2[i] <= 10^6`,
    hints: JSON.stringify([
      "A naive O((m+n) log(m+n)) merge-and-find won't satisfy the constraint.",
      "Binary search on the smaller array to find the correct partition.",
      "Ensure the left half of the combined array has the right number of elements.",
    ]),
    starterCode: JSON.stringify({
      python: `def findMedianSortedArrays(nums1: list[int], nums2: list[int]) -> float:
    # Write your solution here
    pass`,
      javascript: `/**
 * @param {number[]} nums1
 * @param {number[]} nums2
 * @return {number}
 */
function findMedianSortedArrays(nums1, nums2) {
    // Write your solution here
}`,
    }),
    tags: ["array", "binary-search"],
    testCases: [
      { input: "[1,3]\n[2]", expected: "2.00000", isHidden: false, order: 1 },
      { input: "[1,2]\n[3,4]", expected: "2.50000", isHidden: false, order: 2 },
      { input: "[0,0]\n[0,0]", expected: "0.00000", isHidden: false, order: 3 },
      { input: "[]\n[1]", expected: "1.00000", isHidden: true, order: 4 },
      { input: "[2]\n[]", expected: "2.00000", isHidden: true, order: 5 },
    ],
  },
];

async function main() {
  console.log("Seeding database...");

  // Tags
  const tagMap: Record<string, string> = {};
  for (const tag of tags) {
    const created = await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
    tagMap[tag.slug] = created.id;
  }
  console.log(`Created ${tags.length} tags`);

  // Problems + test cases
  for (const p of problems) {
    const { tags: problemTags, testCases, ...problemData } = p;
    const problem = await prisma.problem.upsert({
      where: { slug: problemData.slug },
      update: {},
      create: problemData,
    });

    // Tags
    for (const tagSlug of problemTags) {
      const tagId = tagMap[tagSlug];
      if (tagId) {
        await prisma.problemTag.upsert({
          where: { problemId_tagId: { problemId: problem.id, tagId } },
          update: {},
          create: { problemId: problem.id, tagId },
        });
      }
    }

    // Test cases — delete existing then recreate to keep order stable
    await prisma.testCase.deleteMany({ where: { problemId: problem.id } });
    await prisma.testCase.createMany({
      data: testCases.map((tc) => ({ ...tc, problemId: problem.id })),
    });
  }
  console.log(`Created ${problems.length} problems with test cases`);

  // Users
  const password = await bcrypt.hash("password123", 10);
  const users = [
    { email: "admin@leetrank.dev", username: "admin", password, role: "admin" },
    { email: "user1@leetrank.dev", username: "user1", password, role: "user" },
    { email: "user2@leetrank.dev", username: "user2", password, role: "user" },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }
  console.log(`Created ${users.length} users`);

  // Contest
  const now = new Date();
  const start = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);       // +2 hours
  await prisma.contest.upsert({
    where: { slug: "weekly-contest-1" },
    update: {},
    create: {
      title: "LeetRank Weekly Contest #1",
      slug: "weekly-contest-1",
      description: "Kick off the first LeetRank weekly contest! Solve as many problems as you can within 2 hours.",
      startTime: start,
      endTime: end,
      status: "upcoming",
    },
  });
  console.log("Created 1 contest");

  // Gamification — seed the 20 HackerRank-parity achievements once the
  // user/contest fixture exists so admin reviews can see the catalog.
  await seedAchievements();
  console.log("Seeded achievements");

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
