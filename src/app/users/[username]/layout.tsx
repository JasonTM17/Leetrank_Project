import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { username: true, bio: true },
    });
    if (!user) return { title: `@${username}` };
    return {
      title: `@${user.username}`,
      description: user.bio || `Profile and stats for @${user.username} on LeetRank.`,
    };
  } catch {
    return { title: `@${username}` };
  }
}

export default function UserProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
