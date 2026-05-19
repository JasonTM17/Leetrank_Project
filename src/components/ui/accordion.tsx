"use client";

import { createContext, useContext, useState, type ReactNode, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Context ────────────────────────────────────────────────────────────────────

interface AccordionContextValue {
  openValue: string | null;
  toggle: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextValue>({
  openValue: null,
  toggle: () => {},
});

// ── Accordion (root) ───────────────────────────────────────────────────────────

interface AccordionProps {
  /** Only "single" is supported: one item open at a time. */
  type?: "single";
  /** Value of the item that should be open on first render. */
  defaultOpen?: string;
  children: ReactNode;
  className?: string;
}

export function Accordion({
  defaultOpen = "",
  children,
  className,
}: AccordionProps) {
  const [openValue, setOpenValue] = useState<string | null>(defaultOpen || null);

  function toggle(value: string) {
    setOpenValue((prev) => (prev === value ? null : value));
  }

  return (
    <AccordionContext.Provider value={{ openValue, toggle }}>
      <div className={cn("divide-y divide-border rounded-md border", className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

// ── AccordionItem ──────────────────────────────────────────────────────────────

interface AccordionItemProps {
  value: string;
  title: string;
  children: ReactNode;
  className?: string;
}

export function AccordionItem({ value, title, children, className }: AccordionItemProps) {
  const { openValue, toggle } = useContext(AccordionContext);
  const isOpen = openValue === value;
  const triggerId = `accordion-trigger-${value}`;
  const panelId = `accordion-panel-${value}`;

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(value);
    }
  }

  return (
    <div className={cn("bg-card", className)}>
      {/* Trigger */}
      <button
        id={triggerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => toggle(value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-left",
          "transition-colors motion-safe:duration-200 hover:bg-muted/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          isOpen ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span>{title}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Animated panel — CSS grid trick: 0fr ↔ 1fr, no JS height measurement */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className={cn(
          "grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-in-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        {/* Inner wrapper must have overflow-hidden + min-h-0 for the trick to work */}
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
