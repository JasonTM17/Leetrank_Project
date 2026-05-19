import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const tag = await prisma.tag.findUnique({
      where: { slug },
      select: { name: true },
    });
    if (!tag) return { title: "Tag" };
    return {
      title: `${tag.name} problems`,
      description: `Coding problems tagged ${tag.name} on LeetRank.`,
    };
  } catch {
    return { title: "Tag" };
  }
}

export default function TagLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
