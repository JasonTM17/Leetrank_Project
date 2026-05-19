import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Button } from "@/components/ui/button";

describe("Button — loading prop", () => {
  it("is disabled when loading=true", () => {
    const html = renderToString(<Button loading>Submit</Button>);
    // React renders the boolean disabled attribute as disabled=""
    expect(html).toContain('disabled=""');
  });

  it("renders a spinner SVG when loading=true", () => {
    const html = renderToString(<Button loading>Submit</Button>);
    // Loader2 from lucide-react renders an <svg> element
    expect(html).toContain("<svg");
  });

  it("sets aria-busy when loading=true", () => {
    const html = renderToString(<Button loading>Submit</Button>);
    expect(html).toContain('aria-busy="true"');
  });

  it("is not disabled when loading is omitted", () => {
    const html = renderToString(<Button>Submit</Button>);
    // The Tailwind utility class "disabled:..." appears in the class string,
    // but the boolean attribute disabled="" must NOT be present.
    expect(html).not.toContain('disabled=""');
  });
});
