"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Larger dialogs (forms) prefer "lg"; default "md" works for confirmations. */
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS: Record<NonNullable<DialogProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

/**
 * Headless-style dialog. Uses the native <dialog> element under the hood for
 * focus trapping and Escape handling, then layers our own styles + close
 * button on top so we don't need a separate animation library.
 *
 * Focus management:
 *   - On open, autofocuses the first interactive element inside the body.
 *   - On close, restores focus to the trigger that opened the dialog.
 */
export function Dialog({ open, onClose, title, description, children, size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
      node.showModal();
      // Focus first focusable element in the body, fall back to dialog itself.
      requestAnimationFrame(() => {
        const focusable = bodyRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      });
    } else if (!open && node.open) {
      node.close();
      previouslyFocused.current?.focus?.();
    }
  }, [open]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    function onCancel(e: Event) {
      e.preventDefault();
      onClose();
    }
    node.addEventListener("cancel", onCancel);
    return () => node.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-description" : undefined}
      onClick={(e) => {
        // Click on the backdrop (the dialog itself, not its child) closes it.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "rounded-xl border bg-card text-card-foreground p-6 w-full shadow-elevated",
        "backdrop:bg-foreground/40 backdrop:backdrop-blur-sm animate-fade-in-up",
        SIZE_CLASS[size]
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 id="dialog-title" className="text-lg font-semibold">{title}</h2>
          {description && (
            <p id="dialog-description" className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          type="button"
          aria-label="Close dialog"
          className={cn(
            "rounded-md p-1 text-muted-foreground",
            "transition-colors motion-safe:duration-200 hover:text-foreground hover:bg-accent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div ref={bodyRef}>{children}</div>
    </dialog>
  );
}

