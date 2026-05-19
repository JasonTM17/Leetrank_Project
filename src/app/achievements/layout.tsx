import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Achievements · LeetRank",
  description: "Track your coding achievements, badges, and milestones on LeetRank.",
  openGraph: {
    title: "Achievements · LeetRank",
    description: "Track your coding achievements, badges, and milestones on LeetRank.",
  },
};

export default function AchievementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
