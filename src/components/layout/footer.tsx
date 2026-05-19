"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Code2 } from "lucide-react";

export function Footer() {
  const t = useTranslations("nav");
  const tf = useTranslations("footer");
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">LeetRank</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/problems" className="hover:text-foreground transition-colors">{t("problems")}</Link>
            <Link href="/contests" className="hover:text-foreground transition-colors">{t("contests")}</Link>
            <Link href="/leaderboard" className="hover:text-foreground transition-colors">{t("leaderboard")}</Link>
            <Link href="/status" className="hover:text-foreground transition-colors">{tf("status")}</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} LeetRank. {tf("builtForLearning")}
          </p>
        </div>
      </div>
    </footer>
  );
}
