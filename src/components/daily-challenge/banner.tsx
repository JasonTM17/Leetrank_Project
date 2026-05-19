"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Flame, Trophy, Calendar, ArrowRight } from "lucide-react";

interface DailyTag {
  id: string;
  name: string;
  slug: string;
}

interface DailyProblem {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  tags: DailyTag[];
}

interface DailyChallenge {
  id: string;
  date: string;
  completionCount: number;
  problem: DailyProblem;
}

interface DailyStreak {
  currentStreak: number;
  longestStreak: number;
  lastSolvedDate: string | null;
  active: boolean;
  solvedToday: boolean;
}

interface DailyChallengeResponse {
  challenge: DailyChallenge | null;
  streak: DailyStreak | null;
}

const difficultyClass = (d: string): string => {
  const v = d.toLowerCase();
  if (v === "easy") return "text-emerald-500 dark:text-emerald-400";
  if (v === "medium") return "text-amber-500 dark:text-amber-400";
  if (v === "hard") return "text-rose-500 dark:text-rose-400";
  return "text-foreground";
};

export function DailyChallengeBanner() {
  const t = useTranslations("daily");
  const [data, setData] = useState<DailyChallengeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/daily-challenge", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DailyChallengeResponse;
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "load failed");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl border bg-card/60 p-6 animate-pulse"
        aria-label={t("loading")}
      >
        <div className="h-4 w-32 bg-muted rounded mb-4" />
        <div className="h-6 w-3/4 bg-muted rounded mb-3" />
        <div className="h-4 w-1/2 bg-muted rounded" />
      </div>
    );
  }

  if (error || !data?.challenge) {
    return (
      <div
        className="rounded-2xl border bg-card/60 p-6"
        data-testid="daily-banner-empty"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" aria-hidden />
          <span>{t("title")}</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  const { challenge, streak } = data;
  const dateLabel = new Date(challenge.date).toUTCString().split(" ").slice(0, 4).join(" ");
  const streakNum = streak?.currentStreak ?? 0;
  const longest = streak?.longestStreak ?? 0;
  const active = streak?.active ?? false;
  const solvedToday = streak?.solvedToday ?? false;

  return (
    <div
      className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-sm animate-fade-in-up"
      data-testid="daily-banner"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            <span>{t("title")}</span>
            <span className="text-muted-foreground">· {dateLabel}</span>
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight">
            <Link
              href={`/problems/${challenge.problem.slug}`}
              className="hover:underline underline-offset-4"
            >
              {challenge.problem.title}
            </Link>
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className={`font-medium capitalize ${difficultyClass(challenge.problem.difficulty)}`}>
              {challenge.problem.difficulty}
            </span>
            <span className="text-muted-foreground">
              · {challenge.completionCount} {t("solved")}
            </span>
            {challenge.problem.tags.slice(0, 3).map((tg) => (
              <span
                key={tg.id}
                className="rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tg.name}
              </span>
            ))}
          </div>
        </div>

        {streak ? (
          <div className="flex items-center gap-4 rounded-xl border bg-background/60 px-4 py-3">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-sm font-medium">
                <Flame
                  className={`h-4 w-4 ${active ? "text-amber-500" : "text-muted-foreground"}`}
                  aria-hidden
                />
                <span>{streakNum}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{t("streak")}</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-sm font-medium">
                <Trophy className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span>{longest}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{t("longest")}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/problems/${challenge.problem.slug}`}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
        >
          {solvedToday ? t("ctaSolved") : t("cta")}
          <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
        </Link>
        <span className="text-xs text-muted-foreground">
          {solvedToday
            ? t("solvedToday")
            : active
              ? t("keepStreak")
              : t("startStreak")}
        </span>
      </div>
    </div>
  );
}
