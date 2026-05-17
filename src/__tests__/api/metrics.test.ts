import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { GET } from "@/app/api/metrics/route";
import { recordHttp } from "@/lib/metrics";

describe("GET /api/metrics", () => {
  it("returns prom-text/plain content type", async () => {
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.problem.count.mockResolvedValue(0);
    prismaMock.submission.count.mockResolvedValue(0);

    const res = await GET();
    expect(res.headers.get("Content-Type")).toMatch(/text\/plain/);
    expect(res.headers.get("Content-Type")).toMatch(/0\.0\.4/);
  });

  it("emits HELP and TYPE lines for each metric", async () => {
    prismaMock.user.count.mockResolvedValue(10);
    prismaMock.problem.count.mockResolvedValue(20);
    prismaMock.submission.count.mockResolvedValueOnce(100).mockResolvedValueOnce(60);

    const res = await GET();
    const body = await res.text();
    expect(body).toContain("# HELP leetrank_uptime_seconds");
    expect(body).toContain("# TYPE leetrank_uptime_seconds gauge");
    expect(body).toContain("# TYPE leetrank_users_total gauge");
    expect(body).toContain("# TYPE leetrank_submissions_total counter");
    expect(body).toContain("leetrank_users_total 10");
    expect(body).toContain("leetrank_problems_total 20");
    expect(body).toContain('leetrank_submissions_total{status="all"} 100');
    expect(body).toContain('leetrank_submissions_total{status="accepted"} 60');
  });

  it("survives a db reject without 500ing the scrape", async () => {
    prismaMock.user.count.mockRejectedValue(new Error("db down"));
    prismaMock.problem.count.mockRejectedValue(new Error("db down"));
    prismaMock.submission.count.mockRejectedValue(new Error("db down"));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("leetrank_uptime_seconds");
  });

  it("includes per-status http counters when populated", async () => {
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.problem.count.mockResolvedValue(0);
    prismaMock.submission.count.mockResolvedValue(0);

    recordHttp(200);
    recordHttp(200);
    recordHttp(404);

    const res = await GET();
    const body = await res.text();
    expect(body).toContain('leetrank_http_requests_total{status="200"}');
    expect(body).toContain('leetrank_http_requests_total{status="404"}');
  });
});
