"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  /** Element that opens the menu when clicked. */
  trigger: ReactNode;
  children: ReactNode;
  /** Menu width in Tailwind class form; default w-48. */
  widthClass?: string;
  /** Side; default "bottom-end". */
  align?: "bottom-start" | "bottom-end";
}

/**
 * Headless dropdown menu. Closes on outside click and Escape.
 * Compose with <DropdownMenuItem /> children.
 */
export function DropdownMenu({
  trigger,
  children,
  widthClass = "w-48",
  align = "bottom-end",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const alignClass = align === "bottom-end" ? "right-0" : "left-0";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {trigger}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-2 rounded-md border bg-card p-1 shadow-elevated animate-fade-in-up",
            widthClass,
            alignClass
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface DropdownMenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  /** Render as a link by passing href; otherwise rendered as a button. */
  href?: string;
  /** Optional leading icon. */
  icon?: ReactNode;
}

export function DropdownMenuItem({
  children,
  onSelect,
  disabled,
  href,
  icon,
}: DropdownMenuItemProps) {
  const className = cn(
    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
    "transition-colors motion-safe:duration-200",
    "hover:bg-accent hover:text-accent-foreground",
    "focus-visible:bg-accent focus-visible:text-accent-foreground",
    disabled && "pointer-events-none opacity-50"
  );

  if (href) {
    return (
      <a href={href} role="menuitem" className={className}>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        {children}
      </a>
    );
  }

  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onSelect} className={className}>
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      {children}
    </button>
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{children}</div>
  );
}

export function DropdownMenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}
