import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Sheet } from "@/components/ui/sheet";

describe("Sheet — render branches", () => {
  it("uses pointer-events-auto when open", () => {
    const html = renderToString(
      <Sheet open onClose={() => {}}>content</Sheet>
    );
    expect(html).toContain("pointer-events-auto");
  });

  it("uses pointer-events-none when closed", () => {
    const html = renderToString(
      <Sheet open={false} onClose={() => {}}>content</Sheet>
    );
    expect(html).toContain("pointer-events-none");
  });

  it("applies right-side base classes by default + slide width", () => {
    const html = renderToString(
      <Sheet open onClose={() => {}}>x</Sheet>
    );
    expect(html).toContain("inset-y-0 right-0 border-l");
    expect(html).toContain("w-96");
  });

  it("applies left-side base classes when side=left", () => {
    const html = renderToString(
      <Sheet open onClose={() => {}} side="left">x</Sheet>
    );
    expect(html).toContain("inset-y-0 left-0 border-r");
  });

  it("applies bottom-side classes + height when side=bottom", () => {
    const html = renderToString(
      <Sheet open onClose={() => {}} side="bottom" size="lg">x</Sheet>
    );
    expect(html).toContain("inset-x-0 bottom-0 border-t");
    expect(html).toContain("h-2/3");
  });

  it("applies top-side classes + small height when side=top size=sm", () => {
    const html = renderToString(
      <Sheet open onClose={() => {}} side="top" size="sm">x</Sheet>
    );
    expect(html).toContain("inset-x-0 top-0 border-b");
    expect(html).toContain("h-1/3");
  });

  it("applies the closed translate class when not open (right)", () => {
    const html = renderToString(
      <Sheet open={false} onClose={() => {}}>x</Sheet>
    );
    expect(html).toContain("translate-x-full");
  });

  it("renders the title block + Close button when title provided", () => {
    const html = renderToString(
      <Sheet open onClose={() => {}} title="My Drawer">body</Sheet>
    );
    expect(html).toContain("My Drawer");
    expect(html).toContain('aria-label="Close panel"');
    expect(html).toContain('aria-label="My Drawer"');
  });

  it("renders the description paragraph when description provided", () => {
    const html = renderToString(
      <Sheet open onClose={() => {}} title="t" description="extra context">x</Sheet>
    );
    expect(html).toContain("extra context");
    expect(html).toContain("text-muted-foreground");
  });

  it("renders header when only description (no title) is provided", () => {
    const html = renderToString(
      <Sheet open onClose={() => {}} description="solo">x</Sheet>
    );
    expect(html).toContain("solo");
    expect(html).toContain('aria-label="Close panel"');
  });

  it("does not render the header when title and description are both omitted", () => {
    const html = renderToString(
      <Sheet open onClose={() => {}}>just body</Sheet>
    );
    expect(html).not.toContain('aria-label="Close panel"');
    expect(html).toContain("just body");
  });

  it("sets aria-hidden=true on the wrapper when closed", () => {
    const html = renderToString(
      <Sheet open={false} onClose={() => {}}>x</Sheet>
    );
    expect(html).toContain('aria-hidden="true"');
  });

  it("sets aria-modal=true on the dialog aside", () => {
    const html = renderToString(
      <Sheet open onClose={() => {}}>x</Sheet>
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });
});
