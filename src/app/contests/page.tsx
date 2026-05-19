"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  _count?: { entries: number };
}

export default function ContestsPage() {
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
            {dot("bg-green-500")}Live
          </Badge>
        );
      case "upcoming":
        return (
          <Badge variant="warning" className="inline-flex items-center">
            {dot("bg-amber-500")}Upcoming
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="inline-flex items-center">
            {dot("bg-muted-foreground/60")}Ended
          </Badge>
        );
    }
  }

  function formatDateTime(date: string) {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function ctaTooltip(status: string, startTime: string) {
    if (status === "active") return "Limited to 10 join requests per minute";
    if (status === "upcoming") return "Opens at " + formatDateTime(startTime);
    return "Final standings + your placement";
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
              items={[{ label: "Home", href: "/" }, { label: "Contests" }]}
            />
            <div className="animate-fade-in-up">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                <span className="gradient-text">Contests</span>
              </h1>
              <p className="mt-3 text-muted-foreground text-lg max-w-xl">
                Compete with others and test your skills under pressure. Weekly rounds, live leaderboards, and ratings that follow you.
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
              title="No contests available yet"
              description="New contests are posted weekly. Bookmark this page or check back soon."
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
                            {contest._count?.entries || 0} participants
                          </div>
                        </div>
                      </div>
                      <Tooltip content={ctaTooltip(contest.status, contest.startTime)} side="left">
                        <Link href={`/contests/${contest.slug}`}>
                          <Button variant={contest.status === "active" ? "default" : "outline"} size="sm" className={contest.status === "active" ? "shadow-glow" : ""}>
                            {contest.status === "active" ? "Join Now" : contest.status === "upcoming" ? "View Details" : "View Results"}
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
