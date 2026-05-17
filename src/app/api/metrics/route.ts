// /api/metrics — Prometheus exposition format.
//
// Keeping this endpoint dependency-free (no prom-client package) so the app
// container stays slim and we don't add a transitive surface for the judge
// service's own scraping pipeline. The handful of counters/gauges below
// cover the dashboards we care about; richer metrics belong in the judge or
// in a sidecar exporter.

import { prisma } from "@/lib/db";

const startedAt = Date.now();

// Per-process counters incremented by middleware (added separately).
// Importing them dynamically keeps this route resilient if the counters
// module is missing during a transient deploy state.
async function loadHttpCounters(): Promise<{
  total: number;
  byStatus: Record<string, number>;
}> {
  try {
    const mod = await import("@/lib/metrics");
    return mod.snapshotHttp();
  } catch {
    return { total: 0, byStatus: {} };
  }
}

function fmt(name: string, help: string, type: string, samples: string[]): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${samples.join("\n")}\n`;
}

export async function GET() {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const http = await loadHttpCounters();

  let userCount = 0;
  let problemCount = 0;
  let submissionTotal = 0;
  let submissionAccepted = 0;

  try {
    [userCount, problemCount, submissionTotal, submissionAccepted] = await Promise.all([
      prisma.user.count(),
      prisma.problem.count(),
      prisma.submission.count(),
      prisma.submission.count({ where: { status: "accepted" } }),
    ]);
  } catch {
    // DB hiccup — emit what we have rather than failing the scrape.
  }

  const lines: string[] = [];

  lines.push(
    fmt(
      "leetrank_uptime_seconds",
      "Process uptime in seconds",
      "gauge",
      [`leetrank_uptime_seconds ${uptimeSeconds}`]
    )
  );

  lines.push(
    fmt(
      "leetrank_users_total",
      "Total registered users",
      "gauge",
      [`leetrank_users_total ${userCount}`]
    )
  );

  lines.push(
    fmt(
      "leetrank_problems_total",
      "Total problems published",
      "gauge",
      [`leetrank_problems_total ${problemCount}`]
    )
  );

  lines.push(
    fmt(
      "leetrank_submissions_total",
      "All-time submission count",
      "counter",
      [
        `leetrank_submissions_total{status="all"} ${submissionTotal}`,
        `leetrank_submissions_total{status="accepted"} ${submissionAccepted}`,
      ]
    )
  );

  lines.push(
    fmt(
      "leetrank_http_requests_total",
      "HTTP requests served by this process",
      "counter",
      [
        `leetrank_http_requests_total ${http.total}`,
        ...Object.entries(http.byStatus).map(
          ([status, count]) => `leetrank_http_requests_total{status="${status}"} ${count}`
        ),
      ]
    )
  );

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}
