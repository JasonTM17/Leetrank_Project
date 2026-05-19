import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Reference",
  description: "LeetRank public API reference and OpenAPI spec.",
};

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
