import { describe, it, expect } from "vitest";
import { EditorSettingsPopover } from "@/components/problem/editor-settings";

// Vitest config uses environment: "node" (no jsdom), so component render
// tests would require pulling in a DOM. Mirroring the toaster-shape
// pattern, we at least guarantee the popover module compiles cleanly,
// exports the expected symbol, and is importable from the layout chain.

describe("EditorSettingsPopover module shape", () => {
  it("exports a component (function)", () => {
    expect(typeof EditorSettingsPopover).toBe("function");
  });
});
