import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const contests = await prisma.contest.findMany({
      orderBy: { startTime: "desc" },
    });

    return Response.json({ contests });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
