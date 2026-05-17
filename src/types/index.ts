export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
}

export interface Problem {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  hints?: string;
  editorial?: string;
  constraints?: string;
  starterCode?: string;
  tags: { id: string; name: string; slug: string }[];
  testCases: TestCase[];
}

export interface TestCase {
  id: string;
  input: string;
  expected: string;
  isHidden: boolean;
  order: number;
}

export interface Submission {
  id: string;
  userId: string;
  problemId: string;
  language: string;
  code: string;
  status: "accepted" | "wrong_answer" | "runtime_error" | "time_limit" | "pending";
  runtime?: number;
  memory?: number;
  output?: string;
  error?: string;
  createdAt: string;
  problem?: Problem;
}

export interface Contest {
  id: string;
  title: string;
  slug: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: "upcoming" | "active" | "ended";
  problems?: Problem[];
}

export interface LeaderboardEntry {
  rank: number;
  user: User;
  solved: number;
  score: number;
}

export interface RunResult {
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  runtime?: number;
  error?: string;
}
