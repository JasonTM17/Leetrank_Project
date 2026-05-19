import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contests",
  description: "Compete in live coding contests and track your global rank.",
};

export default function ContestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
