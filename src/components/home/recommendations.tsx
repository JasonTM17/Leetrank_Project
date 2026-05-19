"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles, ArrowRight, Layers, TrendingUp, Star } from "lucide-react";

interface ApiRecommendation {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  reason: "same-topic" | "next-step-up" | "freshness" | "trending" | "general";
  reasonTag?: string;
}

interface RecommendationsResponse {
  recommendations: ApiRecommendation[];
}

const difficultyClass = (d: string): string => {
  const v = d.toLowerCase();
  if (v === "easy") return "text-emerald-500 dark:text-emerald-400";
  if (v === "medium") return "text-amber-500 dark:text-amber-400";
  if (v === "hard") return "text-rose-500 dark:text-rose-400";
  return "text-foreground";
};

const reasonIcon = (reason: ApiRecommendation["reason"]) => {
  switch (reason) {
    case "same-topic":
      return Layers;
    case "next-step-up":
      return TrendingUp;
    case "freshness":
      return Sparkles;
    case "trending":
      return TrendingUp;
    default:
      return Star;
  }
};

export function HomeRecommendations() {
  const t = useTranslations("recommendations");
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/recommendations", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as RecommendationsResponse;
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

  return (
    <section className="py-16 relative" aria-labelledby="recommendations-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl animate-fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            <span>{t("eyebrow")}</span>
          </div>
          <h2
            id="recommendations-heading"
            className="mt-4 text-3xl md:text-4xl font-bold tracking-tight"
          >
            {t("headline")} <span className="gradient-text">{t("headlineAccent")}</span>
          </h2>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
        </div>

        {loading ? (
          <div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            data-testid="recommendations-loading"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card/60 p-5 animate-pulse"
                aria-hidden="true"
              >
                <div className="h-3 w-20 bg-muted rounded mb-4" />
                <div className="h-5 w-3/4 bg-muted rounded mb-3" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : error || !data || data.recommendations.length === 0 ? (
          <div
            className="rounded-xl border bg-card/60 p-8 text-center animate-fade-in-up"
            data-testid="recommendations-empty"
          >
            <Sparkles
              className="mx-auto h-8 w-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm text-muted-foreground">{t("emptyBody")}</p>
            <Link
              href="/problems"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t("emptyCta")} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-fade-in-up"
            data-testid="recommendations-grid"
          >
            {data.recommendations.map((rec) => {
              const Icon = reasonIcon(rec.reason);
              const reasonText =
                rec.reason === "same-topic" && rec.reasonTag
                  ? t("reasonSameTopic", { tag: rec.reasonTag })
                  : t(`reason_${rec.reason}` as
                      | "reason_next-step-up"
                      | "reason_freshness"
                      | "reason_trending"
                      | "reason_general");
              return (
                <Link
                  key={rec.id}
                  href={`/problems/${rec.slug}`}
                  className="group relative overflow-hidden rounded-xl border bg-card p-5 hover:shadow-elevated hover:-translate-y-0.5 hover:border-primary/30 transition-all"
                  data-testid="recommendation-card"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                      <Icon className="h-3 w-3" aria-hidden />
                      <span>{reasonText}</span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold tracking-tight line-clamp-2">
                      {rec.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1 font-medium capitalize ${difficultyClass(
                          rec.difficulty,
                        )}`}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-current"
                          aria-hidden
                        />
                        {rec.difficulty}
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        {t("solveCta")}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
