import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin",
  description: "LeetRank administration console.",
  robots: { index: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
