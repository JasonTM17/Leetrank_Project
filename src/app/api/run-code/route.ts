import { NextRequest } from "next/server";
import { executeCode, JudgeUnavailableError } from "@/services/judge";
import { runCodeSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = runCodeSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Invalid input";
      return Response.json({ error: firstError }, { status: 400 });
    }

    const { code, language, testCases } = parsed.data;
    const results = await executeCode({ code, language, testCases });

    return Response.json({ results });
  } catch (err) {
    if (err instanceof JudgeUnavailableError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
