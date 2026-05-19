import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Footer } from "@/components/layout/footer";

describe("Footer", () => {
  it("renders the brand mark and current year copyright", () => {
    const html = renderToString(<Footer />);
    expect(html).toContain("LeetRank");
    expect(html).toContain(new Date().getFullYear().toString());
    // Translation key — see messages/en.json#footer.builtForLearning. The
    // test mock for next-intl returns keys verbatim so this stays stable
    // even when the English copy is rephrased.
    expect(html).toContain("builtForLearning");
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
