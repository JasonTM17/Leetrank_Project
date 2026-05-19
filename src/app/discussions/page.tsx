import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeTime, getDifficultyBg } from "@/lib/utils";
import { MessageSquare, MessagesSquare, ArrowUp } from "lucide-react";

export const metadata: Metadata = {
  title: "Discussions",
  description: "Recent discussions across all problems on LeetRank.",
};

// Server component — render at request time so the list reflects newly
// posted threads immediately. We pull a generous-but-bounded slice (50);
// pagination can come later when the volume justifies it.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Discussions" },
];

interface RecentDiscussion {
  id: string;
  title: string;
  createdAt: Date;
  upvotes: number;
  user: { username: string };
  problem: { slug: string; title: string; difficulty: string };
  _count: { comments: number };
}

async function fetchRecentDiscussions(): Promise<RecentDiscussion[]> {
  return prisma.discussion.findMany({
    take: PAGE_SIZE,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      upvotes: true,
      user: { select: { username: true } },
      problem: { select: { slug: true, title: true, difficulty: true } },
      _count: { select: { comments: true } },
    },
  });
}

function DifficultyDotBadge({ difficulty }: { difficulty: string }) {
  const lower = difficulty.toLowerCase();
  const dotColor =
    lower === "easy"
      ? "bg-easy"
      : lower === "medium"
      ? "bg-medium"
      : lower === "hard"
      ? "bg-hard"
      : "bg-muted-foreground";

  return (
    <Badge className={getDifficultyBg(difficulty)}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </Badge>
  );
}

function DiscussionRow({ d }: { d: RecentDiscussion }) {
  return (
    <li>
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex flex-col items-center text-muted-foreground shrink-0 pt-0.5">
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-medium tabular-nums">{d.upvotes}</span>
            </div>

            <div className="min-w-0 flex-1">
              <Link
                href={`/discussions/${d.id}`}
                className="block font-semibold leading-snug hover:text-primary transition-colors line-clamp-2"
              >
                {d.title}
              </Link>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                <Link
                  href={`/users/${d.user.username}`}
                  className="font-medium text-foreground/80 hover:text-primary"
                >
                  @{d.user.username}
                </Link>
                <span>·</span>
                <span>{formatRelativeTime(d.createdAt)}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" aria-hidden="true" />
                  {d._count.comments} {d._count.comments === 1 ? "reply" : "replies"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <DifficultyDotBadge difficulty={d.problem.difficulty} />
                <Link
                  href={`/problems/${d.problem.slug}`}
                  className="text-xs text-muted-foreground hover:text-primary truncate"
                >
                  {d.problem.title}
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

export default async function DiscussionsListPage() {
  let discussions: RecentDiscussion[] = [];
  let loadFailed = false;
  try {
    discussions = await fetchRecentDiscussions();
  } catch {
    loadFailed = true;
  }

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 space-y-6 animate-fade-in-up">
          <Breadcrumb items={BREADCRUMB_ITEMS} />

          <div>
            <h1 className="text-3xl font-bold tracking-tight gradient-text">Discussions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent threads across every problem. Jump into a conversation or start your own.
            </p>
          </div>

          {loadFailed ? (
            <EmptyState
              icon={MessagesSquare}
              title="Could not load discussions"
              description="Something went sideways fetching the feed. Refresh in a moment."
            />
          ) : discussions.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No discussions yet"
              description="Be the first to start a thread on any problem."
              action={
                <Link
                  href="/problems"
                  className="text-sm text-primary hover:underline"
                >
                  Browse problems
                </Link>
              }
            />
          ) : (
            <ul className="space-y-3">
              {discussions.map((d) => (
                <DiscussionRow key={d.id} d={d} />
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
