import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ServiceHealthGrid } from "@/components/devops/service-health-grid";
import type { ServiceHealthSnapshot } from "@/lib/devops/aggregator";

function snapshot(overall: "operational" | "degraded" | "down" = "operational"): ServiceHealthSnapshot {
  return {
    overall,
    checkedAt: "2026-05-19T12:00:00Z",
    services: [
      { id: "web", name: "Next.js Web", status: "operational", latencyMs: 5 },
      { id: "api", name: "API (Hono)", status: "operational", latencyMs: 12 },
      { id: "auth", name: "Auth (Go)", status: "operational", latencyMs: 8 },
      { id: "problems", name: "Problems (Go)", status: "operational", latencyMs: 9 },
      { id: "submissions", name: "Submissions (Go)", status: "down", latencyMs: 2000 },
      { id: "realtime", name: "Realtime (Go)", status: "operational", latencyMs: 11 },
      { id: "leaderboard", name: "Leaderboard (Rust)", status: "operational", latencyMs: 7 },
      { id: "notifications", name: "Notifications (Ruby)", status: "operational", latencyMs: 14 },
      { id: "analytics", name: "Analytics (Python)", status: "degraded", latencyMs: 800 },
      { id: "judge", name: "Judge", status: "operational", latencyMs: 25 },
    ],
  };
}

describe("ServiceHealthGrid", () => {
  it("renders 10 tiles for the canonical service inventory", () => {
    const html = renderToStaticMarkup(<ServiceHealthGrid snapshot={snapshot()} />);
    const ids = ["web", "api", "auth", "problems", "submissions", "realtime", "leaderboard", "notifications", "analytics", "judge"];
    for (const id of ids) {
      expect(html).toContain(`data-testid="tile-${id}"`);
    }
  });

  it("attaches the correct status dot per service status", () => {
    const html = renderToStaticMarkup(<ServiceHealthGrid snapshot={snapshot()} />);
    // Operational -> emerald, down -> rose, degraded -> amber
    expect(html).toMatch(/data-testid="dot-web"[^>]*bg-emerald-500/);
    expect(html).toMatch(/data-testid="dot-submissions"[^>]*bg-rose-500/);
    expect(html).toMatch(/data-testid="dot-analytics"[^>]*bg-amber-500/);
  });

  it("propagates status onto the tile data attribute for downstream styling", () => {
    const html = renderToStaticMarkup(<ServiceHealthGrid snapshot={snapshot()} />);
    expect(html).toMatch(/data-testid="tile-submissions"[^>]*data-status="down"/);
    expect(html).toMatch(/data-testid="tile-judge"[^>]*data-status="operational"/);
  });

  it("renders an alert when the snapshot is null (aggregator failed)", () => {
    const html = renderToStaticMarkup(<ServiceHealthGrid snapshot={null} error="boom" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Service health unavailable");
    expect(html).toContain("boom");
  });

  it("renders a dash when latency is undefined", () => {
    const snap = snapshot();
    snap.services[0] = { id: "web", name: "Next.js Web", status: "unknown" };
    const html = renderToStaticMarkup(<ServiceHealthGrid snapshot={snap} />);
    expect(html).toMatch(/data-testid="tile-web"/);
    expect(html).toContain("—");
  });
});
