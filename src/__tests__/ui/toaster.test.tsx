import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import type { Toast } from "@/hooks/useToast";

/**
 * Toaster reads from the zustand store via useSyncExternalStore.
 * On a node-only renderToString pass, useSyncExternalStore reads the
 * server snapshot — which for zustand is whatever the store held at
 * module init (empty), so runtime store mutations don't surface in
 * SSR markup.
 *
 * Instead of fighting that, we mock @/hooks/useToast so the selector
 * returns a deterministic toasts array per test. That lets us verify
 * exactly what markup the component emits for each variant + branch
 * combination — which is what production users actually see — without
 * pulling jsdom or @testing-library/react into devDeps.
 *
 * Auto-dismiss timing is covered by useToast.test.ts; this file
 * focuses on the rendered surface: variants, ARIA, dismiss button,
 * description visibility, and empty-state.
 */

const dismissSpy = vi.fn();
let mockToasts: Toast[] = [];

vi.mock("@/hooks/useToast", () => ({
  useToastStore: <T,>(selector: (s: { toasts: Toast[]; dismiss: (id: string) => void }) => T) =>
    selector({ toasts: mockToasts, dismiss: dismissSpy }),
  useAutoDismiss: () => {},
}));

// Import AFTER vi.mock so the real module resolution sees our stub.
import { Toaster } from "@/components/ui/toaster";

function setToasts(...next: Partial<Toast>[]) {
  mockToasts = next.map((t, i) => ({
    id: t.id ?? `toast-${i}`,
    variant: t.variant ?? "default",
    duration: t.duration ?? 4000,
    title: t.title,
    description: t.description,
  }));
}

beforeEach(() => {
  mockToasts = [];
  dismissSpy.mockReset();
});

describe("Toaster — render", () => {
  it("returns null markup when there are no toasts", () => {
    const html = renderToString(<Toaster />);
    expect(html).toBe("");
  });

  it("renders a region landmark with the notifications label when toasts exist", () => {
    setToasts({ title: "Saved", variant: "success" });
    const html = renderToString(<Toaster />);
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Notifications"');
  });

  it("renders the toast title and description text", () => {
    setToasts({ title: "Heads up", description: "More details here", variant: "info" });
    const html = renderToString(<Toaster />);
    expect(html).toContain("Heads up");
    expect(html).toContain("More details here");
  });

  it("applies the success variant border + background classes", () => {
    setToasts({ title: "Yay", variant: "success" });
    const html = renderToString(<Toaster />);
    expect(html).toContain("border-success/30");
    expect(html).toContain("bg-success/10");
  });

  it("applies the destructive variant classes for the error variant", () => {
    setToasts({ title: "Oops", variant: "error" });
    const html = renderToString(<Toaster />);
    expect(html).toContain("border-destructive/30");
    expect(html).toContain("bg-destructive/10");
  });

  it("applies the warning variant classes", () => {
    setToasts({ title: "Careful", variant: "warning" });
    const html = renderToString(<Toaster />);
    expect(html).toContain("border-warning/30");
  });

  it("applies the primary classes for the info variant", () => {
    setToasts({ title: "FYI", variant: "info" });
    const html = renderToString(<Toaster />);
    expect(html).toContain("border-primary/30");
  });

  it("applies the default neutral border + bg classes for the default variant", () => {
    setToasts({ title: "Plain", variant: "default" });
    const html = renderToString(<Toaster />);
    expect(html).toContain("border-border");
    expect(html).toContain("bg-card");
  });

  it("renders one Dismiss notification button per toast", () => {
    setToasts(
      { title: "a", variant: "success" },
      { title: "b", variant: "error" }
    );
    const html = renderToString(<Toaster />);
    const matches = html.match(/aria-label="Dismiss notification"/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("renders multiple stacked toasts in insertion order", () => {
    setToasts(
      { title: "first", variant: "success" },
      { title: "second", variant: "error" },
      { title: "third", variant: "info" }
    );
    const html = renderToString(<Toaster />);
    const firstIdx = html.indexOf("first");
    const secondIdx = html.indexOf("second");
    const thirdIdx = html.indexOf("third");
    expect(firstIdx).toBeGreaterThan(-1);
    expect(secondIdx).toBeGreaterThan(firstIdx);
    expect(thirdIdx).toBeGreaterThan(secondIdx);
  });

  it("omits the description block when no description was supplied", () => {
    setToasts({ title: "title-only", variant: "success" });
    const html = renderToString(<Toaster />);
    expect(html).toContain("title-only");
    expect(html).not.toContain("text-foreground/70");
  });

  it("includes animate-fade-in-up on rendered toasts for entrance polish", () => {
    setToasts({ title: "animate me", variant: "success" });
    const html = renderToString(<Toaster />);
    expect(html).toContain("animate-fade-in-up");
  });

  it("renders aria-live=polite on each toast for screen-reader announcements", () => {
    setToasts(
      { title: "a", variant: "success" },
      { title: "b", variant: "error" }
    );
    const html = renderToString(<Toaster />);
    const matches = html.match(/aria-live="polite"/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("renders only the title block when description is the empty string", () => {
    setToasts({ title: "only", description: "", variant: "info" });
    const html = renderToString(<Toaster />);
    expect(html).toContain("only");
    // Empty-string descriptions should not produce a description div.
    expect(html).not.toContain("text-foreground/70");
  });
});
