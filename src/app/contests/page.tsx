"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    switch (status) {
      case "active":
        return <Badge variant="success">Live</Badge>;
      case "upcoming":
        return <Badge variant="warning">Upcoming</Badge>;
      default:
        return <Badge variant="secondary">Ended</Badge>;
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

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Contests</h1>
            <p className="text-muted-foreground mt-1">Compete with others and test your skills under pressure</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contests.length === 0 ? (
            <div className="text-center py-20">
              <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No contests available yet. Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {contests.map((contest) => (
                <Card key={contest.id} className="hover:shadow-md transition-shadow">
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
                      <Link href={`/contests/${contest.slug}`}>
                        <Button variant={contest.status === "active" ? "default" : "outline"} size="sm">
                          {contest.status === "active" ? "Join Now" : contest.status === "upcoming" ? "View Details" : "View Results"}
                        </Button>
                      </Link>
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
