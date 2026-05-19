"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag as TagIcon } from "lucide-react";
import { getDifficultyBg } from "@/lib/utils";

interface ProblemRow {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  _count: { submissions: number };
}

interface TagPayload {
  tag: { id: string; name: string; slug: string };
  problems: ProblemRow[];
  total: number;
}

export default function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<TagPayload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetch(`/api/tags/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [slug]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="flex-1 mx-auto max-w-4xl px-4 py-12 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
        </main>
        <Footer />
      </>
    );
  }

  if (notFound || !data) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="flex-1 mx-auto max-w-2xl px-4 py-16">
          <EmptyState
            icon={TagIcon}
            title="Tag not found"
            description={`No tag with the slug "${slug}".`}
            action={<Link href="/problems" className="text-sm text-primary hover:underline">Browse problems</Link>}
          />
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
          <Breadcrumb
            className="mb-6"
            items={[
              { label: "Home", href: "/" },
              { label: "Problems", href: "/problems" },
              { label: data.tag.name },
            ]}
          />

          <div className="mb-8 animate-fade-in-up">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TagIcon className="h-7 w-7 text-primary" />
              {data.tag.name}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {data.total} {data.total === 1 ? "problem" : "problems"} tagged with this topic.
            </p>
          </div>

          {data.problems.length === 0 ? (
            <EmptyState
              icon={TagIcon}
              title="No problems yet"
              description="Nothing tagged here. Check back later — or browse all problems."
            />
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <ul className="divide-y">
                {data.problems.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <Link
                      href={`/problems/${p.slug}`}
                      className="font-medium hover:text-primary truncate flex-1"
                    >
                      {p.title}
                    </Link>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {p._count.submissions} subs
                      </span>
                      <Badge className={getDifficultyBg(p.difficulty) + " text-xs"}>
                        {p.difficulty}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
