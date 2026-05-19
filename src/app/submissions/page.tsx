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
import { ListChecks, FileCode, ChevronDown, ChevronUp } from "lucide-react";
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

// ── Status metadata ───────────────────────────────────────────────────────────

interface StatusMeta {
  label: string;
  dot: string;
  text: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  accepted:            { label: "AC",      dot: "bg-success",              text: "text-success" },
  wrong_answer:        { label: "WA",      dot: "bg-destructive",          text: "text-destructive" },
  runtime_error:       { label: "RE",      dot: "bg-destructive",          text: "text-destructive" },
  time_limit_exceeded: { label: "TLE",     dot: "bg-warning",              text: "text-warning" },
  queued:              { label: "Queued",  dot: "bg-muted-foreground/60",  text: "text-muted-foreground" },
  judging:             { label: "Judging", dot: "bg-primary animate-pulse-soft", text: "text-primary" },
};

const LEGEND_ITEMS: { key: string; label: string }[] = [
  { key: "accepted",            label: "Accepted" },
  { key: "wrong_answer",        label: "Wrong Answer" },
  { key: "time_limit_exceeded", label: "Time Limit" },
  { key: "runtime_error",       label: "Runtime Error" },
  { key: "queued",              label: "Queued" },
  { key: "judging",             label: "Judging" },
];

const STATUS_FILTERS = [
  { id: "",                    label: "All" },
  { id: "accepted",            label: "Accepted" },
  { id: "wrong_answer",        label: "Wrong Answer" },
  { id: "runtime_error",       label: "Runtime Error" },
  { id: "time_limit_exceeded", label: "TLE" },
];

function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { label: status, dot: "bg-muted-foreground/60", text: "text-muted-foreground" };
}

// ── Expandable row ────────────────────────────────────────────────────────────

function SubmissionRow({ s }: { s: SubmissionRow }) {
  const [open, setOpen] = useState(false);
  const meta = statusMeta(s.status);

  return (
    <>
      <li>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        >
          <div className="min-w-0 flex-1">
            <span className="font-medium hover:text-primary truncate block">
              {s.problem.title}
            </span>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              <span>{languageLabel(s.language)}</span>
              {s.runtime !== null && <span>· {s.runtime}ms</span>}
              <span>· {formatRelativeTime(s.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Dot-prefix status */}
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${meta.dot}`} />
              <span className={`${meta.text} text-xs font-medium tabular-nums`}>{meta.label}</span>
            </span>
            <Badge className={getDifficultyBg(s.problem.difficulty) + " text-xs"}>
              {s.problem.difficulty}
            </Badge>
            {open ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        </button>
      </li>

      {/* Expanded verdict detail */}
      {open && (
        <li className="border-t bg-muted/20 px-4 py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Status</p>
              <span className={`font-semibold ${meta.text}`}>{meta.label}</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Language</p>
              <span className="font-medium">{languageLabel(s.language)}</span>
            </div>
            {s.runtime !== null && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Runtime</p>
                <span className="font-medium tabular-nums">{s.runtime} ms</span>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Submitted</p>
              <span className="font-medium">{new Date(s.createdAt).toLocaleString()}</span>
            </div>
            <div className="ml-auto self-end">
              <Link
                href={`/submissions/${s.id}`}
                className="text-xs text-primary hover:underline underline-offset-2"
              >
                View full submission →
              </Link>
            </div>
          </div>
        </li>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/submissions`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setSubmissions(data.submissions ?? []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = filter
    ? submissions.filter((s) => s.status === filter)
    : submissions;

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ListChecks className="h-7 w-7 text-primary" aria-hidden="true" />
              Submissions
            </h1>
            <p className="mt-1 text-muted-foreground">
              Every code submission you&apos;ve made on LeetRank.
            </p>
          </div>

          {/* Status legend */}
          <div
            className="flex flex-wrap gap-x-5 gap-y-2 mb-6 rounded-lg border bg-muted/20 px-4 py-3"
            aria-label="Submission status legend"
          >
            {LEGEND_ITEMS.map(({ key, label }) => {
              const m = statusMeta(key);
              return (
                <span key={key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${m.dot}`} />
                  <span className="font-medium">{m.label}</span>
                  <span className="opacity-60">— {label}</span>
                </span>
              );
            })}
          </div>

          {/* Filter tabs */}
          <div
            className="flex flex-wrap gap-2 mb-4"
            role="tablist"
            aria-label="Submission status filters"
          >
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

          {/* Content */}
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={FileCode}
              title={filter ? "No submissions match this filter" : "No submissions yet"}
              description={
                filter
                  ? "Try a different filter, or run some code."
                  : "Submit a solution and it will land here."
              }
              action={
                <Link href="/problems" className="text-sm text-primary hover:underline">
                  Browse problems
                </Link>
              }
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y" aria-label="Submission list">
                  {visible.map((s) => (
                    <SubmissionRow key={s.id} s={s} />
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
