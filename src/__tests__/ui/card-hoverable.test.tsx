import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Card } from "@/components/ui/card";

describe("Card — hoverable prop", () => {
  it("includes the lift translate class when hoverable=true", () => {
    const html = renderToString(<Card hoverable>content</Card>);
    expect(html).toContain("hover:-translate-y-0.5");
  });

  it("includes the elevated shadow class when hoverable=true", () => {
    const html = renderToString(<Card hoverable>content</Card>);
    expect(html).toContain("hover:shadow-elevated");
  });

  it("includes motion-safe transition guard when hoverable=true", () => {
    const html = renderToString(<Card hoverable>content</Card>);
    expect(html).toContain("motion-safe:duration-200");
  });

  it("does not include hover lift classes when hoverable is omitted", () => {
    const html = renderToString(<Card>content</Card>);
    expect(html).not.toContain("hover:-translate-y-0.5");
  });
});
