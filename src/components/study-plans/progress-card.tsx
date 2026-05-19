"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, CheckCircle2 } from "lucide-react";

interface ProgressCardProps {
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedHours: number;
  problemCount: number;
  isOfficial: boolean;
  // Optional progress fields. When present we render the progress bar + the
  // "X / Y solved" line; when absent (signed-out viewer or never enrolled)
  // we render a clean, low-noise card with a "Start" affordance instead.
  solved?: number;
  startedAt?: string;
  completedAt?: string | null;
  // Translation function injected by the parent so the card stays a pure
  // presentation component and unit-testable without next-intl.
  t: (key: string, values?: Record<string, string | number>) => string;
}

function difficultyColor(d: string) {
  switch (d.toLowerCase()) {
    case "easy":
      return "text-emerald-500";
    case "hard":
      return "text-rose-500";
    case "medium":
      return "text-amber-500";
    default:
      return "text-muted-foreground";
  }
}

export function StudyPlanProgressCard(props: ProgressCardProps) {
  const {
    slug,
    title,
    description,
    difficulty,
    estimatedHours,
    problemCount,
    isOfficial,
    solved,
    completedAt,
    t,
  } = props;

  const isEnrolled = solved !== undefined;
  const percent = problemCount > 0 ? Math.min(100, Math.round(((solved ?? 0) / problemCount) * 100)) : 0;
  const isComplete = completedAt !== null && completedAt !== undefined;

  return (
    <Link
      href={`/study-plans/${slug}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card className="h-full hover:shadow-elevated hover:-translate-y-0.5 transition-all border-border/60">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors">
                  {title}
                </h3>
                <p className={`text-xs font-medium ${difficultyColor(difficulty)}`}>
                  {difficulty}
                </p>
              </div>
            </div>
            {isOfficial && (
              <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wide">
                {t("officialBadge")}
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden="true" />
              {t("problemCount", { count: problemCount })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {t("estimatedHours", { hours: estimatedHours })}
            </span>
          </div>

          {isEnrolled ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground inline-flex items-center gap-1.5">
                  {isComplete && <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden="true" />}
                  {t("progressLabel", { solved: solved ?? 0, total: problemCount })}
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">{percent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all ${isComplete ? "bg-emerald-500" : "bg-primary"}`}
                  style={{ width: `${percent}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" aria-hidden="true" />
                {t("notStarted")}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
