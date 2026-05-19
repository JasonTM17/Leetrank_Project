import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bookmarks",
  description: "Problems you have bookmarked on LeetRank.",
  robots: { index: false },
};

export default function BookmarksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
