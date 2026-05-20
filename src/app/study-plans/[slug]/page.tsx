/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { getDifficultyBg } from "@/lib/utils";
import { BookOpen, CheckCircle2, Circle, Clock, PlayCircle, Loader2, Trash2 } from "lucide-react";

interface PlanProblem {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  acceptanceRate: number | null;
  order: number;
  dayNumber: number;
}

interface PlanDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedHours: number;
  isOfficial: boolean;
  problems: PlanProblem[];
}

interface Enrollment {
  startedAt: string;
  completedAt: string | null;
  lastActivityAt: string;
}

interface AuthMe {
  user: { id: string; username: string } | null;
}

export default function StudyPlanDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const t = useTranslations("studyPlans");

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [solvedSet, setSolvedSet] = useState<Set<string>>(new Set());
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, meRes] = await Promise.all([
        fetch(`/api/study-plans/${slug}`),
        fetch("/api/auth/me"),
      ]);
      if (detailRes.status === 404) {
        setPlan(null);
        return;
      }
      const data = await detailRes.json();
      setPlan(data.plan);
      setSolvedSet(new Set<string>(data.solvedProblemIds || []));
      setEnrollment(data.enrollment);

      const me: AuthMe = meRes.ok ? await meRes.json() : { user: null };
      setAuthed(Boolean(me.user));
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/study-plans/${slug}/start`, { method: "POST" });
      if (res.status === 401) {
        router.push(`/login?next=/study-plans/${slug}`);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? t("errorGeneric"));
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleAbandon() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/study-plans/${slug}/abandon`, { method: "DELETE" });
      if (res.status === 401) {
        router.push(`/login?next=/study-plans/${slug}`);
        return;
      }
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? t("errorGeneric"));
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="flex-1">
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!plan) {
    return (
      <>
        <Navbar />
        <main className="flex-1 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
          <EmptyState
            icon={BookOpen}
            title={t("notFoundTitle")}
            description={t("notFoundBody")}
            action={
              <Link href="/study-plans">
                <Button>{t("backToList")}</Button>
              </Link>
            }
          />
        </main>
        <Footer />
      </>
    );
  }

  const totalProblems = plan.problems.length;
  const solvedCount = plan.problems.filter((p) => solvedSet.has(p.id)).length;
  const percent = totalProblems > 0 ? Math.min(100, Math.round((solvedCount / totalProblems) * 100)) : 0;
  const isComplete = percent === 100 && totalProblems > 0;

  // Group problems by day for the curriculum view; preserve order inside
  // each day so the existing index = curated sequence stays intact.
  const days = new Map<number, PlanProblem[]>();
  for (const p of plan.problems) {
    const list = days.get(p.dayNumber) ?? [];
    list.push(p);
    days.set(p.dayNumber, list);
  }
  const dayKeys = Array.from(days.keys()).sort((a, b) => a - b);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 bg-grid opacity-30" aria-hidden="true" />
          <div className="absolute inset-0 bg-radial-fade" aria-hidden="true" />
          <div
            className="absolute inset-x-0 -top-16 h-64 bg-gradient-to-b from-primary/15 to-transparent blur-3xl"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
            <Breadcrumb
              className="mb-6"
              items={[
                { label: t("breadcrumbHome"), href: "/" },
                { label: t("breadcrumbStudyPlans"), href: "/study-plans" },
                { label: plan.title },
              ]}
            />
            <div className="animate-fade-in-up flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {plan.isOfficial && (
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                      {t("officialBadge")}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {plan.difficulty}
                  </Badge>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  <span className="gradient-text">{plan.title}</span>
                </h1>
                <p className="text-muted-foreground max-w-2xl">{plan.description}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="h-3 w-3" aria-hidden="true" />
                    {t("problemCount", { count: totalProblems })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {t("estimatedHours", { hours: plan.estimatedHours })}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 md:items-end">
                {enrollment ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAbandon}
                      disabled={busy}
                      className="inline-flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("abandonCta")}
                    </Button>
                    <span className="text-[11px] text-muted-foreground">
                      {t("startedOn", { date: new Date(enrollment.startedAt).toLocaleDateString() })}
                    </span>
                  </>
                ) : (
                  <Button onClick={handleStart} disabled={busy} className="shadow-glow inline-flex items-center gap-2">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                    {authed === false ? t("loginToStart") : t("startCta")}
                  </Button>
                )}
                {error && <span className="text-xs text-destructive">{error}</span>}
              </div>
            </div>
          </div>
        </section>

        {/* Progress bar */}
        {enrollment && (
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium inline-flex items-center gap-2">
                    {isComplete && <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />}
                    {t("progressLabel", { solved: solvedCount, total: totalProblems })}
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground">{percent}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all ${isComplete ? "bg-emerald-500" : "bg-primary"}`}
                    style={{ width: `${percent}%` }}
                    aria-hidden="true"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Curriculum */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {dayKeys.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t("noProblemsTitle")}
              description={t("noProblemsBody")}
            />
          ) : (
            dayKeys.map((day) => (
              <section key={day}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {t("dayLabel", { day })}
                </h2>
                <Card className="overflow-hidden">
                  <ul className="divide-y">
                    {(days.get(day) ?? []).map((p) => {
                      const solved = solvedSet.has(p.id);
                      return (
                        <li key={p.id}>
                          <Link
                            href={`/problems/${p.slug}`}
                            className="flex items-center gap-3 p-4 hover:bg-accent/40 transition-colors"
                          >
                            {solved ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" aria-hidden="true" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground/50 shrink-0" aria-hidden="true" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{p.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {t("problemMeta", {
                                  difficulty: p.difficulty,
                                  acceptance:
                                    p.acceptanceRate !== null
                                      ? `${Math.round(p.acceptanceRate * 100)}%`
                                      : "—",
                                })}
                              </p>
                            </div>
                            <Badge className={getDifficultyBg(p.difficulty)} variant="outline">
                              {p.difficulty}
                            </Badge>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </section>
            ))
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
