import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createDiscussionSchema, firstZodError } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// RULES §4: rate-limit write paths. Discussion creation is cheap per
// call but a viable spam vector — 5/min per user is generous enough
// for normal use and tight enough to make spam hurt.
const WRITE_LIMIT_MAX = 5;
const WRITE_LIMIT_WINDOW_MS = 60_000;

// LeetCode-parity sort modes. "hot" combines vote score with recency
// so fresh+upvoted threads float; "new" is plain createdAt desc;
// "top" sorts purely by votes desc.
type SortMode = "hot" | "new" | "top";
const SORT_MODES = ["hot", "new", "top"] as const;
function parseSort(raw: string | null): SortMode {
  return (SORT_MODES as readonly string[]).includes(raw ?? "")
    ? (raw as SortMode)
    : "hot";
}

// Hot score blends vote count and recency: log10(max(score, 1)) + ageHours / 12.
// Newer threads get a steady additive boost; popular ones rise via the log term.
// Computed in JS after fetch — N is bounded by MAX_LIMIT*PAGE so cheap.
const HOT_AGE_HALFLIFE_HOURS = 12;
function hotRank(score: number, createdAt: Date): number {
  const ageHours = (Date.now() - createdAt.getTime()) / 36e5;
  return Math.log10(Math.max(score, 1)) - ageHours / HOT_AGE_HALFLIFE_HOURS;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const problemId = searchParams.get("problemId");
    if (!problemId) {
      return Response.json({ error: "Problem ID is required." }, { status: 400 });
    }

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );
    const sort = parseSort(searchParams.get("sort"));

    // "new" and "top" map directly to a Prisma orderBy. "hot" uses
    // a JS-side rank — fetch a wider slice (page*limit) by createdAt
    // desc, attach scores, then re-sort.
    const orderBy =
      sort === "top"
        ? [{ upvotes: "desc" as const }, { createdAt: "desc" as const }]
        : { createdAt: "desc" as const };

    const fetchTake = sort === "hot" ? page * limit : limit;
    const fetchSkip = sort === "hot" ? 0 : (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.discussion.findMany({
        where: { problemId },
        orderBy,
        skip: fetchSkip,
        take: fetchTake,
        include: {
          user: { select: { id: true, username: true, avatar: true } },
          _count: { select: { comments: true, votes: true } },
        },
      }),
      prisma.discussion.count({ where: { problemId } }),
    ]);

    let discussions = rows;
    if (sort === "hot") {
      // Materialize per-thread vote score then sort by hotRank.
      const ids = rows.map((r) => r.id);
      const agg = ids.length
        ? await prisma.discussionVote.groupBy({
            by: ["discussionId"],
            where: { discussionId: { in: ids } },
            _sum: { value: true },
          })
        : [];
      const scoreById = new Map(
        agg.map((a) => [a.discussionId, a._sum.value ?? 0])
      );
      discussions = [...rows]
        .map((r) => ({ ...r, score: scoreById.get(r.id) ?? 0 }))
        .sort((a, b) =>
          hotRank(b.score, b.createdAt) - hotRank(a.score, a.createdAt)
        )
        .slice((page - 1) * limit, page * limit);
    }

    return Response.json({ discussions, total, page, limit, sort });
  } catch (err) {
    logger.error("discussions GET failed", { scope: "api/discussions", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = rateLimit(`discussion-create:${session.userId}`, WRITE_LIMIT_MAX, WRITE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many discussions created. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createDiscussionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    const problem = await prisma.problem.findUnique({
      where: { id: parsed.data.problemId },
      select: { id: true },
    });
    if (!problem) {
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    const discussion = await prisma.discussion.create({
      data: {
        problemId: parsed.data.problemId,
        userId: session.userId,
        title: parsed.data.title,
        body: parsed.data.body,
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    });

    return Response.json({ discussion }, { status: 201 });
  } catch (err) {
    logger.error("discussions POST failed", { scope: "api/discussions", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
