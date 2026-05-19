"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { getDifficultyBg } from "@/lib/utils";
import { Clock, Users, Trophy, Code2 } from "lucide-react";

interface ContestDetail {
  id: string;
  title: string;
  slug: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: string;
  problems: {
    problem: { id: string; title: string; slug: string; difficulty: string };
    points: number;
    order: number;
  }[];
  entries: { user: { username: string }; score: number; rank?: number }[];
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function useCountdown(targetIso: string) {
  const calc = useCallback(() => {
    const diff = new Date(targetIso).getTime() - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    return { h, m, s };
  }, [targetIso]);

  const [remaining, setRemaining] = useState(calc);

  useEffect(() => {
    const id = setInterval(() => setRemaining(calc()), 1_000);
    return () => clearInterval(id);
  }, [calc]);

  return remaining;
}

function CountdownPill({ targetIso, label }: { targetIso: string; label: string }) {
  const r = useCountdown(targetIso);
  if (!r) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="sticky top-16 z-20 flex justify-center py-2 pointer-events-none">
      <div
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium shadow-elevated backdrop-blur"
        style={{
          background: "color-mix(in oklab, var(--card) 80%, transparent)",
          borderColor: "color-mix(in oklab, var(--primary) 30%, var(--border))",
        }}
      >
        <Clock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums text-foreground">
          {pad(r.h)}:{pad(r.m)}:{pad(r.s)}
        </span>
      </div>
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const dot = (cls: string) => (
    <span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full ${cls}`} />
  );
  switch (status) {
    case "active":
      return (
        <Badge variant="success" className="inline-flex items-center">
          {dot("bg-green-500")}Live
        </Badge>
      );
    case "upcoming":
      return (
        <Badge variant="warning" className="inline-flex items-center">
          {dot("bg-amber-500")}Upcoming
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="inline-flex items-center">
          {dot("bg-muted-foreground/60")}Ended
        </Badge>
      );
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContestDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/contests/${slug}`)
      .then((r) => r.json())
      .then((data) => setContest(data.contest ?? null))
      .catch(() => setContest(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="flex-1">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse-soft">
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="h-8 w-72 rounded bg-muted" />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-64 rounded-lg bg-muted" />
              <div className="h-64 rounded-lg bg-muted" />
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!contest) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="flex-1">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20">
            <EmptyState
              icon={Trophy}
              title="Contest not found"
              description="This contest may have been removed or the URL is incorrect."
              action={
                <Link href="/contests">
                  <Button variant="outline" size="sm">Back to Contests</Button>
                </Link>
              }
            />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const sortedProblems = [...(contest.problems ?? [])].sort((a, b) => a.order - b.order);
  const sortedEntries = [...(contest.entries ?? [])].sort((a, b) => b.score - a.score);

  const joinTooltip =
    contest.status === "active"
      ? "Limited to 10 join requests per minute"
      : contest.status === "upcoming"
        ? `Opens at ${new Date(contest.startTime).toLocaleString()}`
        : "Final standings + your placement";

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        {/* Countdown sticky pill */}
        {(contest.status === "active" || contest.status === "upcoming") && (
          <CountdownPill
            targetIso={contest.status === "upcoming" ? contest.startTime : contest.endTime}
            label={contest.status === "upcoming" ? "Starts in" : "Ends in"}
          />
        )}

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumb
            className="mb-6"
            items={[
              { label: "Home", href: "/" },
              { label: "Contests", href: "/contests" },
              { label: contest.title },
            ]}
          />

          {/* Hero */}
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-card p-8 mb-8">
            <div className="absolute inset-0 bg-grid opacity-20" aria-hidden="true" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{contest.title}</h1>
                <StatusPill status={contest.status} />
              </div>
              {contest.description && (
                <p className="text-muted-foreground mt-1 max-w-2xl">{contest.description}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {new Date(contest.startTime).toLocaleString()} –{" "}
                    {new Date(contest.endTime).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  <span>{contest.entries?.length ?? 0} participants</span>
                </div>
              </div>

              {contest.status !== "ended" && (
                <div className="mt-6">
                  <Tooltip content={joinTooltip} side="right">
                    <Button
                      size="lg"
                      className="gap-2 shadow-glow"
                      disabled={contest.status === "upcoming"}
                      aria-label={
                        contest.status === "active" ? "Join this contest" : "Contest not yet open"
                      }
                    >
                      {contest.status === "active" ? "Join Contest" : "Not Open Yet"}
                    </Button>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Problems grid */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-primary" aria-hidden="true" />
                  Problems
                </h2>
                {sortedProblems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No problems added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sortedProblems.map((cp, i) => (
                      <Link
                        key={cp.problem.id}
                        href={`/problems/${cp.problem.slug}`}
                        className="group flex items-center justify-between rounded-lg border p-3 hover:border-primary/40 hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-150"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-medium text-muted-foreground w-5 shrink-0">
                            {i + 1}.
                          </span>
                          <span className="font-medium group-hover:text-primary truncate transition-colors">
                            {cp.problem.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <Badge className={getDifficultyBg(cp.problem.difficulty) + " text-xs"}>
                            {cp.problem.difficulty}
                          </Badge>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {cp.points}pts
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rankings */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
                  Rankings
                </h2>
                {sortedEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No participants yet.</p>
                ) : (
                  <div className="space-y-1">
                    {sortedEntries.map((entry, i) => (
                      <div
                        key={entry.user.username}
                        className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-sm font-bold w-6 tabular-nums ${
                              i === 0
                                ? "text-warning"
                                : i === 1
                                  ? "text-muted-foreground"
                                  : i === 2
                                    ? "text-warning/70"
                                    : "text-muted-foreground/60"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="font-medium">{entry.user.username}</span>
                        </div>
                        <span className="text-sm text-primary font-medium tabular-nums">
                          {entry.score} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
