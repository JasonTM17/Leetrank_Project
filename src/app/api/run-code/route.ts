import { NextRequest } from "next/server";
import { executeCode } from "@/services/judge";

export async function POST(request: NextRequest) {
  try {
    const { code, language, testCases } = await request.json();

    if (!code || !language || !testCases || !Array.isArray(testCases)) {
      return Response.json({ error: "code, language, and testCases are required" }, { status: 400 });
    }

    const results = await executeCode({ code, language, testCases });

    return Response.json({ results });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
