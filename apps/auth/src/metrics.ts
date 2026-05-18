/**
 * In-memory Prometheus-style metrics store for the auth service.
 *
 * Counters/histograms are maintained here and serialised to the
 * Prometheus text exposition format by routes/metrics.ts.
 */

// ── Types ────────────────────────────────────────────────────────────────────

type LabelSet = Record<string, string>;

interface CounterEntry {
  labels: LabelSet;
  value: number;
}

interface HistogramEntry {
  labels: LabelSet;
  buckets: Map<number, number>; // le → cumulative count
  count: number;
  sum: number;
}

// ── Histogram buckets (seconds) ──────────────────────────────────────────────

export const DURATION_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

// ── Internal stores ──────────────────────────────────────────────────────────

const requestsTotal = new Map<string, CounterEntry>();
const requestDuration = new Map<string, HistogramEntry>();
let requestsInFlight = 0;

const startedAt = Date.now();

// ── Helpers ──────────────────────────────────────────────────────────────────

function labelKey(labels: LabelSet): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
}

// ── Public API ───────────────────────────────────────────────────────────────

export function incRequestsTotal(
  method: string,
  path: string,
  status: number
): void {
  const labels: LabelSet = {
    method,
    path,
    status: String(status),
  };
  const key = labelKey(labels);
  const existing = requestsTotal.get(key);
  if (existing) {
    existing.value += 1;
  } else {
    requestsTotal.set(key, { labels, value: 1 });
  }
}

export function observeRequestDuration(
  method: string,
  path: string,
  durationSeconds: number
): void {
  const labels: LabelSet = { method, path };
  const key = labelKey(labels);
  let entry = requestDuration.get(key);
  if (!entry) {
    const buckets = new Map<number, number>();
    for (const le of DURATION_BUCKETS) {
      buckets.set(le, 0);
    }
    entry = { labels, buckets, count: 0, sum: 0 };
    requestDuration.set(key, entry);
  }
  entry.count += 1;
  entry.sum += durationSeconds;
  for (const le of DURATION_BUCKETS) {
    if (durationSeconds <= le) {
      entry.buckets.set(le, (entry.buckets.get(le) ?? 0) + 1);
    }
  }
}

export function incInFlight(): void {
  requestsInFlight += 1;
}

export function decInFlight(): void {
  requestsInFlight = Math.max(0, requestsInFlight - 1);
}

// ── Serialisation ─────────────────────────────────────────────────────────────

function fmtLabels(labels: LabelSet): string {
  const pairs = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
  return pairs ? `{${pairs}}` : "";
}

export function renderPrometheus(): string {
  const lines: string[] = [];

  // ── http_requests_total ──────────────────────────────────────────────────
  lines.push("# HELP leetrank_auth_http_requests_total Total HTTP requests");
  lines.push("# TYPE leetrank_auth_http_requests_total counter");
  for (const entry of requestsTotal.values()) {
    lines.push(
      `leetrank_auth_http_requests_total${fmtLabels(entry.labels)} ${entry.value}`
    );
  }

  // ── http_request_duration_seconds ────────────────────────────────────────
  lines.push(
    "# HELP leetrank_auth_http_request_duration_seconds HTTP request latency"
  );
  lines.push("# TYPE leetrank_auth_http_request_duration_seconds histogram");
  for (const entry of requestDuration.values()) {
    // Cumulative buckets
    let cumulative = 0;
    for (const le of DURATION_BUCKETS) {
      cumulative += entry.buckets.get(le) ?? 0;
      lines.push(
        `leetrank_auth_http_request_duration_seconds_bucket${fmtLabels({
          ...entry.labels,
          le: String(le),
        })} ${cumulative}`
      );
    }
    lines.push(
      `leetrank_auth_http_request_duration_seconds_bucket${fmtLabels({
        ...entry.labels,
        le: "+Inf",
      })} ${entry.count}`
    );
    lines.push(
      `leetrank_auth_http_request_duration_seconds_count${fmtLabels(entry.labels)} ${entry.count}`
    );
    lines.push(
      `leetrank_auth_http_request_duration_seconds_sum${fmtLabels(entry.labels)} ${entry.sum}`
    );
  }

  // ── in_flight ────────────────────────────────────────────────────────────
  lines.push(
    "# HELP leetrank_auth_http_requests_in_flight Current in-flight requests"
  );
  lines.push("# TYPE leetrank_auth_http_requests_in_flight gauge");
  lines.push(`leetrank_auth_http_requests_in_flight ${requestsInFlight}`);

  // ── uptime ───────────────────────────────────────────────────────────────
  lines.push(
    "# HELP leetrank_auth_process_uptime_seconds Process uptime in seconds"
  );
  lines.push("# TYPE leetrank_auth_process_uptime_seconds gauge");
  lines.push(
    `leetrank_auth_process_uptime_seconds ${(Date.now() - startedAt) / 1000}`
  );

  lines.push(""); // trailing newline
  return lines.join("\n");
}
