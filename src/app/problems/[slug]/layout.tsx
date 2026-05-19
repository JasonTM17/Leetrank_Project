import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const problem = await prisma.problem.findUnique({
      where: { slug },
      select: { title: true, difficulty: true },
    });
    if (!problem) return { title: "Problem" };
    return {
      title: problem.title,
      description: `Solve "${problem.title}" — a ${problem.difficulty} coding problem on LeetRank.`,
    };
  } catch {
    return { title: "Problem" };
  }
}

export default function ProblemSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
