"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getDifficultyBg } from "@/lib/utils";
import { Search, CheckCircle2, Circle, SearchX } from "lucide-react";

interface ProblemItem {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  tags: { id: string; name: string }[];
  _count?: { submissions: number };
  solved?: boolean;
}

const DIFFICULTY_VALUES = ["", "Easy", "Medium", "Hard"] as const;

/** Dot-prefix difficulty badge — coloured dot + label */
function DifficultyBadge({ difficulty, label }: { difficulty: string; label: string }) {
  const lower = difficulty.toLowerCase();
  const dotColor =
    lower === "easy"
      ? "bg-easy"
      : lower === "medium"
      ? "bg-medium"
      : lower === "hard"
      ? "bg-hard"
      : "bg-muted-foreground";

  return (
    <Badge className={getDifficultyBg(difficulty)}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
      {label}
    </Badge>
  );
}

function ProblemRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4">
      <Skeleton className="h-5 w-5 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <div className="hidden md:flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export default function ProblemsPage() {
  const t = useTranslations("problems");
  const tCommon = useTranslations("common");
  const [problems, setProblems] = useState<ProblemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [tags, setTags] = useState<{ slug: string; name: string }[]>([]);

  const tabLabels: Record<string, string> = {
    "": tCommon("all"),
    Easy: t("easy"),
    Medium: t("medium"),
    Hard: t("hard"),
  };

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => setTags(data.tags || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (difficulty) params.set("difficulty", difficulty);
    if (selectedTag) params.set("tag", selectedTag);
    if (search) params.set("search", search);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/problems?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setProblems(data.problems || []);
      })
      .catch(() => {
        if (!cancelled) setProblems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [difficulty, selectedTag, search]);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">

          {/* Page header */}
          <div className="mb-8 animate-fade-in-up">
            <h1 className="text-3xl font-bold tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("headerSubtitle")}
            </p>
          </div>

          {/* Toolbar: difficulty tabs + search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <Tabs
              defaultValue=""
              value={difficulty}
              onValueChange={setDifficulty}
            >
              <TabsList className="h-9">
                {DIFFICULTY_VALUES.map((value) => (
                  <TabsTrigger key={value || "all"} value={value} className="px-4 text-xs font-semibold">
                    {tabLabels[value]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Search */}
            <div className="relative w-full sm:max-w-sm sm:ml-auto">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label={t("searchAriaLabel")}
              />
            </div>
          </div>

          {/* Tag pills */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {tags.slice(0, 10).map((tag) => (
                <button
                  key={tag.slug}
                  onClick={() => setSelectedTag(selectedTag === tag.slug ? "" : tag.slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium motion-safe:transition-all duration-150 ${
                    selectedTag === tag.slug
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}

          {/* Problem list */}
          {loading ? (
            <div className="space-y-2" aria-busy="true" aria-label={t("loadingAriaLabel")}>
              {Array.from({ length: 8 }).map((_, i) => (
                <ProblemRowSkeleton key={i} />
              ))}
            </div>
          ) : problems.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t("noProblemsTitle")}
              description={t("noProblemsBody")}
              action={
                <button
                  onClick={() => {
                    setSearch("");
                    setDifficulty("");
                    setSelectedTag("");
                  }}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {t("clearAllFilters")}
                </button>
              }
            />
          ) : (
            <div className="space-y-2">
              {problems.map((problem) => (
                <Link
                  key={problem.id}
                  href={`/problems/${problem.slug}`}
                  className="group flex items-center gap-4 rounded-xl border bg-card px-5 py-4 hover:border-primary/30 hover:shadow-elevated hover:-translate-y-0.5 motion-safe:transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* Solved indicator */}
                  <span className="shrink-0" aria-label={problem.solved ? t("solved") : t("notSolved")}>
                    {problem.solved ? (
                      <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/30" aria-hidden="true" />
                    )}
                  </span>

                  {/* Title + tags */}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium group-hover:text-primary motion-safe:transition-colors truncate block">
                      {problem.title}
                    </span>
                    {problem.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 hidden md:flex">
                        {problem.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag.id} variant="secondary" className="text-xs py-0 px-2">
                            {tag.name}
                          </Badge>
                        ))}
                        {problem.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground self-center">
                            +{problem.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Submission count */}
                  {problem._count && problem._count.submissions > 0 && (
                    <span className="hidden lg:block text-xs text-muted-foreground shrink-0">
                      {t("submissionsCount", { count: problem._count.submissions.toLocaleString() })}
                    </span>
                  )}

                  {/* Difficulty badge */}
                  <span className="shrink-0">
                    <DifficultyBadge
                      difficulty={problem.difficulty}
                      label={tabLabels[problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)] ?? problem.difficulty}
                    />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
