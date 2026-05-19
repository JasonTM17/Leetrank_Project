"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AchievementBadge,
  type BadgeAchievement,
} from "@/components/achievements/badge";
import { Trophy, Filter } from "lucide-react";

interface AchievementListItem extends BadgeAchievement {
  id: string;
  isHidden: boolean;
}

interface ListResponse {
  items: AchievementListItem[];
  totals: { earnedCount: number; points: number };
  total: number;
}

const CATEGORIES = [
  "all",
  "solving",
  "difficulty",
  "skill",
  "streak",
  "rating",
  "contest",
  "leaderboard",
  "community",
];

export default function AchievementsPage() {
  const t = useTranslations("achievements");
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/achievements")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: ListResponse) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = data?.items ?? [];
  const filtered =
    filter === "all" ? items : items.filter((i) => i.category === filter);
  const earnedCount = data?.totals.earnedCount ?? 0;
  const totalPoints = data?.totals.points ?? 0;

  return (
    <>
      <Navbar />
      <main
        id="main-content"
        className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 lg:px-8 py-12"
      >
        <Breadcrumb items={[{ label: t("title") }]} />
        <header className="animate-fade-in-up mt-4 mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="gradient-text">{t("title")}</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl">{t("subtitle")}</p>
          {!loading && data ? (
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-3 py-1 font-medium">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                  aria-hidden
                />
                <Trophy className="h-3.5 w-3.5" aria-hidden />
                {t("statsEarned", { earned: earnedCount, total: data.total })}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 font-medium">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-foreground/40"
                  aria-hidden
                />
                {t("statsPoints", { points: totalPoints })}
              </span>
            </div>
          ) : null}
        </header>

        <div className="mb-6 flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`text-xs rounded-full px-3 py-1.5 font-medium transition-all ${
                filter === cat
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {t(`category.${cat}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Trophy}
            title={t("errorTitle")}
            description={t("errorBody")}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title={t("emptyTitle")}
            description={t("emptyBody")}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((a) => (
              <AchievementBadge key={a.id} achievement={a} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
