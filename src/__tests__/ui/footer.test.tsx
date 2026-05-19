import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Footer } from "@/components/layout/footer";

describe("Footer", () => {
  it("renders the brand mark and current year copyright", () => {
    const html = renderToString(<Footer />);
    expect(html).toContain("LeetRank");
    expect(html).toContain(new Date().getFullYear().toString());
    expect(html).toContain("Built for learning");
  });

  it("links to the four primary navigation surfaces", () => {
    const html = renderToString(<Footer />);
    for (const href of ["/problems", "/contests", "/leaderboard", "/status"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("uses the semantic <footer> element", () => {
    const html = renderToString(<Footer />);
    expect(html.startsWith("<footer")).toBe(true);
  });
});
