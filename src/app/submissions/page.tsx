"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ListChecks, FileCode } from "lucide-react";
import { formatRelativeTime, getDifficultyBg } from "@/lib/utils";
import { languageLabel } from "@/lib/languages";

interface SubmissionRow {
  id: string;
  status: string;
  language: string;
  runtime: number | null;
  createdAt: string;
  problem: { id: string; title: string; slug: string; difficulty: string };
}

const STATUS_TONE: Record<string, string> = {
  accepted: "text-success",
  wrong_answer: "text-destructive",
  runtime_error: "text-destructive",
  time_limit_exceeded: "text-warning",
};

const STATUS_LABEL: Record<string, string> = {
  accepted: "AC",
  wrong_answer: "WA",
  runtime_error: "RE",
  time_limit_exceeded: "TLE",
};

const STATUS_FILTERS = [
  { id: "", label: "All" },
  { id: "accepted", label: "Accepted" },
  { id: "wrong_answer", label: "Wrong Answer" },
  { id: "runtime_error", label: "Runtime Error" },
];

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    fetch(`/api/submissions`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setSubmissions(data.submissions ?? []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const visible = filter ? submissions.filter((s) => s.status === filter) : submissions;

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ListChecks className="h-7 w-7 text-primary" /> Submissions
            </h1>
            <p className="mt-1 text-muted-foreground">
              Every code submission you&apos;ve made on LeetRank.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Submission status filters">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.id || "all"}
                variant={filter === f.id ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f.id)}
                role="tab"
                aria-selected={filter === f.id}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={FileCode}
              title={filter ? "No submissions match this filter" : "No submissions yet"}
              description={filter ? "Try a different filter, or run some code." : "Submit a solution and it will land here."}
              action={<Link href="/problems" className="text-sm text-primary hover:underline">Browse problems</Link>}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {visible.map((s) => {
                    const tone = STATUS_TONE[s.status] ?? "text-muted-foreground";
                    const label = STATUS_LABEL[s.status] ?? s.status;
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/submissions/${s.id}`}
                            className="font-medium hover:text-primary truncate block"
                          >
                            {s.problem.title}
                          </Link>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <span>{languageLabel(s.language)}</span>
                            {s.runtime !== null && <span>· {s.runtime}ms</span>}
                            <span>· {formatRelativeTime(s.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`${tone} text-xs font-medium tabular-nums`}>{label}</span>
                          <Badge className={getDifficultyBg(s.problem.difficulty) + " text-xs"}>
                            {s.problem.difficulty}
                          </Badge>
                        </div>
                      </li>
                    );
                  })}
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
