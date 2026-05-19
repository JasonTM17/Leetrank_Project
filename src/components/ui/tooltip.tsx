"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  /** Visible content (icon, button, etc.). */
  children: React.ReactNode;
  /** Tooltip text shown on hover/focus. */
  content: string;
  /** Side relative to the trigger; default "top". */
  side?: "top" | "right" | "bottom" | "left";
  /** Delay before showing, in ms. Default 200. */
  delayMs?: number;
}

/**
 * Lightweight tooltip — focusable trigger wraps any element, hover or
 * keyboard focus shows the bubble. Uses native title-style timing without
 * relying on the browser's `title=` (which is unstyled and inaccessible).
 *
 * For icon-only buttons, pair this with an `aria-label` on the trigger so
 * screen readers always have access to the label even if the tooltip is dismissed.
 */
export function Tooltip({ children, content, side = "top", delayMs = 200 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delayMs);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  const sideClass =
    side === "top"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-2"
      : side === "right"
        ? "left-full top-1/2 -translate-y-1/2 ml-2"
        : side === "bottom"
          ? "top-full left-1/2 -translate-x-1/2 mt-2"
          : "right-full top-1/2 -translate-y-1/2 mr-2";

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-elevated",
          "motion-safe:transition-opacity motion-safe:duration-150",
          open ? "opacity-100" : "opacity-0",
          sideClass
        )}
      >
        {content}
      </span>
    </span>
  );
}
