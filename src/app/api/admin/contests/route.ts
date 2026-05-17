import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

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

    const { title, slug, description, startTime, endTime, status } = await request.json();

    if (!title || !slug || !startTime || !endTime) {
      return Response.json({ error: "title, slug, startTime, and endTime are required" }, { status: 400 });
    }

    const contest = await prisma.contest.create({
      data: {
        title,
        slug,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: status ?? "upcoming",
      },
    });

    return Response.json({ contest }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
