import { describe, it, expect } from "vitest";
import { withPoolParams } from "../db-utils.js";

describe("withPoolParams", () => {
  it("appends connection_limit=10 and pool_timeout=20 when neither is set", () => {
    const out = withPoolParams("postgres://x:y@h:5432/db");
    const url = new URL(out);
    expect(url.searchParams.get("connection_limit")).toBe("10");
    expect(url.searchParams.get("pool_timeout")).toBe("20");
  });

  it("keeps an explicit connection_limit", () => {
    const out = withPoolParams("postgres://x:y@h:5432/db?connection_limit=20");
    const url = new URL(out);
    expect(url.searchParams.get("connection_limit")).toBe("20");
    expect(url.searchParams.get("pool_timeout")).toBe("20");
  });

  it("keeps an explicit pool_timeout", () => {
    const out = withPoolParams("postgres://x:y@h:5432/db?pool_timeout=5");
    const url = new URL(out);
    expect(url.searchParams.get("connection_limit")).toBe("10");
    expect(url.searchParams.get("pool_timeout")).toBe("5");
  });

  it("keeps both when explicit", () => {
    const out = withPoolParams(
      "postgres://x:y@h:5432/db?connection_limit=5&pool_timeout=10"
    );
    const url = new URL(out);
    expect(url.searchParams.get("connection_limit")).toBe("5");
    expect(url.searchParams.get("pool_timeout")).toBe("10");
  });

  it("preserves other query params", () => {
    const out = withPoolParams("postgres://x:y@h:5432/db?schema=public&sslmode=require");
    const url = new URL(out);
    expect(url.searchParams.get("schema")).toBe("public");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("connection_limit")).toBe("10");
  });

  it("throws on garbage input", () => {
    expect(() => withPoolParams("not-a-url")).toThrow();
  });
});
