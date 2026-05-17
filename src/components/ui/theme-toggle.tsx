"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "leetrank-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const resolved = theme === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    : theme;
  root.classList.toggle("dark", resolved === "dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "dark";
    setTheme(stored);
    applyTheme(stored);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function set(next: Theme) {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  return (
    <div
      className="inline-flex items-center rounded-full border bg-card p-0.5"
      role="radiogroup"
      aria-label="Theme"
    >
      {([
        { id: "light", label: "Light", Icon: Sun },
        { id: "system", label: "System", Icon: Monitor },
        { id: "dark", label: "Dark", Icon: Moon },
      ] as const).map(({ id, label, Icon }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => set(id)}
            className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
