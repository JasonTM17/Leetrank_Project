import { describe, it, expect, vi } from "vitest";
import { Toaster } from "@/components/ui/toaster";

// We can't render React without jsdom + a UI library, but we can at least
// confirm the module exports the expected symbol shape so tree-shaking and
// the layout import don't silently break.

describe("Toaster module shape", () => {
  it("exports a Toaster component (function)", () => {
    expect(typeof Toaster).toBe("function");
    void vi;
  });
});
