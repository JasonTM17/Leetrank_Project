import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Badge } from "@/components/ui/badge";

describe("Badge — dot prop", () => {
  it("renders a dot span when dot=true", () => {
    const html = renderToString(<Badge dot>Easy</Badge>);
    expect(html).toContain('data-slot="dot"');
  });

  it("dot span carries bg-current so it inherits variant color", () => {
    const html = renderToString(<Badge dot variant="success">Easy</Badge>);
    expect(html).toContain("bg-current");
  });

  it("does not render a dot span when dot is omitted", () => {
    const html = renderToString(<Badge>Easy</Badge>);
    expect(html).not.toContain('data-slot="dot"');
  });
});
