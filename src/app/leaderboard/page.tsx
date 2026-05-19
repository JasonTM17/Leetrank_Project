"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  username: string;
  solved: number;
  score: number;
}

export default function LeaderboardPage() {
  const t = useTranslations("leaderboard");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => setEntries(data.leaderboard || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  function podiumCard(
    entry: LeaderboardEntry,
    accent: string,
    ring: string,
    icon: React.ReactNode,
    rankLabel: string,
    heightClass: string,
  ) {
    return (
      <div
        className={`relative flex flex-col items-center gap-2 rounded-xl border bg-card p-5 ${ring} ${heightClass} justify-end transition-all duration-200 hover:shadow-elevated`}
      >
        {/* Rank number */}
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-xs font-bold border ${accent}`}>
          {rankLabel}
        </div>
        <div className={`rounded-full p-3 ${accent} mb-1`}>{icon}</div>
        <div className="text-sm font-semibold truncate max-w-full px-2">{entry.username}</div>
        <div className="text-xs text-muted-foreground">{t("solvedCount", { count: entry.solved })}</div>
        <div className="text-base font-bold gradient-text">{t("points", { score: entry.score })}</div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumb
            className="mb-4"
            items={[{ label: t("breadcrumbHome"), href: "/" }, { label: t("breadcrumbLeaderboard") }]}
          />

          <div className="mb-8 animate-fade-in-up">
            <h1 className="text-3xl font-bold">
              <span className="gradient-text">{t("title")}</span>
            </h1>
            <p className="text-muted-foreground mt-1">{t("tagline")}</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title={t("noEntriesTitle")}
              description={t("noEntriesBody")}
            />
          ) : (
            <>
              {top3.length === 3 && (
                <div className="mb-10 grid grid-cols-3 gap-3 items-end">
                  {/* Silver — #2 left */}
                  <div>
                    {podiumCard(
                      top3[1]!,
                      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
                      "ring-2 ring-slate-300/60",
                      <Medal className="h-5 w-5" />,
                      "#2",
                      "min-h-[160px]",
                    )}
                  </div>
                  {/* Gold — #1 center, taller */}
                  <div>
                    {podiumCard(
                      top3[0]!,
                      "bg-warning/15 text-warning border-warning/40",
                      "ring-2 ring-warning/50 shadow-glow",
                      <Trophy className="h-6 w-6" />,
                      "#1",
                      "min-h-[200px]",
                    )}
                  </div>
                  {/* Bronze — #3 right */}
                  <div>
                    {podiumCard(
                      top3[2]!,
                      "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400",
                      "ring-2 ring-amber-400/50",
                      <Award className="h-5 w-5" />,
                      "#3",
                      "min-h-[140px]",
                    )}
                  </div>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("globalRankings")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {(top3.length === 3 ? rest : entries).map((entry) => (
                      <div
                        key={entry.rank}
                        className="flex items-center gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-muted/30"
                      >
                        <Tooltip content={t("scoringFormula")} side="right">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                            {entry.rank}
                          </span>
                        </Tooltip>
                        <div className="flex-1">
                          <span className="font-medium">{entry.username}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("solvedCount", { count: entry.solved })}
                        </div>
                        <div className="text-sm font-medium text-primary w-20 text-right">
                          {t("points", { score: entry.score })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
