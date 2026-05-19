import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Skeleton } from "@/components/ui/skeleton";

describe("Skeleton", () => {
  it("renders a div with the loading-state classes", () => {
    const html = renderToString(<Skeleton />);
    expect(html.startsWith("<div")).toBe(true);
    expect(html).toContain("motion-safe:animate-pulse");
    expect(html).toContain("rounded-md");
    expect(html).toContain("bg-muted");
  });

  it("merges a caller className without dropping defaults", () => {
    const html = renderToString(<Skeleton className="h-10 w-32" />);
    expect(html).toContain("h-10");
    expect(html).toContain("w-32");
    expect(html).toContain("motion-safe:animate-pulse");
  });

  it("forwards arbitrary HTML attributes (aria-label) onto the div", () => {
    const html = renderToString(<Skeleton aria-label="loading content" />);
    expect(html).toContain('aria-label="loading content"');
  });
});
