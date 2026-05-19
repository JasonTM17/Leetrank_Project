import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Badge } from "@/components/ui/badge";

describe("Badge — dot prop", () => {
  it("does not render a dot when dot prop is omitted", () => {
    const html = renderToString(<Badge>Live</Badge>);
    expect(html).not.toContain('data-slot="dot"');
  });

  it("renders dot span with success variant token when dot=true and variant=success", () => {
    const html = renderToString(<Badge dot variant="success">Live</Badge>);
    // The badge wrapper carries bg-success/10; the dot inherits via bg-current
    expect(html).toContain("bg-success");
    expect(html).toContain('data-slot="dot"');
  });

  it("renders dot span with destructive variant token when dot=true and variant=destructive", () => {
    const html = renderToString(<Badge dot variant="destructive">Error</Badge>);
    expect(html).toContain("bg-destructive");
    expect(html).toContain('data-slot="dot"');
  });

  it("renders dot span with warning variant token when dot=true and variant=warning", () => {
    const html = renderToString(<Badge dot variant="warning">Warn</Badge>);
    expect(html).toContain("bg-warning");
    expect(html).toContain('data-slot="dot"');
  });
});
