"use client";

import { cn } from "@/lib/utils";

/**
 * Visual divider. Use vertically (default) between blocks, or
 * `orientation="vertical"` between inline items inside a flex row.
 */
export function Separator({
  orientation = "horizontal",
  className,
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "bg-border shrink-0",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
    />
  );
}
