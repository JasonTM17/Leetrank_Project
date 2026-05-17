"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDifficultyBg } from "@/lib/utils";
import { Clock, Users, Loader2, ArrowLeft } from "lucide-react";

interface ContestDetail {
  id: string;
  title: string;
  slug: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: string;
  problems: { problem: { id: string; title: string; slug: string; difficulty: string }; points: number; order: number }[];
  entries: { user: { username: string }; score: number; rank?: number }[];
}

export default function ContestDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/contests/${slug}`)
      .then((r) => r.json())
      .then((data) => setContest(data.contest))
      .catch(() => setContest(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!contest) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Contest not found</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/contests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" /> Back to Contests
          </Link>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{contest.title}</h1>
              <Badge variant={contest.status === "active" ? "success" : contest.status === "upcoming" ? "warning" : "secondary"}>
                {contest.status}
              </Badge>
            </div>
            {contest.description && <p className="text-muted-foreground">{contest.description}</p>}
            <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {new Date(contest.startTime).toLocaleString()} - {new Date(contest.endTime).toLocaleString()}
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {contest.entries.length} participants
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Problems */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4">Problems</h2>
                {contest.problems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No problems added yet</p>
                ) : (
                  <div className="space-y-3">
                    {contest.problems.sort((a, b) => a.order - b.order).map((cp, i) => (
                      <div key={cp.problem.id} className="flex items-center justify-between rounded-md border p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-muted-foreground">{i + 1}.</span>
                          <Link href={`/problems/${cp.problem.slug}`} className="font-medium hover:text-primary">
                            {cp.problem.title}
                          </Link>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getDifficultyBg(cp.problem.difficulty)}>{cp.problem.difficulty}</Badge>
                          <span className="text-xs text-muted-foreground">{cp.points}pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4">Rankings</h2>
                {contest.entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No participants yet</p>
                ) : (
                  <div className="space-y-2">
                    {contest.entries
                      .sort((a, b) => b.score - a.score)
                      .map((entry, i) => (
                        <div key={entry.user.username} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/30">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium w-6">{i + 1}</span>
                            <span className="font-medium">{entry.user.username}</span>
                          </div>
                          <span className="text-sm text-primary font-medium">{entry.score} pts</span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {contest.status === "active" && (
            <div className="mt-6 text-center">
              <Button size="lg">Join Contest</Button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
