import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Study Plans · LeetRank",
  description: "Structured study plans to master algorithms and data structures on LeetRank.",
  openGraph: {
    title: "Study Plans · LeetRank",
    description: "Structured study plans to master algorithms and data structures on LeetRank.",
  },
};

export default function StudyPlansLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
