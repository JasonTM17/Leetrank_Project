import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Button } from "@/components/ui/button";

describe("Button — loading prop", () => {
  it("is enabled when loading prop is omitted", () => {
    const html = renderToString(<Button>Save</Button>);
    expect(html).not.toContain('disabled=""');
  });

  it("is disabled when loading=true", () => {
    const html = renderToString(<Button loading>Save</Button>);
    expect(html).toContain('disabled=""');
  });

  it("sets aria-busy=true when loading=true", () => {
    const html = renderToString(<Button loading>Save</Button>);
    expect(html).toContain('aria-busy="true"');
  });

  it("renders Loader2 spinner svg with animate-spin when loading=true", () => {
    const html = renderToString(<Button loading>Save</Button>);
    expect(html).toContain("<svg");
    expect(html).toContain("animate-spin");
  });

  it("is enabled when loading=false", () => {
    const html = renderToString(<Button loading={false}>Save</Button>);
    expect(html).not.toContain('disabled=""');
  });
});
