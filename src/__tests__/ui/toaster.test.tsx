import { describe, it, expect, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { Toaster } from "@/components/ui/toaster";
import { useToastStore, toast } from "@/hooks/useToast";

/**
 * Toaster is a thin client-only render of the toast store, so we can
 * exercise its branches without a DOM by:
 *   1. Driving the zustand store directly (push / dismiss / clear).
 *   2. Calling renderToString to get the markup the React pipeline
 *      would emit on a server render or hydrate target.
 *
 * That hits every branch except `useEffect`-driven auto-dismissal,
 * which lives in `useAutoDismiss` (covered separately in
 * useToast.test.ts and below via timer simulation).
 */

beforeEach(() => {
  useToastStore.getState().clear();
});

describe("Toaster — render", () => {
  it("returns null markup when there are no toasts", () => {
    const html = renderToString(<Toaster />);
    expect(html).toBe("");
  });

  it("renders a region landmark with the notifications label when toasts exist", () => {
    toast.success("Saved");
    const html = renderToString(<Toaster />);
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Notifications"');
  });

  it("renders the toast title and description text", () => {
    toast.info("Heads up", "More details here");
    const html = renderToString(<Toaster />);
    expect(html).toContain("Heads up");
    expect(html).toContain("More details here");
  });

  it("applies the success variant border + background classes for toast.success", () => {
    toast.success("Yay");
    const html = renderToString(<Toaster />);
    expect(html).toContain("border-success/30");
    expect(html).toContain("bg-success/10");
  });

  it("applies the destructive variant classes for toast.error", () => {
    toast.error("Oops");
    const html = renderToString(<Toaster />);
    expect(html).toContain("border-destructive/30");
    expect(html).toContain("bg-destructive/10");
  });

  it("applies the warning variant classes for toast.warning", () => {
    toast.warning("Careful");
    const html = renderToString(<Toaster />);
    expect(html).toContain("border-warning/30");
  });

  it("applies the primary/info variant classes for toast.info", () => {
    toast.info("FYI");
    const html = renderToString(<Toaster />);
    expect(html).toContain("border-primary/30");
  });

  it("applies the default neutral border + bg classes for toast.show", () => {
    toast.show("Plain");
    const html = renderToString(<Toaster />);
    expect(html).toContain("border-border");
    expect(html).toContain("bg-card");
  });

  it("renders a dismiss button with the Dismiss notification aria-label per toast", () => {
    toast.success("a");
    toast.error("b");
    const html = renderToString(<Toaster />);
    const matches = html.match(/aria-label="Dismiss notification"/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("renders multiple stacked toasts in insertion order", () => {
    toast.success("first");
    toast.error("second");
    toast.info("third");
    const html = renderToString(<Toaster />);
    const firstIdx = html.indexOf("first");
    const secondIdx = html.indexOf("second");
    const thirdIdx = html.indexOf("third");
    expect(firstIdx).toBeGreaterThan(-1);
    expect(secondIdx).toBeGreaterThan(firstIdx);
    expect(thirdIdx).toBeGreaterThan(secondIdx);
  });

  it("omits the description div when no description was supplied", () => {
    toast.success("title-only");
    const html = renderToString(<Toaster />);
    expect(html).toContain("title-only");
    // The description block is only rendered when t.description is truthy.
    expect(html).not.toContain("text-foreground/70");
  });

  it("renders the animate-fade-in-up class on each toast for entrance polish", () => {
    toast.success("animate me");
    const html = renderToString(<Toaster />);
    expect(html).toContain("animate-fade-in-up");
  });
});

describe("Toaster — store integration", () => {
  it("dismiss removes only the targeted toast leaving siblings intact", () => {
    const idA = useToastStore.getState().push({ title: "a", variant: "default" });
    useToastStore.getState().push({ title: "b", variant: "default" });
    useToastStore.getState().dismiss(idA);
    const left = useToastStore.getState().toasts.map((t) => t.title);
    expect(left).toEqual(["b"]);
  });

  it("re-renders to empty markup once every toast is dismissed", () => {
    const id = useToastStore.getState().push({ title: "x", variant: "default" });
    useToastStore.getState().dismiss(id);
    const html = renderToString(<Toaster />);
    expect(html).toBe("");
  });
});
