import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your LeetRank progress, streaks, and personal stats.",
  robots: { index: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
