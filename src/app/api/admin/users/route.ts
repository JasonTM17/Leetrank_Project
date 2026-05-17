import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        avatar: true,
        createdAt: true,
        _count: { select: { submissions: true } },
      },
    });

    return Response.json({ users });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
