import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET() {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

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
