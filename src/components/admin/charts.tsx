/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
/**
 * Pure-SVG admin chart primitives.
 *
 * Three chart shapes — bar, sparkline, pie — implemented with no chart
 * library so the bundle stays slim and the markup is server-renderable.
 * Charts inherit the project UI vocabulary (currentColor strokes, dot-
 * prefix labels, EmptyState fallbacks) and accept Tailwind classes via
 * `className` for theming.
 *
 * All three render an EmptyState-style fallback when given zero rows so
 * dashboards never show a blank box.
 */
import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  value: number;
}

export interface PieDatum {
  label: string;
  value: number;
  color?: string;
}

interface SvgBarChartProps {
  data: BarDatum[];
  /** Optional cap on bars rendered. Excess rows are dropped from the tail. */
  maxBars?: number;
  /** Extra container classes (height, margin, etc.). */
  className?: string;
  /** Accessible label announced to screen readers. */
  ariaLabel?: string;
}

interface SvgSparklineProps {
  data: number[];
  /** Stroke colour. Defaults to currentColor so it inherits text colour. */
  stroke?: string;
  className?: string;
  ariaLabel?: string;
}

interface SvgPieChartProps {
  data: PieDatum[];
  className?: string;
  ariaLabel?: string;
}

/**
 * Horizontal bar chart with bar widths normalised to the max value.
 * Renders one row per datum: label on the left, bar in the middle,
 * value on the right. Pure markup — no JS required.
 */
export function SvgBarChart({
  data,
  maxBars = 10,
  className,
  ariaLabel = "bar chart",
}: SvgBarChartProps) {
  const rows = (data ?? []).slice(0, maxBars);
  if (rows.length === 0) {
    return (
      <div
        data-testid="svg-bar-empty"
        className={cn(
          "flex h-32 items-center justify-center rounded-md border border-dashed bg-muted/30 text-xs text-muted-foreground",
          className
        )}
      >
        No data
      </div>
    );
  }

  const max = Math.max(1, ...rows.map((r) => r.value));
  const rowHeight = 28;
  const labelCol = 120;
  const valueCol = 56;
  const chartWidth = 320;
  const innerWidth = chartWidth - labelCol - valueCol;
  const totalHeight = rows.length * rowHeight + 8;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${chartWidth} ${totalHeight}`}
      className={cn("w-full h-full overflow-visible", className)}
      data-testid="svg-bar-chart"
    >
      {rows.map((row, i) => {
        const w = (row.value / max) * innerWidth;
        const y = i * rowHeight + 4;
        return (
          <g key={`${row.label}-${i}`} data-testid="svg-bar-row">
            <text
              x={0}
              y={y + rowHeight / 2}
              dominantBaseline="middle"
              className="fill-foreground text-[11px]"
            >
              {row.label}
            </text>
            <rect
              x={labelCol}
              y={y + 4}
              width={Math.max(2, w)}
              height={rowHeight - 12}
              rx={3}
              className="fill-primary/80"
            />
            <text
              x={chartWidth - 4}
              y={y + rowHeight / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {row.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Inline sparkline. Plots a simple polyline scaled into a fixed
 * viewBox; no axis, no labels — meant as a glanceable trend.
 */
export function SvgSparkline({
  data,
  stroke = "currentColor",
  className,
  ariaLabel = "trend",
}: SvgSparklineProps) {
  const points = (data ?? []).filter((n) => Number.isFinite(n));
  if (points.length < 2) {
    return (
      <div
        data-testid="svg-sparkline-empty"
        className={cn(
          "flex h-16 items-center justify-center rounded-md border border-dashed bg-muted/30 text-xs text-muted-foreground",
          className
        )}
      >
        Not enough data
      </div>
    );
  }

  const w = 320;
  const h = 64;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const path = points
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("w-full h-16", className)}
      data-testid="svg-sparkline"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} />
    </svg>
  );
}

const FALLBACK_PALETTE = [
  "#6366f1", // indigo
  "#22c55e", // green
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#ef4444", // red
  "#14b8a6", // teal
];

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  // Single-segment slice covering 100% would degenerate the arc, so we
  // bail to a circle path in that case.
  if (Math.abs(endDeg - startDeg) >= 359.999) {
    return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
  }
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx},${cy} L ${start.x},${start.y} A ${r},${r} 0 ${largeArc} 0 ${end.x},${end.y} Z`;
}

/**
 * Pie chart for categorical breakdowns (language popularity, etc.).
 * Falls back to the FALLBACK_PALETTE when a slice doesn't supply its
 * own color so callers can stay simple.
 */
export function SvgPieChart({ data, className, ariaLabel = "pie chart" }: SvgPieChartProps) {
  const rows = (data ?? []).filter((d) => Number.isFinite(d.value) && d.value > 0);
  const total = rows.reduce((acc, r) => acc + r.value, 0);
  if (rows.length === 0 || total === 0) {
    return (
      <div
        data-testid="svg-pie-empty"
        className={cn(
          "flex h-40 items-center justify-center rounded-md border border-dashed bg-muted/30 text-xs text-muted-foreground",
          className
        )}
      >
        No data
      </div>
    );
  }

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  let cursor = 0;
  const slices = rows.map((row, i) => {
    const fraction = row.value / total;
    const startDeg = cursor * 360;
    const endDeg = (cursor + fraction) * 360;
    cursor += fraction; // eslint-disable-line
    return {
      ...row,
      color: row.color ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
      d: arcPath(cx, cy, r, startDeg, endDeg),
    };
  });

  return (
    <div
      className={cn("flex items-center gap-4", className)}
      data-testid="svg-pie-chart"
    >
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${size} ${size}`}
        className="h-40 w-40 shrink-0"
      >
        {slices.map((s, i) => (
          <path
            key={`${s.label}-${i}`}
            d={s.d}
            fill={s.color}
            stroke="hsl(var(--background))"
            strokeWidth={1}
          />
        ))}
      </svg>
      <ul className="flex-1 space-y-1 text-xs">
        {slices.map((s, i) => {
          const pct = Math.round((s.value / total) * 1000) / 10;
          return (
            <li key={`${s.label}-${i}`} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: s.color }}
              />
              <span className="text-foreground">{s.label}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {s.value} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
