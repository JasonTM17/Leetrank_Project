import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Heart } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("renders the title", () => {
    const html = renderToString(<EmptyState title="Nothing here" />);
    expect(html).toContain("Nothing here");
    expect(html).toContain("<h3");
  });

  it("renders the description when provided", () => {
    const html = renderToString(
      <EmptyState title="Empty" description="No items match." />
    );
    expect(html).toContain("No items match.");
  });

  it("does not render a description block when omitted", () => {
    const html = renderToString(<EmptyState title="Empty" />);
    expect(html).not.toContain("max-w-sm");
  });

  it("renders the icon wrapper when icon prop is given", () => {
    const html = renderToString(<EmptyState title="Empty" icon={Heart} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("rounded-full");
    expect(html).toContain("bg-muted");
  });

  it("renders the action slot when provided", () => {
    const html = renderToString(
      <EmptyState title="Empty" action={<button type="button">Retry</button>} />
    );
    expect(html).toContain("Retry");
    expect(html).toContain("<button");
  });

  it("merges a custom className", () => {
    const html = renderToString(<EmptyState title="Empty" className="my-zone" />);
    expect(html).toContain("my-zone");
    expect(html).toContain("border-dashed");
  });
});
