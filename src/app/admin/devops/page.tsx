import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceHealthGrid } from "@/components/devops/service-health-grid";
import { CiRunsTile } from "@/components/devops/ci-runs-tile";
import { QueueDepthTile } from "@/components/devops/queue-depth-tile";
import { SecurityEventsTile } from "@/components/devops/security-events-tile";
import { requireAdmin } from "@/lib/admin-guard";
import { buildSnapshot } from "@/lib/devops/aggregator";
import { DevopsRefresh } from "./refresh-client";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "DevOps" },
];

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DevOpsConsolePage() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    // Mirrors the existing /admin pattern: forbidden visitors land on the
    // shared access-denied surface rather than a separate denied page here.
    redirect("/admin");
  }

  const snapshot = await buildSnapshot();
  const submissionsLastHour = snapshot.submissionRate.ok
    ? snapshot.submissionRate.data.lastHour
    : null;

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 bg-grid">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
          <Breadcrumb className="mb-6" items={BREADCRUMB_ITEMS} />

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">
                <span className="gradient-text">DevOps</span> Console
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Internal at-a-glance system view. Generated{" "}
                <span className="font-mono">{snapshot.generatedAt}</span>.
              </p>
            </div>
            <DevopsRefresh />
          </div>

          <section className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary mr-2 align-middle" />
              Service health
            </h2>
            <ServiceHealthGrid
              snapshot={snapshot.serviceHealth.ok ? snapshot.serviceHealth.data : null}
              error={!snapshot.serviceHealth.ok ? snapshot.serviceHealth.error : undefined}
            />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent CI runs</CardTitle>
              </CardHeader>
              <CardContent>
                <CiRunsTile outcome={snapshot.ciRuns} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Throughput</CardTitle>
              </CardHeader>
              <CardContent>
                <QueueDepthTile
                  result={snapshot.queueDepth}
                  submissionsLastHour={submissionsLastHour}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Security events</CardTitle>
              </CardHeader>
              <CardContent>
                <SecurityEventsTile result={snapshot.securityEvents} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
