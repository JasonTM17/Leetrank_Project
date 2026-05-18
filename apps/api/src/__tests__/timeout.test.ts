import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { timeout } from "../middleware/timeout.js";

describe("timeout middleware", () => {
  it("returns 504 when the handler exceeds the deadline", async () => {
    const app = new Hono();
    app.use("*", timeout(50));
    app.get("/slow", async (c) => {
      await new Promise((r) => setTimeout(r, 200));
      return c.json({ ok: true });
    });
    const res = await app.request("/slow");
    expect(res.status).toBe(504);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Request timed out");
  });

  it("lets fast handlers through", async () => {
    const app = new Hono();
    app.use("*", timeout(50));
    app.get("/fast", (c) => c.json({ ok: true }));
    const res = await app.request("/fast");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("does not interfere with handlers under the deadline", async () => {
    const app = new Hono();
    app.use("*", timeout(100));
    app.get("/quick", async (c) => {
      await new Promise((r) => setTimeout(r, 10));
      return c.json({ ok: true });
    });
    const res = await app.request("/quick");
    expect(res.status).toBe(200);
  });
});
