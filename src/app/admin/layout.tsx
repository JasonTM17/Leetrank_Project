import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin",
  description: "LeetRank administration console.",
  robots: { index: false },
};

// Admin pages render privileged data per request — they must never be
// cached by the CDN or served stale to a different operator. Force the
// dynamic render path so every visit re-evaluates auth + data.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
