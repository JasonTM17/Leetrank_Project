"use client";

import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import Link from "next/link";

type ServiceHealth = "operational" | "degraded" | "down";

interface ServiceResult {
  id: string;
  name: string;
  status: ServiceHealth;
  latencyMs: number;
}

interface StatusData {
  status: ServiceHealth;
  services: ServiceResult[];
  checkedAt: string;
}

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Status" },
];

function statusBadgeVariant(s: ServiceHealth): "success" | "warning" | "destructive" {
  if (s === "operational") return "success";
  if (s === "degraded") return "warning";
  return "destructive";
}

function statusLabel(s: ServiceHealth): string {
  if (s === "operational") return "Operational";
  if (s === "degraded") return "Degraded";
  return "Down";
}

function OverallIndicator({ status }: { status: ServiceHealth }) {
  if (status === "operational") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 px-6 py-4">
        <CheckCircle2 className="h-7 w-7 shrink-0 text-success" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold text-success">All systems operational</p>
          <p className="text-sm text-muted-foreground">Every service is running normally.</p>
        </div>
      </div>
    );
  }
  if (status === "degraded") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-6 py-4">
        <AlertTriangle className="h-7 w-7 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold text-warning">Some services degraded</p>
          <p className="text-sm text-muted-foreground">One or more services are experiencing issues.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-4">
      <XCircle className="h-7 w-7 shrink-0 text-destructive" aria-hidden="true" />
      <div>
        <p className="text-lg font-semibold text-destructive">Major outage</p>
        <p className="text-sm text-muted-foreground">Critical services are unavailable.</p>
      </div>
    </div>
  );
}

function ServiceRow({ service }: { service: ServiceResult }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <span className="text-sm font-medium">{service.name}</span>
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground tabular-nums">
          {service.latencyMs} ms
        </span>
        <Badge variant={statusBadgeVariant(service.status)} dot>
          {statusLabel(service.status)}
        </Badge>
      </div>
    </div>
  );
}

function ServiceRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
    </div>
  );
}

export default function StatusPage() {
  const user = useAuth((s) => s.user);
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(() => {
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: StatusData | null) => {
        if (json) setData(json);
      })
      .catch(() => {/* keep previous data */})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 30_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const checkedAt = data?.checkedAt
    ? new Date(data.checkedAt).toLocaleTimeString()
    : null;

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <Breadcrumb items={BREADCRUMB_ITEMS} />

          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live health of all LeetRank services.
            </p>
          </div>

          {loading ? (
            <Skeleton className="h-20 w-full rounded-xl" />
          ) : data ? (
            <OverallIndicator status={data.status} />
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-4">
              <XCircle className="h-7 w-7 shrink-0 text-destructive" aria-hidden="true" />
              <p className="text-sm font-medium text-destructive">Unable to fetch status.</p>
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Services</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <>
                  <ServiceRowSkeleton />
                  <ServiceRowSkeleton />
                  <ServiceRowSkeleton />
                  <ServiceRowSkeleton />
                </>
              ) : data ? (
                data.services.map((svc) => <ServiceRow key={svc.id} service={svc} />)
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No data available.</p>
              )}
            </CardContent>
          </Card>

          {checkedAt && (
            <p className="text-xs text-muted-foreground text-right">
              Last checked at {checkedAt} — refreshes every 30 s
            </p>
          )}

          {user?.role === "admin" && (
            <p className="text-xs text-muted-foreground">
              Detailed metrics:{" "}
              <Link href="/metrics" className="underline hover:text-foreground transition-colors">
                /metrics
              </Link>
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
