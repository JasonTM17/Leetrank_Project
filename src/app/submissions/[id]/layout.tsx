import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Submission ${id.slice(0, 8)}`,
    description: "Submission verdict and details on LeetRank.",
    robots: { index: false },
  };
}

export default function SubmissionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
