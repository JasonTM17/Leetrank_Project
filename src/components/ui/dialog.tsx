"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

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
 */
export function Dialog({ open, onClose, title, description, children, size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
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
      onClick={(e) => {
        // Click on the backdrop (the dialog itself, not its child) closes it.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "rounded-xl border bg-card text-card-foreground p-6 w-full shadow-elevated backdrop:bg-foreground/40 backdrop:backdrop-blur-sm animate-fade-in-up",
        SIZE_CLASS[size]
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Close dialog"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div>{children}</div>
    </dialog>
  );
}
