"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Settings as SettingsIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  type EditorPrefs,
  type EditorTheme,
} from "@/lib/editor-prefs";

interface EditorSettingsPopoverProps {
  prefs: EditorPrefs;
  setPrefs: (next: Partial<EditorPrefs>) => void;
}

const THEME_OPTIONS: { value: EditorTheme; labelKey: string }[] = [
  { value: "vs-dark", labelKey: "themeDark" },
  { value: "vs", labelKey: "themeLight" },
  { value: "hc-black", labelKey: "themeHighContrast" },
];

/**
 * Gear-icon popover that drives Monaco editor preferences.
 *
 * Mirrors LeetCode premium's editor settings: vim toggle, theme,
 * font-size slider, tab width, soft-wrap. Each control writes through
 * the controlled {@link setPrefs} so the editor surface reflects every
 * change live — no apply button.
 *
 * Closes on outside click and Escape, matching the dropdown menu next
 * door so the toolbar feels coherent.
 */
export function EditorSettingsPopover({ prefs, setPrefs }: EditorSettingsPopoverProps) {
  const t = useTranslations("editor");
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

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        size="sm"
        variant="ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("settings")}
        onClick={() => setOpen((o) => !o)}
      >
        <SettingsIcon className="h-4 w-4" />
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label={t("settings")}
          className={cn(
            "absolute right-0 z-40 mt-2 w-72 rounded-md border bg-card p-4 shadow-elevated",
            "animate-fade-in-up"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t("settings")}</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Vim mode */}
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{t("vim")}</span>
              <input
                type="checkbox"
                checked={prefs.vimMode}
                onChange={(e) => setPrefs({ vimMode: e.target.checked })}
                className="h-4 w-4 rounded border-input accent-primary"
                aria-label={t("vim")}
              />
            </label>

            {/* Theme */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="editor-theme">
                {t("theme")}
              </label>
              <select
                id="editor-theme"
                value={prefs.theme}
                onChange={(e) => setPrefs({ theme: e.target.value as EditorTheme })}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {THEME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            {/* Font size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" htmlFor="editor-font-size">
                  {t("fontSize")}
                </label>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {prefs.fontSize}px
                </span>
              </div>
              <input
                id="editor-font-size"
                type="range"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                step={1}
                value={prefs.fontSize}
                onChange={(e) => setPrefs({ fontSize: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>

            {/* Tab width */}
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">{t("tabWidth")}</legend>
              <div className="flex gap-2">
                {[2, 4].map((w) => (
                  <label
                    key={w}
                    className={cn(
                      "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm",
                      "transition-colors motion-safe:duration-200",
                      prefs.tabWidth === w
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-accent"
                    )}
                  >
                    <input
                      type="radio"
                      name="tab-width"
                      value={w}
                      checked={prefs.tabWidth === w}
                      onChange={() => setPrefs({ tabWidth: w as 2 | 4 })}
                      className="sr-only"
                    />
                    {w}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Word wrap */}
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{t("wordWrap")}</span>
              <input
                type="checkbox"
                checked={prefs.wordWrap}
                onChange={(e) => setPrefs({ wordWrap: e.target.checked })}
                className="h-4 w-4 rounded border-input accent-primary"
                aria-label={t("wordWrap")}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
