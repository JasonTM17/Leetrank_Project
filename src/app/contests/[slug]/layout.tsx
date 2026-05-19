import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const contest = await prisma.contest.findUnique({
      where: { slug },
      select: { title: true, description: true },
    });
    if (!contest) return { title: "Contest" };
    return {
      title: contest.title,
      description: contest.description || `Live coding contest: ${contest.title} on LeetRank.`,
    };
  } catch {
    return { title: "Contest" };
  }
}

export default function ContestSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
