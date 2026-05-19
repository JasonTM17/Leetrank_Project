import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Problems",
  description: "10,000+ curated coding problems.",
};

export default function ProblemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
