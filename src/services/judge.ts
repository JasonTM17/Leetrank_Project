import { envOr } from "@/lib/env";
import { RunResult } from "@/types";

interface JudgeRequest {
  code: string;
  language: string;
  testCases: { input: string; expected: string }[];
  timeLimit?: number;
}

interface GoJudgeResponse {
  results: Array<{
    passed: boolean;
    input: string;
    expected: string;
    actual: string;
    runtime: number;
    error?: string;
  }>;
  status: string;
}

const JUDGE_URL = envOr("JUDGE_SERVICE_URL", "http://localhost:9090");
const FETCH_TIMEOUT_MS = 30_000;

export class JudgeUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`Judge service is unavailable at ${JUDGE_URL}: ${stringifyError(cause)}`);
    this.name = "JudgeUnavailableError";
  }
}

export interface JudgeResult {
  results: RunResult[];
  /** Top-level verdict from the judge (e.g. compile_error, time_limit_exceeded) */
  status: string;
}

export async function executeCode(request: JudgeRequest): Promise<JudgeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${JUDGE_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: request.code,
        language: request.language,
        testCases: request.testCases,
        timeLimit: request.timeLimit ?? 5_000,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await safeText(res);
      throw new Error(`Judge returned HTTP ${res.status}: ${text}`);
    }

    const data = (await res.json()) as GoJudgeResponse;
    const results = (data.results ?? []).map((r) => ({
      passed: r.passed,
      input: r.input,
      expected: r.expected,
      actual: r.actual,
      runtime: r.runtime,
      error: r.error,
    }));
    return { results, status: data.status ?? "" };
  } catch (err) {
    if (isAbortOrNetworkError(err)) {
      throw new JudgeUnavailableError(err);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function safeText(res: Response): Promise<string> {
  return res.text().catch(() => "<no body>");
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function isAbortOrNetworkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; cause?: { code?: string }; code?: string };
  if (e.name === "AbortError") return true;
  const code = e.code ?? e.cause?.code;
  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "UND_ERR_SOCKET"
  );
}
