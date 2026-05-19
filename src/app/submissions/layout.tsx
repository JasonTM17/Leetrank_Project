import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submissions",
  description: "Your submission history across all LeetRank problems.",
  robots: { index: false },
};

export default function SubmissionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
