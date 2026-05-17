import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createContestSchema, firstZodError } from "@/lib/validations";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

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
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

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

    return Response.json({ contest }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
