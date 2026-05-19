import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Separator } from "@/components/ui/separator";

describe("Separator", () => {
  it("renders with role=separator", () => {
    const html = renderToString(<Separator />);
    expect(html).toContain('role="separator"');
  });

  it("defaults to horizontal orientation (h-px w-full)", () => {
    const html = renderToString(<Separator />);
    expect(html).toContain('aria-orientation="horizontal"');
    expect(html).toContain("h-px");
    expect(html).toContain("w-full");
  });

  it("uses vertical layout classes when orientation=vertical", () => {
    const html = renderToString(<Separator orientation="vertical" />);
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain("h-full");
    expect(html).toContain("w-px");
  });

  it("merges a custom className with the base classes", () => {
    const html = renderToString(<Separator className="my-extra-class" />);
    expect(html).toContain("my-extra-class");
    expect(html).toContain("bg-border");
  });
});
