import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Kbd } from "@/components/ui/kbd";

describe("Kbd", () => {
  it("renders a semantic <kbd> element with the provided text", () => {
    const html = renderToString(<Kbd>Ctrl+K</Kbd>);
    expect(html.startsWith("<kbd")).toBe(true);
    expect(html).toContain("Ctrl+K");
  });

  it("ships base styling tokens", () => {
    const html = renderToString(<Kbd>Esc</Kbd>);
    expect(html).toContain("rounded");
    expect(html).toContain("border");
    expect(html).toContain("bg-muted");
    expect(html).toContain("font-mono");
  });

  it("merges a custom className with defaults", () => {
    const html = renderToString(<Kbd className="ml-2">Tab</Kbd>);
    expect(html).toContain("ml-2");
    expect(html).toContain("font-mono");
  });

  it("forwards arbitrary HTML attributes (title) to the kbd", () => {
    const html = renderToString(<Kbd title="meta key">Cmd</Kbd>);
    expect(html).toContain('title="meta key"');
  });
});
