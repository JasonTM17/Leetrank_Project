import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const discussion = await prisma.discussion.findUnique({
      where: { id },
      select: { title: true },
    });
    if (!discussion) return { title: "Discussion" };
    return {
      title: discussion.title,
      description: `Discussion: ${discussion.title} on LeetRank.`,
    };
  } catch {
    return { title: "Discussion" };
  }
}

export default function DiscussionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
