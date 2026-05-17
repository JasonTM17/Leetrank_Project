import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, avatar: true, createdAt: true },
    });

    const counts = await prisma.submission.groupBy({
      by: ["userId"],
      where: { status: "accepted" },
      _count: { id: true },
    });

    const countMap = new Map(counts.map((c) => [c.userId, c._count.id]));

    const leaderboard = users
      .map((u) => ({ user: u, solved: countMap.get(u.id) ?? 0 }))
      .sort((a, b) => b.solved - a.solved)
      .slice(0, 50)
      .map((entry, i) => ({ rank: i + 1, ...entry }));

    return Response.json({ leaderboard });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
