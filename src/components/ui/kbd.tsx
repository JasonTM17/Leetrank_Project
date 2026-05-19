import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Kbd({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
