import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { envOr } from "@/lib/env";

describe("envOr", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns the variable when set and non-empty", () => {
    process.env.SOME_TEST_VAR = "https://prod.example";
    expect(envOr("SOME_TEST_VAR", "https://fallback")).toBe("https://prod.example");
  });

  it("returns the fallback when variable is unset", () => {
    delete process.env.SOME_MISSING_VAR;
    expect(envOr("SOME_MISSING_VAR", "https://fallback")).toBe("https://fallback");
  });

  it("returns the fallback when variable is empty string", () => {
    process.env.SOME_EMPTY_VAR = "";
    expect(envOr("SOME_EMPTY_VAR", "fallback-value")).toBe("fallback-value");
  });
});
