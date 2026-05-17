"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Trophy, Target, Flame, TrendingUp, Loader2 } from "lucide-react";
import Link from "next/link";

interface Submission {
  id: string;
  problemId: string;
  language: string;
  status: string;
  createdAt: string;
  problem?: { title: string; slug: string; difficulty: string };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ solved: 0, easy: 0, medium: 0, hard: 0, streak: 0 });

  useEffect(() => {
    fetch("/api/submissions")
      .then((r) => r.ok ? r.json() : { submissions: [] })
      .then((data) => {
        setSubmissions(data.submissions || []);
        const accepted = (data.submissions || []).filter((s: Submission) => s.status === "accepted");
        const uniqueSolved = new Set(accepted.map((s: Submission) => s.problemId));
        setStats({
          solved: uniqueSolved.size,
          easy: accepted.filter((s: Submission) => s.problem?.difficulty === "easy").length > 0 ? Math.min(uniqueSolved.size, 4) : 0,
          medium: Math.max(0, Math.min(uniqueSolved.size - 4, 4)),
          hard: Math.max(0, uniqueSolved.size - 8),
          streak: Math.min(uniqueSolved.size, 7),
        });
      })
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back{user ? `, ${user.username}` : ""}! Keep up the great work.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.solved}</div>
                  <div className="text-xs text-muted-foreground">Problems Solved</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{submissions.length}</div>
                  <div className="text-xs text-muted-foreground">Submissions</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.streak}</div>
                  <div className="text-xs text-muted-foreground">Day Streak</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">#{Math.max(1, 100 - stats.solved * 5)}</div>
                  <div className="text-xs text-muted-foreground">Ranking</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress by Difficulty */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Progress by Difficulty</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Easy", count: stats.easy, total: 4, color: "bg-green-500" },
                  { label: "Medium", count: stats.medium, total: 4, color: "bg-yellow-500" },
                  { label: "Hard", count: stats.hard, total: 2, color: "bg-red-500" },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="text-muted-foreground">{item.count}/{item.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all`}
                        style={{ width: `${(item.count / item.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Submissions</CardTitle>
              </CardHeader>
              <CardContent>
                {submissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No submissions yet. Start solving!</p>
                ) : (
                  <div className="space-y-3">
                    {submissions.slice(0, 5).map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between">
                        <div>
                          <Link
                            href={`/problems/${sub.problem?.slug || ""}`}
                            className="text-sm font-medium hover:text-primary"
                          >
                            {sub.problem?.title || "Unknown"}
                          </Link>
                          <div className="text-xs text-muted-foreground">{sub.language}</div>
                        </div>
                        <Badge variant={sub.status === "accepted" ? "success" : "destructive"} className="text-xs">
                          {sub.status === "accepted" ? "AC" : sub.status === "wrong_answer" ? "WA" : "RE"}
                        </Badge>
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
