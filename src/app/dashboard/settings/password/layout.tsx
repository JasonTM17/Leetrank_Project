import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Change password",
  description: "Update your LeetRank account password.",
  robots: { index: false },
};

export default function PasswordSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
