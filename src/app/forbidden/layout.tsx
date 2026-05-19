import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forbidden",
  description: "You do not have permission to view this page.",
  robots: { index: false },
};

export default function ForbiddenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
