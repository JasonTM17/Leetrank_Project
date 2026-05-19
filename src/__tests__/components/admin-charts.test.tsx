import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { SvgBarChart, SvgPieChart, SvgSparkline } from "@/components/admin/charts";

describe("SvgBarChart", () => {
  it("renders an empty fallback when data is empty", () => {
    const html = renderToString(<SvgBarChart data={[]} />);
    expect(html).toContain("svg-bar-empty");
    expect(html).toContain("No data");
  });

  it("renders one row per datum with label + value", () => {
    const html = renderToString(
      <SvgBarChart
        data={[
          { label: "python", value: 42 },
          { label: "rust", value: 7 },
        ]}
      />
    );
    expect(html).toContain('data-testid="svg-bar-chart"');
    // Two rows = two svg-bar-row groups.
    const rows = html.match(/data-testid="svg-bar-row"/g) ?? [];
    expect(rows).toHaveLength(2);
    expect(html).toContain("python");
    expect(html).toContain("rust");
    expect(html).toContain(">42<");
    expect(html).toContain(">7<");
  });

  it("clamps to maxBars", () => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      label: `lang-${i}`,
      value: i + 1,
    }));
    const html = renderToString(<SvgBarChart data={data} maxBars={5} />);
    const rows = html.match(/data-testid="svg-bar-row"/g) ?? [];
    expect(rows).toHaveLength(5);
    // Tail rows should be omitted.
    expect(html).not.toContain("lang-11");
  });

  it("uses currentColor-aware aria label", () => {
    const html = renderToString(
      <SvgBarChart
        data={[{ label: "go", value: 1 }]}
        ariaLabel="languages by submissions"
      />
    );
    expect(html).toContain('aria-label="languages by submissions"');
    expect(html).toContain('role="img"');
  });
});

describe("SvgSparkline", () => {
  it("renders an empty fallback for fewer than two points", () => {
    const html = renderToString(<SvgSparkline data={[]} />);
    expect(html).toContain("svg-sparkline-empty");
    expect(html).toContain("Not enough data");
  });

  it("renders a polyline for valid data", () => {
    const html = renderToString(<SvgSparkline data={[1, 2, 3, 4, 5]} />);
    expect(html).toContain('data-testid="svg-sparkline"');
    // Polyline starts with M and contains L commands.
    expect(html).toMatch(/d="M[^"]*L/);
    expect(html).toContain('stroke="currentColor"');
  });

  it("respects a custom stroke", () => {
    const html = renderToString(
      <SvgSparkline data={[1, 2]} stroke="#ff0000" ariaLabel="trend" />
    );
    expect(html).toContain('stroke="#ff0000"');
    expect(html).toContain('aria-label="trend"');
  });

  it("filters out non-finite values before counting", () => {
    // After filtering NaN/Infinity, only one finite point remains -> empty.
    const html = renderToString(
      <SvgSparkline data={[Number.NaN, Number.POSITIVE_INFINITY, 5]} />
    );
    expect(html).toContain("svg-sparkline-empty");
  });
});

describe("SvgPieChart", () => {
  it("renders an empty fallback when total is zero", () => {
    const html = renderToString(<SvgPieChart data={[]} />);
    expect(html).toContain("svg-pie-empty");
  });

  it("renders one slice path + legend row per datum", () => {
    const html = renderToString(
      <SvgPieChart
        data={[
          { label: "easy", value: 30 },
          { label: "medium", value: 50 },
          { label: "hard", value: 20 },
        ]}
      />
    );
    expect(html).toContain('data-testid="svg-pie-chart"');
    const paths = html.match(/<path /g) ?? [];
    expect(paths.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain("easy");
    expect(html).toContain("medium");
    expect(html).toContain("hard");
    // Percentage labels rendered. React inserts <!-- --> markers between
    // adjacent text expressions in JSX, so match the digit-and-percent
    // pair without the literal `(`.
    expect(html).toMatch(/30(<!-- -->)?%/);
    expect(html).toMatch(/50(<!-- -->)?%/);
    expect(html).toMatch(/20(<!-- -->)?%/);
  });

  it("uses caller-supplied colours when present", () => {
    const html = renderToString(
      <SvgPieChart
        data={[
          { label: "a", value: 1, color: "#abcdef" },
          { label: "b", value: 1, color: "#123456" },
        ]}
      />
    );
    expect(html).toContain("#abcdef");
    expect(html).toContain("#123456");
  });

  it("falls back to palette when colour omitted", () => {
    const html = renderToString(
      <SvgPieChart data={[{ label: "only", value: 5 }]} />
    );
    // First palette entry is indigo #6366f1.
    expect(html).toContain("#6366f1");
  });

  it("drops zero-value rows but keeps positives", () => {
    const html = renderToString(
      <SvgPieChart
        data={[
          { label: "zero", value: 0 },
          { label: "one", value: 1 },
        ]}
      />
    );
    // The zero row must not appear in the legend list.
    expect(html).not.toContain(">zero<");
    expect(html).toContain(">one<");
  });
});
