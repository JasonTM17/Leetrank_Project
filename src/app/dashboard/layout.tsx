import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your LeetRank progress, streaks, and personal stats.",
  robots: { index: false },
};

// Dashboard pages are personalised — never let the CDN serve User A's
// rendered HTML to User B. force-dynamic guarantees per-request rendering
// and dynamic = "force-dynamic" implies cache: 'no-store' for fetches.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
