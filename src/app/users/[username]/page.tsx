"use client";

import { useEffect, useState, use } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime, getDifficultyBg } from "@/lib/utils";
import { Trophy, Target, Calendar, User as UserIcon } from "lucide-react";
import Link from "next/link";

interface ProfileData {
  user: {
    id: string;
    username: string;
    avatar?: string;
    bio?: string;
    createdAt: string;
  };
  stats: {
    totalSubmissions: number;
    accepted: number;
    solved: number;
    byDifficulty: { easy: number; medium: number; hard: number };
  };
  recentSubmissions: Array<{
    id: string;
    status: string;
    language: string;
    createdAt: string;
    problem: { id: string; title: string; slug: string; difficulty: string };
  }>;
}

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users/${encodeURIComponent(username)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(async (r) => {
        if (cancelled) return;
        if (r instanceof Response && r.status === 404) setError("not_found");
        else setError("error");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [username]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="flex-1 mx-auto max-w-5xl w-full px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (error === "not_found" || !data) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="flex-1 mx-auto max-w-2xl w-full px-4 py-16">
          <EmptyState
            icon={UserIcon}
            title="User not found"
            description={`No user with the username "${username}" exists on LeetRank.`}
            action={<Link href="/leaderboard" className="text-primary text-sm hover:underline">Browse leaderboard</Link>}
          />
        </main>
        <Footer />
      </>
    );
  }

  const { user, stats, recentSubmissions } = data;
  const acceptanceRate = stats.totalSubmissions === 0 ? 0 : Math.round((stats.accepted / stats.totalSubmissions) * 100);

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center shadow-glow">
              <span className="text-3xl font-bold text-primary-foreground">
                {user.username[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{user.username}</h1>
              {user.bio && <p className="mt-1 text-muted-foreground">{user.bio}</p>}
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Joined {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Solved</div>
                <div className="mt-1 text-3xl font-bold">{stats.solved}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Submissions</div>
                <div className="mt-1 text-3xl font-bold">{stats.totalSubmissions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Acceptance</div>
                <div className="mt-1 text-3xl font-bold">{acceptanceRate}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Accepted</div>
                <div className="mt-1 text-3xl font-bold text-success">{stats.accepted}</div>
              </CardContent>
            </Card>
          </div>

          {/* Difficulty breakdown */}
          <div className="mt-6 grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" /> By difficulty
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Easy", count: stats.byDifficulty.easy, color: "bg-easy" },
                  { label: "Medium", count: stats.byDifficulty.medium, color: "bg-medium" },
                  { label: "Hard", count: stats.byDifficulty.hard, color: "bg-hard" },
                ].map((row) => (
                  <div key={row.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{row.label}</span>
                      <span className="text-muted-foreground tabular-nums">{row.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${row.color}`}
                        style={{ width: `${stats.solved === 0 ? 0 : (row.count / Math.max(stats.solved, 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" /> Recent activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentSubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No submissions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {recentSubmissions.slice(0, 6).map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                        <Link href={`/problems/${s.problem.slug}`} className="font-medium hover:text-primary truncate">
                          {s.problem.title}
                        </Link>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={getDifficultyBg(s.problem.difficulty) + " text-xs"}>
                            {s.problem.difficulty}
                          </Badge>
                          <span className={`text-xs ${s.status === "accepted" ? "text-success" : "text-destructive"}`}>
                            {s.status === "accepted" ? "AC" : s.status === "wrong_answer" ? "WA" : "RE"}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatRelativeTime(s.createdAt)}</span>
                        </div>
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
