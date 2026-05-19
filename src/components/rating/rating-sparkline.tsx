"use client";

/**
 * Tiny inline SVG sparkline for a user's rating history. No dependencies.
 *
 * Renders a smooth line over the rating sequence with a soft area fill.
 * Designed for the user profile rating-history card; falls back to a
 * single-point dot when only one rating change exists.
 */
export function RatingSparkline({
  points,
  width = 480,
  height = 80,
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (points.length === 0) return null;

  const padding = 4;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);

  const xy = points.map((value, i) => {
    const x = points.length === 1 ? width / 2 : padding + (i * innerW) / (points.length - 1);
    const y = padding + innerH - ((value - min) / span) * innerH;
    return [x, y] as const;
  });

  const linePath = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L${(xy[xy.length - 1][0]).toFixed(2)},${(height - padding).toFixed(2)} L${(xy[0][0]).toFixed(2)},${(height - padding).toFixed(2)} Z`;

  const last = xy[xy.length - 1];

  return (
    <svg
      role="img"
      aria-label={`Rating history with ${points.length} entries`}
      viewBox={`0 0 ${width} ${height}`}
      className={className ?? "w-full h-20"}
    >
      <defs>
        <linearGradient id="rating-spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="text-primary">
        <path d={areaPath} fill="url(#rating-spark-fill)" />
        <path d={linePath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="3" fill="currentColor" />
      </g>
    </svg>
  );
}
