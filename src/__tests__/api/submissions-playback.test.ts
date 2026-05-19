import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/submissions/[id]/events", () => {
  beforeEach(() => {
    process.env.PLAYBACK_ENABLED = "true";
  });

  it("returns 404 when feature flag disabled", async () => {
    process.env.PLAYBACK_ENABLED = "false";
    const { POST } = await import("@/app/api/submissions/[id]/events/route");
    const res = await POST(
      asNextRequest(jsonRequest("http://x/api/submissions/s1/events", { events: [] })),
      paramsFor("s1"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 unauthenticated", async () => {
    const { POST } = await import("@/app/api/submissions/[id]/events/route");
    const res = await POST(
      asNextRequest(jsonRequest("http://x/api/submissions/s1/events", { events: [] })),
      paramsFor("s1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown submission", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.submission.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/submissions/[id]/events/route");
    const res = await POST(
      asNextRequest(jsonRequest("http://x/api/submissions/missing/events", { events: [] })),
      paramsFor("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("forbids non-author writers (even admins)", async () => {
    await loginAs({ userId: "admin-u", role: "admin" });
    prismaMock.submission.findUnique.mockResolvedValue({ id: "s1", userId: "u1" } as never);
    const { POST } = await import("@/app/api/submissions/[id]/events/route");
    const res = await POST(
      asNextRequest(jsonRequest("http://x/api/submissions/s1/events", { events: [] })),
      paramsFor("s1"),
    );
    expect(res.status).toBe(403);
  });

  it("rejects malformed body", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.submission.findUnique.mockResolvedValue({ id: "s1", userId: "u1" } as never);
    const { POST } = await import("@/app/api/submissions/[id]/events/route");
    const res = await POST(
      asNextRequest(jsonRequest("http://x/api/submissions/s1/events", { events: "nope" })),
      paramsFor("s1"),
    );
    expect(res.status).toBe(400);
  });

  it("inserts canonical events for the author", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.submission.findUnique.mockResolvedValue({ id: "s1", userId: "u1" } as never);
    (prismaMock.submissionEvent.createMany as ReturnType<typeof Object>).mockResolvedValue({ count: 1 } as never);

    const body = {
      events: [
        {
          type: "keystroke",
          ts: 100,
          payload: {
            range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
            text: "x",
            rangeLength: 0,
          },
        },
      ],
    };

    const { POST } = await import("@/app/api/submissions/[id]/events/route");
    const res = await POST(
      asNextRequest(jsonRequest("http://x/api/submissions/s1/events", body)),
      paramsFor("s1"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.inserted).toBe(1);
    expect(prismaMock.submissionEvent.createMany).toHaveBeenCalledTimes(1);
  });

  it("short-circuits on empty event arrays", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.submission.findUnique.mockResolvedValue({ id: "s1", userId: "u1" } as never);

    const { POST } = await import("@/app/api/submissions/[id]/events/route");
    const res = await POST(
      asNextRequest(jsonRequest("http://x/api/submissions/s1/events", { events: [] })),
      paramsFor("s1"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.inserted).toBe(0);
    expect(prismaMock.submissionEvent.createMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/submissions/[id]/playback", () => {
  beforeEach(() => {
    process.env.PLAYBACK_ENABLED = "true";
  });

  it("returns 404 when feature flag disabled", async () => {
    process.env.PLAYBACK_ENABLED = "false";
    const { GET } = await import("@/app/api/submissions/[id]/playback/route");
    const res = await GET(
      asNextRequest(new Request("http://x/api/submissions/s1/playback")),
      paramsFor("s1"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 unauthenticated", async () => {
    const { GET } = await import("@/app/api/submissions/[id]/playback/route");
    const res = await GET(
      asNextRequest(new Request("http://x/api/submissions/s1/playback")),
      paramsFor("s1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-author non-admin", async () => {
    await loginAs({ userId: "u2" });
    prismaMock.submission.findUnique.mockResolvedValue({ id: "s1", userId: "u1" } as never);
    const { GET } = await import("@/app/api/submissions/[id]/playback/route");
    const res = await GET(
      asNextRequest(new Request("http://x/api/submissions/s1/playback")),
      paramsFor("s1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns events to the author with envelope", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.submission.findUnique.mockResolvedValue({ id: "s1", userId: "u1" } as never);
    (prismaMock.submissionEvent.findMany as ReturnType<typeof Object>).mockResolvedValue([
      { type: "snapshot", ts: 0, payload: { code: "" } },
      {
        type: "keystroke",
        ts: 200,
        payload: {
          range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
          text: "h",
          rangeLength: 0,
        },
      },
    ] as never);

    const { GET } = await import("@/app/api/submissions/[id]/playback/route");
    const res = await GET(
      asNextRequest(new Request("http://x/api/submissions/s1/playback")),
      paramsFor("s1"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(2);
    expect(data.durationMs).toBe(200);
  });

  it("admin can read other users' playback", async () => {
    await loginAs({ userId: "admin-u", role: "admin" });
    prismaMock.submission.findUnique.mockResolvedValue({ id: "s1", userId: "u1" } as never);
    (prismaMock.submissionEvent.findMany as ReturnType<typeof Object>).mockResolvedValue([] as never);

    const { GET } = await import("@/app/api/submissions/[id]/playback/route");
    const res = await GET(
      asNextRequest(new Request("http://x/api/submissions/s1/playback")),
      paramsFor("s1"),
    );
    expect(res.status).toBe(200);
  });
});
