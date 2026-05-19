"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar, Clock, Users, Loader2 } from "lucide-react";

interface Contest {
  id: string;
  title: string;
  slug: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: string;
  division?: string | null;
  _count?: { entries: number };
}

export default function ContestsPage() {
  const t = useTranslations("contests");
  const locale = useLocale();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/contests")
      .then((r) => r.json())
      .then((data) => setContests(data.contests || []))
      .catch(() => setContests([]))
      .finally(() => setLoading(false));
  }, []);

  function getStatusBadge(status: string) {
    const dot = (cls: string) => (
      <span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full ${cls}`} />
    );
    switch (status) {
      case "active":
        return (
          <Badge variant="success" className="inline-flex items-center">
            {dot("bg-green-500")}{t("live")}
          </Badge>
        );
      case "upcoming":
        return (
          <Badge variant="warning" className="inline-flex items-center">
            {dot("bg-amber-500")}{t("upcoming")}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="inline-flex items-center">
            {dot("bg-muted-foreground/60")}{t("ended")}
          </Badge>
        );
    }
  }

  function formatDateTime(date: string) {
    const localeTag = locale === "vi" ? "vi-VN" : "en-US";
    return new Date(date).toLocaleDateString(localeTag, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function ctaTooltip(status: string, startTime: string) {
    if (status === "active") return t("tooltipLive");
    if (status === "upcoming") return t("tooltipUpcoming", { time: formatDateTime(startTime) });
    return t("tooltipEnded");
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 bg-grid opacity-30" aria-hidden="true" />
          <div className="absolute inset-0 bg-radial-fade" aria-hidden="true" />
          <div className="absolute inset-x-0 -top-16 h-64 bg-gradient-to-b from-primary/15 to-transparent blur-3xl" aria-hidden="true" />

          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
            <Breadcrumb
              className="mb-6"
              items={[{ label: t("breadcrumbHome"), href: "/" }, { label: t("breadcrumbContests") }]}
            />
            <div className="animate-fade-in-up">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                <span className="gradient-text">{t("title")}</span>
              </h1>
              <p className="mt-3 text-muted-foreground text-lg max-w-xl">
                {t("heroSubtitle")}
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contests.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={t("noContestsTitle")}
              description={t("noContestsBody")}
            />
          ) : (
            <div className="space-y-4">
              {contests.map((contest) => (
                <Card key={contest.id} className="hover:shadow-elevated hover:border-primary/20 transition-all duration-200">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{contest.title}</h3>
                          {getStatusBadge(contest.status)}
                          {contest.division && (
                            <Badge
                              variant="outline"
                              className="inline-flex items-center text-xs uppercase tracking-wide"
                              aria-label={t("divisionAria", { div: contest.division })}
                            >
                              <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary/70" />
                              {contest.division === "div1"
                                ? t("divisionDiv1")
                                : contest.division === "div2"
                                  ? t("divisionDiv2")
                                  : contest.division === "div3"
                                    ? t("divisionDiv3")
                                    : t("divisionOpen")}
                            </Badge>
                          )}
                        </div>
                        {contest.description && (
                          <p className="text-sm text-muted-foreground mb-3">{contest.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatDateTime(contest.startTime)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {t("participantsCount", { count: contest._count?.entries || 0 })}
                          </div>
                        </div>
                      </div>
                      <Tooltip content={ctaTooltip(contest.status, contest.startTime)} side="left">
                        <Link href={`/contests/${contest.slug}`}>
                          <Button variant={contest.status === "active" ? "default" : "outline"} size="sm" className={contest.status === "active" ? "shadow-glow" : ""}>
                            {contest.status === "active" ? t("joinNow") : contest.status === "upcoming" ? t("viewDetails") : t("viewResults")}
                          </Button>
                        </Link>
                      </Tooltip>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
