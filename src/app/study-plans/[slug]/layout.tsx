import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const plan = await prisma.studyPlan.findUnique({
    where: { slug },
    select: { title: true, description: true, difficulty: true },
  });

  if (!plan) {
    return { title: "Study Plan Not Found · LeetRank" };
  }

  const title = `${plan.title} · LeetRank`;
  const description = plan.description || `${plan.difficulty} study plan on LeetRank.`;

  return {
    title,
    description,
    openGraph: { title: plan.title, description, type: "article" },
    twitter: { card: "summary", title: plan.title, description },
  };
}

export default function StudyPlanDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
