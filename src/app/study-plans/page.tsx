"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { StudyPlanProgressCard } from "@/components/study-plans/progress-card";
import { BookOpen, Loader2 } from "lucide-react";

interface PlanRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedHours: number;
  coverImage: string | null;
  isOfficial: boolean;
  problemCount: number;
}

interface ProgressEntry {
  startedAt: string;
  completedAt: string | null;
  solved: number;
}

export default function StudyPlansPage() {
  const t = useTranslations("studyPlans");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressEntry>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/study-plans")
      .then((r) => r.json())
      .then((data) => {
        setPlans(data.plans || []);
        setProgress(data.progress || {});
      })
      .catch(() => {
        setPlans([]);
        setProgress({});
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 bg-grid opacity-30" aria-hidden="true" />
          <div className="absolute inset-0 bg-radial-fade" aria-hidden="true" />
          <div
            className="absolute inset-x-0 -top-16 h-64 bg-gradient-to-b from-primary/15 to-transparent blur-3xl"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
            <Breadcrumb
              className="mb-6"
              items={[
                { label: t("breadcrumbHome"), href: "/" },
                { label: t("breadcrumbStudyPlans") },
              ]}
            />
            <div className="animate-fade-in-up">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                <span className="gradient-text">{t("title")}</span>
              </h1>
              <p className="mt-3 text-muted-foreground text-lg max-w-2xl">
                {t("heroSubtitle")}
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t("noPlansTitle")}
              description={t("noPlansBody")}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => {
                const entry = progress[p.id];
                return (
                  <StudyPlanProgressCard
                    key={p.id}
                    slug={p.slug}
                    title={p.title}
                    description={p.description}
                    difficulty={p.difficulty}
                    estimatedHours={p.estimatedHours}
                    problemCount={p.problemCount}
                    isOfficial={p.isOfficial}
                    solved={entry?.solved}
                    startedAt={entry?.startedAt}
                    completedAt={entry?.completedAt ?? null}
                    t={t}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
