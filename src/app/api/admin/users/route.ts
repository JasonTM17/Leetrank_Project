import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { logger } from "@/lib/logger";

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
  } catch (err) {
    logger.error("admin/users GET failed", { scope: "api/admin/users", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
