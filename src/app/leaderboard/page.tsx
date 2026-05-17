"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  username: string;
  solved: number;
  score: number;
}

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

  function getRankIcon(rank: number) {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-medium text-muted-foreground w-5 text-center">{rank}</span>;
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Leaderboard</h1>
            <p className="text-muted-foreground mt-1">Top performers on LeetRank</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20">
              <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No entries yet. Be the first to solve a problem!</p>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Global Rankings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {entries.map((entry) => (
                    <div
                      key={entry.rank}
                      className={`flex items-center gap-4 rounded-lg px-4 py-3 transition-colors ${
                        entry.rank <= 3 ? "bg-muted/50" : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>
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
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
