import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Breadcrumb } from "@/components/ui/breadcrumb";

describe("Breadcrumb", () => {
  it("renders a nav with aria-label=Breadcrumb", () => {
    const html = renderToString(
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Now" }]} />
    );
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain("<nav");
  });

  it("renders the last item as the current page (no link, aria-current=page)", () => {
    const html = renderToString(
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Problems", href: "/problems" },
          { label: "Two Sum" },
        ]}
      />
    );
    expect(html).toContain('aria-current="page"');
    // The last label should not be wrapped in an <a>
    const tail = html.split("Two Sum")[0];
    const lastLi = tail.lastIndexOf("<li");
    const slice = html.slice(lastLi);
    expect(slice).toContain('aria-current="page"');
    expect(slice).not.toContain("<a ");
  });

  it("renders intermediate items as Next.js links", () => {
    const html = renderToString(
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Tail" }]} />
    );
    expect(html).toContain('href="/"');
  });

  it("renders a slash separator between items but not before the first", () => {
    const html = renderToString(
      <Breadcrumb items={[{ label: "A", href: "/a" }, { label: "B" }]} />
    );
    // Two items → exactly one separator span (aria-hidden=true wrapping a slash)
    const matches = html.match(/aria-hidden="true"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("treats an item without href as non-link even if it is not last", () => {
    const html = renderToString(
      <Breadcrumb items={[{ label: "Group" }, { label: "Sub", href: "/s" }, { label: "Tail" }]} />
    );
    // Isolate the first <li> only — the second item is a link, but the first
    // (no href) must render as a <span>, not <a>.
    const liChunks = html.split("<li");
    // liChunks[0] is the prefix, liChunks[1] is first <li>'s body.
    const firstLi = liChunks[1] ?? "";
    expect(firstLi).not.toContain("<a ");
    expect(firstLi).toContain("Group");
  });

  it("merges a custom className onto the nav", () => {
    const html = renderToString(
      <Breadcrumb items={[{ label: "Only" }]} className="my-trail" />
    );
    expect(html).toContain("my-trail");
  });
});
