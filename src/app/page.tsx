"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { DailyChallengeBanner } from "@/components/daily-challenge/banner";
import { HomeRecommendations } from "@/components/home/recommendations";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Trophy,
  Users,
  Zap,
  ArrowRight,
  CheckCircle,
  Terminal,
  Activity,
  Globe2,
  ShieldCheck,
  Code2,
} from "lucide-react";
import { LANGUAGES } from "@/lib/languages";

const FEATURES = [
  {
    icon: Code2,
    titleKey: "feat1Title",
    descKey: "feat1Body",
  },
  {
    icon: Trophy,
    titleKey: "feat2Title",
    descKey: "feat2Body",
  },
  {
    icon: Terminal,
    titleKey: "feat3Title",
    descKey: "feat3Body",
  },
  {
    icon: Activity,
    titleKey: "feat4Title",
    descKey: "feat4Body",
  },
  {
    icon: ShieldCheck,
    titleKey: "feat5Title",
    descKey: "feat5Body",
  },
  {
    icon: Globe2,
    titleKey: "feat6Title",
    descKey: "feat6Body",
  },
] as const;

const STATIC_STATS_FALLBACK = [
  { value: "10K+", label: "Problems" },
  { value: "1K+", label: "Contests" },
  { value: "15", label: "Languages" },
  { value: "<200ms", label: "P99 judge latency" },
];

interface ApiStats {
  problems: number;
  contests: number;
  users: number;
  accepted: number;
}

export default function HomePage() {
  const t = useTranslations("home");
  const [liveStats, setLiveStats] = useState<ApiStats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ApiStats | null) => { if (data) setLiveStats(data); })
      .catch(() => {/* keep fallback */});
  }, []);

  const STATIC_STATS_FALLBACK = [
    { value: "10K+", label: t("statsProblems") },
    { value: "1K+", label: t("statsContests") },
    { value: "15", label: t("statsLanguages") },
    { value: "<200ms", label: t("statsLatency") },
  ];

  const STATS = liveStats
    ? [
        { value: liveStats.problems.toLocaleString(), label: t("statsProblems") },
        { value: liveStats.contests.toLocaleString(), label: t("statsContests") },
        { value: liveStats.users.toLocaleString(), label: t("statsUsers") },
        { value: liveStats.accepted.toLocaleString(), label: t("statsAccepted") },
      ]
    : STATIC_STATS_FALLBACK;

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-40" aria-hidden="true" />
          <div className="absolute inset-0 bg-radial-fade" aria-hidden="true" />
          <div className="absolute inset-x-0 -top-32 -z-0 h-96 bg-gradient-to-b from-primary/20 to-transparent blur-3xl" aria-hidden="true" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 md:py-36">
            <div className="text-center max-w-3xl mx-auto animate-fade-in-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm text-primary backdrop-blur">
                <Zap className="h-4 w-4" />
                <span className="font-medium">{t("heroBadgeShort")}</span>
              </div>
              <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight">
                {t("heroTitle")}{" "}
                <span className="gradient-text">{t("heroTitleAccent")}</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                {t("heroBody")}
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/register">
                  <Button size="lg" className="gap-2 shadow-glow">
                    {t("ctaGetStarted")} <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/problems">
                  <Button variant="outline" size="lg" className="gap-2">
                    {t("ctaBrowseProblems")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <div className="text-3xl md:text-4xl font-bold gradient-text">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <DailyChallengeBanner />
          </div>
        </section>

        <HomeRecommendations />

        <section className="py-24 relative">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                {t("featuresHeadline")} <span className="gradient-text">{t("featuresHeadlineAccent")}</span>
              </h2>
              <p className="mt-4 text-muted-foreground">
                {t("featuresBody")}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div
                  key={f.titleKey}
                  className="group relative overflow-hidden rounded-xl border bg-card p-6 hover:shadow-elevated hover:border-primary/30 transition-all duration-200"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{t(f.titleKey)}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 border-t bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">{t("languagesTitle")}</h2>
              <p className="mt-2 text-muted-foreground">
                {t("languagesSubtitle", { count: LANGUAGES.length })}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {LANGUAGES.map((lang) => (
                <div
                  key={lang.id}
                  className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium hover:border-primary/50 transition-colors"
                >
                  <CheckCircle className="h-3.5 w-3.5 text-success" />
                  <span>{lang.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 relative">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-card p-10 md:p-16 text-center">
              <div className="absolute inset-0 bg-grid opacity-30" aria-hidden="true" />
              <div className="relative">
                <Users className="mx-auto h-10 w-10 text-primary" />
                <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
                  {t("ctaFinalReady")}
                </h2>
                <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                  {t("ctaFinalBody")}
                </p>
                <Link href="/register" className="inline-block mt-8">
                  <Button size="lg" className="gap-2 shadow-glow">
                    {t("ctaCreateFree")} <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
