"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/useAuth";
import { Trophy, Target, Flame, TrendingUp, Loader2, Bookmark, ListChecks, ArrowUpDown } from "lucide-react";
import Link from "next/link";

interface Submission {
  id: string;
  problemId: string;
  language: string;
  status: string;
  createdAt: string;
  problem?: { title: string; slug: string; difficulty: string };
}

type SortKey = "recent" | "oldest" | "difficulty";

const DIFFICULTY_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [bookmarks, setBookmarks] = useState<Array<{ id: string; problem?: { title: string; slug: string; difficulty: string } }>>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [stats, setStats] = useState({ solved: 0, easy: 0, medium: 0, hard: 0, streak: 0 });

  useEffect(() => {
    Promise.all([
      fetch("/api/submissions").then((r) => (r.ok ? r.json() : { submissions: [] })),
      fetch("/api/bookmarks").then((r) => (r.ok ? r.json() : { bookmarks: [] })).catch(() => ({ bookmarks: [] })),
    ])
      .then(([subData, bmData]) => {
        const subs: Submission[] = subData.submissions ?? [];
        setSubmissions(subs);
        setBookmarks(bmData.bookmarks ?? []);
        const accepted = subs.filter((s) => s.status === "accepted");
        const uniqueSolved = new Set(accepted.map((s) => s.problemId));
        setStats({
          solved: uniqueSolved.size,
          easy: accepted.filter((s) => s.problem?.difficulty === "easy").length,
          medium: accepted.filter((s) => s.problem?.difficulty === "medium").length,
          hard: accepted.filter((s) => s.problem?.difficulty === "hard").length,
          streak: Math.min(uniqueSolved.size, 7),
        });
      })
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, []);

  const solvedProblems = useMemo(() => {
    const seen = new Map<string, Submission>();
    for (const s of submissions) {
      if (s.status === "accepted" && !seen.has(s.problemId)) seen.set(s.problemId, s);
    }
    return Array.from(seen.values());
  }, [submissions]);

  const sortedSolved = useMemo(() => sortList(solvedProblems, sortKey), [solvedProblems, sortKey]);
  const sortedSubmissions = useMemo(() => sortList(submissions, sortKey), [submissions, sortKey]);

  function sortList<T extends { createdAt: string; problem?: { difficulty: string } }>(items: T[], key: SortKey): T[] {
    const copy = [...items];
    if (key === "recent") return copy.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (key === "oldest") return copy.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return copy.sort((a, b) => (DIFFICULTY_ORDER[a.problem?.difficulty ?? "easy"] ?? 0) - (DIFFICULTY_ORDER[b.problem?.difficulty ?? "easy"] ?? 0));
  }

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

  const sortLabel = sortKey === "recent" ? t("sortRecent") : sortKey === "oldest" ? t("sortOldest") : t("sortDifficulty");

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumb
            className="mb-4"
            items={[{ label: t("breadcrumbHome"), href: "/" }, { label: t("breadcrumbDashboard") }]}
          />

          <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">{t("title")}</h1>
              <p className="text-muted-foreground mt-1">
                {user ? t("welcomeNamed", { name: user.username }) : t("welcomeFallback")}
              </p>
            </div>
            <DropdownMenu
              trigger={
                <span className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors">
                  <ArrowUpDown className="h-4 w-4" />
                  {t("sortLabel")}: {sortLabel}
                </span>
              }
            >
              <DropdownMenuLabel>{t("sortBy")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSortKey("recent")}>{t("sortRecent")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSortKey("oldest")}>{t("sortOldest")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSortKey("difficulty")}>{t("sortDifficulty")}</DropdownMenuItem>
            </DropdownMenu>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.solved}</div>
                  <div className="text-xs text-muted-foreground">{t("problemsSolved")}</div>
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
                  <div className="text-xs text-muted-foreground">{t("submissionsLabel")}</div>
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
                  <div className="text-xs text-muted-foreground">{t("dayStreak")}</div>
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
                  <div className="text-xs text-muted-foreground">{t("ranking")}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="solved" className="mb-8">
            <TabsList>
              <TabsTrigger value="solved">{t("tabSolved", { count: solvedProblems.length })}</TabsTrigger>
              <TabsTrigger value="bookmarks">{t("tabBookmarks", { count: bookmarks.length })}</TabsTrigger>
              <TabsTrigger value="submissions">{t("tabSubmissions", { count: submissions.length })}</TabsTrigger>
            </TabsList>

            <TabsContent value="solved">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("solvedProblems")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {sortedSolved.length === 0 ? (
                    <EmptyState
                      icon={ListChecks}
                      title={t("noSolvedTitle")}
                      description={t("noSolvedBody")}
                    />
                  ) : (
                    <div className="space-y-3">
                      {sortedSolved.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between">
                          <Link href={`/problems/${sub.problem?.slug ?? ""}`} className="text-sm font-medium hover:text-primary">
                            {sub.problem?.title ?? t("unknownProblem")}
                          </Link>
                          <Badge variant="success" className="text-xs">{sub.problem?.difficulty ?? "—"}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bookmarks">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("bookmarks")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {bookmarks.length === 0 ? (
                    <EmptyState
                      icon={Bookmark}
                      title={t("noBookmarksTitle")}
                      description={t("noBookmarksBody")}
                    />
                  ) : (
                    <div className="space-y-3">
                      {bookmarks.map((bm) => (
                        <div key={bm.id} className="flex items-center justify-between">
                          <Link href={`/problems/${bm.problem?.slug ?? ""}`} className="text-sm font-medium hover:text-primary">
                            {bm.problem?.title ?? t("unknownProblem")}
                          </Link>
                          {bm.problem?.difficulty && (
                            <Badge variant="secondary" className="text-xs">{bm.problem.difficulty}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="submissions">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("allSubmissions")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {sortedSubmissions.length === 0 ? (
                    <EmptyState
                      icon={TrendingUp}
                      title={t("noSubmissionsTitle")}
                      description={t("noSubmissionsBody")}
                    />
                  ) : (
                    <div className="space-y-3">
                      {sortedSubmissions.slice(0, 20).map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between">
                          <div>
                            <Link href={`/problems/${sub.problem?.slug ?? ""}`} className="text-sm font-medium hover:text-primary">
                              {sub.problem?.title ?? t("unknownProblem")}
                            </Link>
                            <div className="text-xs text-muted-foreground">{sub.language}</div>
                          </div>
                          <Badge variant={sub.status === "accepted" ? "success" : "destructive"} className="text-xs">
                            {sub.status === "accepted" ? t("statusAccepted") : sub.status === "wrong_answer" ? t("statusWrongAnswer") : t("statusRuntimeError")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("progressTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: t("easy"), count: stats.easy, total: Math.max(stats.easy, 4), color: "bg-green-500" },
                { label: t("medium"), count: stats.medium, total: Math.max(stats.medium, 4), color: "bg-yellow-500" },
                { label: t("hard"), count: stats.hard, total: Math.max(stats.hard, 2), color: "bg-red-500" },
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
        </div>
      </main>
      <Footer />
    </>
  );
}
