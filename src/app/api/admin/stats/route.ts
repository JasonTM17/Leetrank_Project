import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

// GET /api/admin/stats — dashboard summary for the admin panel header.
// Pulls all the counters in parallel; cheap because each is a COUNT(*) on
// an indexed column.
export async function GET(request: NextRequest) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;

    const [
      problems,
      contests,
      users,
      submissions,
      acceptedSubmissions,
      discussions,
      activeContests,
      adminUsers,
    ] = await Promise.all([
      prisma.problem.count(),
      prisma.contest.count(),
      prisma.user.count(),
      prisma.submission.count(),
      prisma.submission.count({ where: { status: "accepted" } }),
      prisma.discussion.count(),
      prisma.contest.count({ where: { status: "active" } }),
      prisma.user.count({ where: { role: "admin" } }),
    ]);

    return Response.json({
      problems,
      contests,
      activeContests,
      users,
      adminUsers,
      submissions,
      acceptedSubmissions,
      discussions,
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
