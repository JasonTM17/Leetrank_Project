/**
 * /admin/analytics — admin-only dashboard with four rollups:
 *   - 12-month user growth (sparkline)
 *   - 30-day submission volume (sparkline)
 *   - problem difficulty distribution (pie)
 *   - top 10 languages by submission count (bar)
 *
 * Server component: gates on requireAdmin, calls the aggregator
 * directly (skipping the HTTP hop), then renders SVG charts. The
 * aggregator already memoises with cache.remember(5min) so this
 * page is cheap on repeat loads.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin-guard";
import { loadAnalytics } from "@/lib/admin-analytics";
import { SvgBarChart, SvgPieChart, SvgSparkline } from "@/components/admin/charts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Admin Analytics · LeetRank",
  description:
    "Internal admin analytics dashboard: user growth, submission volume, problem difficulty distribution, and language popularity.",
  robots: { index: false, follow: false },
};

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "Analytics" },
];

const MONTH_LABEL_FMT = new Intl.DateTimeFormat("en", {
  month: "short",
  year: "2-digit",
});
const DAY_LABEL_FMT = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

function totalOf<T extends { count: number }>(rows: T[]): number {
  return rows.reduce((acc, r) => acc + (r.count || 0), 0);
}

export default async function AdminAnalyticsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    // Mirror /admin/devops: forbidden visitors fall back to the shared
    // /admin landing which already shows the access-denied EmptyState.
    redirect("/admin");
  }

  const data = await loadAnalytics();

  const userGrowthValues = data.userGrowth.map((b) => b.count);
  const submissionValues = data.submissionVolume.map((b) => b.count);
  const totalNewUsers = totalOf(data.userGrowth);
  const totalSubmissions = totalOf(data.submissionVolume);
  const totalProblems = totalOf(data.problemDifficulty);

  const firstUserMonth = data.userGrowth[0]?.month;
  const lastUserMonth = data.userGrowth.at(-1)?.month;
  const firstDay = data.submissionVolume[0]?.day;
  const lastDay = data.submissionVolume.at(-1)?.day;

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 bg-grid">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
          <Breadcrumb className="mb-6" items={BREADCRUMB_ITEMS} />

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">
                <span className="gradient-text">Analytics</span> Dashboard
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Aggregate platform health. Generated{" "}
                <span className="font-mono">{data.generatedAt}</span>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card hoverable>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
                  />
                  User growth (12 months)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {totalNewUsers.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  new users since{" "}
                  {firstUserMonth ? MONTH_LABEL_FMT.format(new Date(firstUserMonth)) : "—"}
                </p>
                <div className="text-primary">
                  <SvgSparkline
                    data={userGrowthValues}
                    ariaLabel="user growth, last 12 months"
                  />
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground tabular-nums">
                  <span>
                    {firstUserMonth
                      ? MONTH_LABEL_FMT.format(new Date(firstUserMonth))
                      : ""}
                  </span>
                  <span>
                    {lastUserMonth
                      ? MONTH_LABEL_FMT.format(new Date(lastUserMonth))
                      : ""}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card hoverable>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
                  />
                  Submission volume (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {totalSubmissions.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  submissions in window
                </p>
                <div className="text-emerald-500">
                  <SvgSparkline
                    data={submissionValues}
                    ariaLabel="submission volume, last 30 days"
                  />
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground tabular-nums">
                  <span>{firstDay ? DAY_LABEL_FMT.format(new Date(firstDay)) : ""}</span>
                  <span>{lastDay ? DAY_LABEL_FMT.format(new Date(lastDay)) : ""}</span>
                </div>
              </CardContent>
            </Card>

            <Card hoverable>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                  />
                  Problem difficulty distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {totalProblems.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mb-3">total problems</p>
                <SvgPieChart
                  data={data.problemDifficulty.map((b) => ({
                    label: b.label,
                    value: b.count,
                  }))}
                  ariaLabel="problems by difficulty"
                />
              </CardContent>
            </Card>

            <Card hoverable>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-1.5 w-1.5 rounded-full bg-fuchsia-500"
                  />
                  Top languages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {data.topLanguages.length}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  most-used languages by submission count
                </p>
                <SvgBarChart
                  data={data.topLanguages.map((b) => ({
                    label: b.label,
                    value: b.count,
                  }))}
                  maxBars={10}
                  ariaLabel="top languages by submission count"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
