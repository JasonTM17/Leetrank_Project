import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { executeCode } from "@/services/judge";
import { submitCodeSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const problemId = searchParams.get("problemId");

    const where: Record<string, unknown> = { userId: session.userId };
    if (problemId) where.problemId = problemId;

    const submissions = await prisma.submission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        problem: { select: { id: true, title: true, slug: true, difficulty: true } },
      },
    });

    return Response.json({ submissions });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = submitCodeSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Invalid input";
      return Response.json({ error: firstError }, { status: 400 });
    }

    const { problemId, language, code } = parsed.data;

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: { testCases: { orderBy: { order: "asc" } } },
    });

    if (!problem) {
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    const testCases = problem.testCases.map((tc) => ({ input: tc.input, expected: tc.expected }));
    const results = await executeCode({ code, language, testCases });

    const allPassed = results.every((r) => r.passed);
    const hasError = results.some((r) => r.error);
    let status: string;

    if (hasError && !allPassed) {
      status = "runtime_error";
    } else if (allPassed) {
      status = "accepted";
    } else {
      status = "wrong_answer";
    }

    const avgRuntime = results.reduce((sum, r) => sum + (r.runtime ?? 0), 0) / results.length;
    const errorMsg = results.find((r) => r.error)?.error;

    const submission = await prisma.submission.create({
      data: {
        userId: session.userId,
        problemId,
        language,
        code,
        status,
        runtime: Math.round(avgRuntime),
        error: errorMsg,
      },
    });

    return Response.json({ submission, results }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
