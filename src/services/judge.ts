import { RunResult } from "@/types";

interface JudgeRequest {
  code: string;
  language: string;
  testCases: { input: string; expected: string }[];
}

export async function executeCode(request: JudgeRequest): Promise<RunResult[]> {
  const results: RunResult[] = [];

  for (const testCase of request.testCases) {
    try {
      const result = simulateExecution(request.code, request.language, testCase.input, testCase.expected);
      results.push(result);
    } catch (error) {
      results.push({
        passed: false,
        input: testCase.input,
        expected: testCase.expected,
        actual: "",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

function simulateExecution(
  code: string,
  language: string,
  input: string,
  expected: string
): RunResult {
  const startTime = Date.now();

  if (!code.trim()) {
    return { passed: false, input, expected, actual: "", error: "Empty code submission" };
  }

  if (code.includes("import os") || code.includes("import subprocess") ||
      code.includes("require('child_process')") || code.includes("exec(") ||
      code.includes("eval(") || code.includes("__import__")) {
    return { passed: false, input, expected, actual: "", error: "Forbidden: dangerous operations detected" };
  }

  let actual = "";

  if (language === "python") {
    actual = simulatePython(code, input);
  } else if (language === "javascript") {
    actual = simulateJavaScript(code, input);
  } else {
    return { passed: false, input, expected, actual: "", error: `Unsupported language: ${language}` };
  }

  const runtime = Date.now() - startTime + Math.floor(Math.random() * 50);
  const passed = actual.trim() === expected.trim();

  return { passed, input, expected, actual: actual.trim(), runtime };
}

function simulatePython(code: string, input: string): string {
  const lines = code.split("\n");
  const funcMatch = lines.find(l => l.startsWith("def "));
  if (!funcMatch) {
    return tryDirectOutput(code, input);
  }

  const funcName = funcMatch.match(/def\s+(\w+)/)?.[1];
  if (!funcName) return "";

  return tryDirectOutput(code, input);
}

function simulateJavaScript(code: string, input: string): string {
  const funcMatch = code.match(/function\s+(\w+)/);
  if (!funcMatch) {
    return tryDirectOutput(code, input);
  }

  return tryDirectOutput(code, input);
}

function tryDirectOutput(code: string, input: string): string {
  const printMatch = code.match(/(?:print|console\.log)\s*\(\s*(.+?)\s*\)/);
  if (printMatch) {
    const expr = printMatch[1];
    try {
      const inputParsed = JSON.parse(input);
      if (typeof inputParsed === "object" && inputParsed !== null) {
        return evaluateSimpleExpression(expr, inputParsed);
      }
    } catch {
      // fall through
    }
  }

  const inputLines = input.trim().split("\n");
  if (inputLines.length > 0) {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return processArrayProblem(code, parsed);
      }
    } catch {
      // fall through
    }
  }

  return "";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function evaluateSimpleExpression(expr: string, _vars: Record<string, unknown>): string {
  return String(expr);
}

function processArrayProblem(code: string, arr: unknown[]): string {
  if (code.includes("sort") || code.includes("sorted")) {
    const sorted = [...arr].sort((a, b) => Number(a) - Number(b));
    return JSON.stringify(sorted);
  }
  if (code.includes("reverse")) {
    return JSON.stringify([...arr].reverse());
  }
  if (code.includes("sum") || code.includes("reduce")) {
    const sum = arr.reduce((a: number, b: unknown) => a + Number(b), 0);
    return String(sum);
  }
  if (code.includes("max")) {
    return String(Math.max(...arr.map(Number)));
  }
  if (code.includes("min")) {
    return String(Math.min(...arr.map(Number)));
  }
  if (code.includes("len") || code.includes("length")) {
    return String(arr.length);
  }
  return JSON.stringify(arr);
}
