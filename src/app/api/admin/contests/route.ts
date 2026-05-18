import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { createContestSchema, firstZodError } from "@/lib/validations";
import { cache } from "@/lib/cache";

export async function GET() {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const contests = await prisma.contest.findMany({
      orderBy: { startTime: "desc" },
      include: { _count: { select: { problems: true, entries: true } } },
    });

    return Response.json({ contests });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createContestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    const data = parsed.data;
    const contest = await prisma.contest.create({
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        status: data.status,
      },
    });

    // Bust the public list cache so the new contest shows up immediately
    // for everyone instead of waiting for the 60s TTL to roll over.
    cache.delete("contests:all");

    return Response.json({ contest }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
