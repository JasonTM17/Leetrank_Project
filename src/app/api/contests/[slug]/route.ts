import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";

const TTL_MS = 60_000;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const contestPayload = await cache.remember(`contests:detail:${slug}`, TTL_MS, async () => {
      const contest = await prisma.contest.findUnique({
        where: { slug },
        include: {
          problems: {
            orderBy: { order: "asc" },
            include: {
              problem: {
                include: { tags: { include: { tag: true } } },
              },
            },
          },
        },
      });

      if (!contest) return null;

      return {
        id: contest.id,
        title: contest.title,
        slug: contest.slug,
        description: contest.description,
        startTime: contest.startTime,
        endTime: contest.endTime,
        status: contest.status,
        problems: contest.problems.map((cp) => ({
          id: cp.problem.id,
          title: cp.problem.title,
          slug: cp.problem.slug,
          difficulty: cp.problem.difficulty,
          points: cp.points,
          order: cp.order,
          tags: cp.problem.tags.map((pt) => ({ id: pt.tag.id, name: pt.tag.name, slug: pt.tag.slug })),
        })),
      };
    });

    if (!contestPayload) {
      return Response.json({ error: "Contest not found" }, { status: 404 });
    }

    return Response.json(
      { contest: contestPayload },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
