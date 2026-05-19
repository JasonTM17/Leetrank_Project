import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Card } from "@/components/ui/card";

describe("Card — hoverable prop", () => {
  it("does not include hover-lift classes when hoverable prop is omitted", () => {
    const html = renderToString(<Card>content</Card>);
    expect(html).not.toContain("hover:-translate-y-0.5");
    expect(html).not.toContain("hover:shadow-elevated");
  });

  it("includes hover:shadow-elevated when hoverable=true", () => {
    const html = renderToString(<Card hoverable>content</Card>);
    expect(html).toContain("hover:shadow-elevated");
  });

  it("includes hover:-translate-y-0.5 when hoverable=true", () => {
    const html = renderToString(<Card hoverable>content</Card>);
    expect(html).toContain("hover:-translate-y-0.5");
  });

  it("skips hover-lift classes when hoverable=false", () => {
    const html = renderToString(<Card hoverable={false}>content</Card>);
    expect(html).not.toContain("hover:-translate-y-0.5");
    expect(html).not.toContain("hover:shadow-elevated");
  });
});
