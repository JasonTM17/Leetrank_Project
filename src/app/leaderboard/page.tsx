"use client";

import { useEffect, useState } from "react";
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

const SCORING_FORMULA = "Score = solved × 100 + recent-acceptance bonus. Refreshed every 60s.";

export default function LeaderboardPage() {
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

  function podiumCard(entry: LeaderboardEntry, accent: string, ring: string, icon: React.ReactNode) {
    return (
      <div
        className={`flex flex-col items-center gap-2 rounded-lg border bg-muted/40 p-5 ${ring}`}
      >
        <div className={`rounded-full p-2 ${accent}`}>{icon}</div>
        <div className="text-sm font-medium">{entry.username}</div>
        <div className="text-xs text-muted-foreground">{entry.solved} solved</div>
        <div className="text-base font-semibold text-primary">{entry.score} pts</div>
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
            items={[{ label: "Home", href: "/" }, { label: "Leaderboard" }]}
          />

          <div className="mb-8">
            <h1 className="text-3xl font-bold">Leaderboard</h1>
            <p className="text-muted-foreground mt-1">Top performers on LeetRank</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No entries yet"
              description="Be the first to solve a problem and you'll show up here within a minute."
            />
          ) : (
            <>
              {top3.length === 3 && (
                <div className="mb-8 grid grid-cols-3 gap-4">
                  {/* Visually rearrange so #1 sits in the middle (silver, gold, bronze). */}
                  <div className="pt-6">
                    {podiumCard(top3[1]!, "bg-slate-200 text-slate-800 dark:bg-slate-300", "ring-2 ring-slate-300/60", <Medal className="h-6 w-6" />)}
                  </div>
                  <div>
                    {podiumCard(top3[0]!, "bg-yellow-200 text-yellow-900", "ring-2 ring-yellow-400/70 shadow-glow", <Trophy className="h-7 w-7" />)}
                  </div>
                  <div className="pt-6">
                    {podiumCard(top3[2]!, "bg-amber-200 text-amber-900 dark:bg-amber-300", "ring-2 ring-amber-400/60", <Award className="h-6 w-6" />)}
                  </div>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Global Rankings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {(top3.length === 3 ? rest : entries).map((entry) => (
                      <div
                        key={entry.rank}
                        className={`flex items-center gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-muted/30`}
                      >
                        <Tooltip content={SCORING_FORMULA} side="right">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                            {entry.rank}
                          </span>
                        </Tooltip>
                        <div className="flex-1">
                          <span className="font-medium">{entry.username}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {entry.solved} solved
                        </div>
                        <div className="text-sm font-medium text-primary w-20 text-right">
                          {entry.score} pts
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
