import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account",
  description: "Join LeetRank and start solving curated problems.",
  robots: { index: false },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
