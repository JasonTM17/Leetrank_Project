"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="inline-flex items-center rounded-full border bg-card p-0.5"
      role="radiogroup"
      aria-label="Theme"
    >
      {([
        { id: "light",  label: "Light",  Icon: Sun },
        { id: "system", label: "System", Icon: Monitor },
        { id: "dark",   label: "Dark",   Icon: Moon },
      ] as const).map(({ id, label, Icon }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(id)}
            className={cn(
              "inline-flex items-center justify-center h-7 w-7 rounded-full",
              "transition-colors motion-safe:duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
