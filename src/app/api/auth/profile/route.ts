import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const updateProfileSchema = z.object({
  bio: z.string().max(500, "Bio must be 500 characters or fewer").optional(),
  avatar: z.string().url("Avatar must be a URL").optional().or(z.literal("")),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    // Treat empty-string avatar as a clear (set to null) so the form can
    // implement "remove avatar" without a separate endpoint.
    const data: Record<string, string | null> = {};
    if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;
    if (parsed.data.avatar !== undefined) {
      data.avatar = parsed.data.avatar === "" ? null : parsed.data.avatar;
    }

    const user = await prisma.user.update({
      where: { id: session.userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        avatar: true,
        bio: true,
        createdAt: true,
      },
    });

    return Response.json({ user });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
