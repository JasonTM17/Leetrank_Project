import Link from "next/link";
import { Code2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">LeetRank</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/problems" className="hover:text-foreground transition-colors">Problems</Link>
            <Link href="/contests" className="hover:text-foreground transition-colors">Contests</Link>
            <Link href="/leaderboard" className="hover:text-foreground transition-colors">Leaderboard</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; 2024 LeetRank. Built for learning.
          </p>
        </div>
      </div>
    </footer>
  );
}
