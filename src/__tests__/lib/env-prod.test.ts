import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("envOr — production warn branch", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete (process.env as any).NODE_ENV;
    } else {
      (process.env as any).NODE_ENV = ORIGINAL_NODE_ENV;
    }
  });

  it("emits a warning once per missing variable in production", async () => {
    vi.doMock("@/lib/logger", () => ({
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    (process.env as any).NODE_ENV = "production";
    delete process.env.PROD_TEST_MISSING;

    const { envOr } = await import("@/lib/env");
    const { logger } = await import("@/lib/logger");

    expect(envOr("PROD_TEST_MISSING", "default")).toBe("default");
    // Second call must not double-warn (one-shot dedup behaviour).
    expect(envOr("PROD_TEST_MISSING", "default")).toBe("default");

    expect((logger.warn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect((logger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      "missing in production"
    );
  });

  it("does not warn when the variable is set in production", async () => {
    vi.doMock("@/lib/logger", () => ({
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    (process.env as any).NODE_ENV = "production";
    process.env.PROD_TEST_PRESENT = "https://prod.example";

    const { envOr } = await import("@/lib/env");
    const { logger } = await import("@/lib/logger");

    expect(envOr("PROD_TEST_PRESENT", "fallback")).toBe("https://prod.example");
    expect((logger.warn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
