"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getDifficultyBg, formatRelativeTime } from "@/lib/utils";
import { Bookmark } from "lucide-react";

interface BookmarkRow {
  id: string;
  createdAt: string;
  problem: { id: string; title: string; slug: string; difficulty: string };
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetch("/api/bookmarks")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setBookmarks(data.bookmarks ?? []))
      .catch(() => setBookmarks([]))
      .finally(() => setLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bookmark className="h-7 w-7 text-primary" /> Bookmarks
            </h1>
            <p className="mt-1 text-muted-foreground">
              Problems you&apos;ve saved for later.
            </p>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : bookmarks.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="No bookmarks yet"
              description="Tap the Save button on any problem and it will land here."
              action={<Link href="/problems" className="text-sm text-primary hover:underline">Browse problems</Link>}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {bookmarks.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/problems/${b.problem.slug}`}
                          className="font-medium hover:text-primary truncate block"
                        >
                          {b.problem.title}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Saved {formatRelativeTime(b.createdAt)}
                        </div>
                      </div>
                      <Badge className={getDifficultyBg(b.problem.difficulty) + " text-xs shrink-0"}>
                        {b.problem.difficulty}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
