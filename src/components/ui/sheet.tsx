"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Slide-in side; default "right". */
  side?: "right" | "left" | "bottom" | "top";
  /** Sheet width/height (Tailwind class) for the leading edge. */
  size?: "sm" | "md" | "lg";
  title?: string;
  description?: string;
  children: ReactNode;
}

const SIZE_BY_SIDE: Record<
  NonNullable<SheetProps["side"]>,
  Record<NonNullable<SheetProps["size"]>, string>
> = {
  right:  { sm: "w-72", md: "w-96", lg: "w-[28rem]" },
  left:   { sm: "w-72", md: "w-96", lg: "w-[28rem]" },
  bottom: { sm: "h-1/3", md: "h-1/2", lg: "h-2/3" },
  top:    { sm: "h-1/3", md: "h-1/2", lg: "h-2/3" },
};

const SIDE_BASE: Record<NonNullable<SheetProps["side"]>, string> = {
  right:  "inset-y-0 right-0 border-l",
  left:   "inset-y-0 left-0 border-r",
  bottom: "inset-x-0 bottom-0 border-t",
  top:    "inset-x-0 top-0 border-b",
};

const SIDE_TRANSLATE: Record<NonNullable<SheetProps["side"]>, string> = {
  right:  "translate-x-full",
  left:   "-translate-x-full",
  bottom: "translate-y-full",
  top:    "-translate-y-full",
};

/**
 * Slide-over panel. Used for the chat widget, mobile nav drawer,
 * and full-screen filter panels on small viewports. Locks body scroll
 * while open; closes on Escape and backdrop click.
 */
export function Sheet({
  open,
  onClose,
  side = "right",
  size = "md",
  title,
  description,
  children,
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-foreground/40 motion-safe:transition-opacity motion-safe:duration-200",
          open ? "opacity-100" : "opacity-0"
        )}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute flex flex-col bg-card text-card-foreground shadow-elevated",
          "motion-safe:transition-transform motion-safe:duration-200",
          SIDE_BASE[side],
          SIZE_BY_SIDE[side][size],
          open ? "translate-x-0 translate-y-0" : SIDE_TRANSLATE[side]
        )}
      >
        {(title || description) && (
          <header className="flex items-start justify-between gap-4 border-b p-4">
            <div>
              {title && <h2 className="text-lg font-semibold">{title}</h2>}
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className={cn(
                "rounded-md p-1 text-muted-foreground",
                "transition-colors motion-safe:duration-200 hover:bg-accent hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        )}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}
