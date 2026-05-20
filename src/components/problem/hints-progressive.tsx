/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { HINT_REVEAL_PENALTY_PERCENT } from "@/lib/editorial";

interface HintsProgressiveProps {
  slug: string;
  hints: string[];
  isAuthenticated: boolean;
}

// Persist revealed indices per problem in localStorage so the user does not
// re-confirm each visit. The server endpoint is the integrity boundary —
// localStorage is just a UX cache. Schema persistence (UserHint) lands in a
// follow-up migration; the contract here stays stable.
const STORAGE_PREFIX = "leetrank.hints.revealed.";

function loadRevealed(slug: string): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + slug);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((n): n is number => Number.isInteger(n)));
  } catch {
    return new Set();
  }
}

function saveRevealed(slug: string, revealed: Set<number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + slug,
      JSON.stringify([...revealed].sort((a, b) => a - b))
    );
  } catch {
    // localStorage may be disabled in private mode — silently degrade.
  }
}

export function HintsProgressive({ slug, hints, isAuthenticated }: HintsProgressiveProps) {
  const t = useTranslations("hints");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRevealed(loadRevealed(slug));
  }, [slug]);

  // Sequential gate: hint N is only revealable after hint N-1 is open.
  const nextRevealableIndex = useMemo(() => {
    for (let i = 0; i < hints.length; i++) {
      if (!revealed.has(i)) return i;
    }
    return -1;
  }, [hints.length, revealed]);

  async function confirmReveal() {
    if (pendingIndex === null) return;
    if (!isAuthenticated) {
      // Optimistic: anon users still get a local reveal so they can read the
      // hint immediately. The endpoint would 401 anyway and this is purely a
      // copy-of-the-string operation.
      const next = new Set(revealed);
      next.add(pendingIndex);
      setRevealed(next);
      saveRevealed(slug, next);
      setPendingIndex(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/problems/${slug}/hints/${pendingIndex}/unlock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        }
      );
      // 200 + 429 are non-fatal — if rate-limited we surface a soft error
      // and let the user retry. Anything else (404 problem missing, 5xx)
      // bubbles up via the error message.
      if (!res.ok && res.status !== 429) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const next = new Set(revealed);
      next.add(pendingIndex);
      setRevealed(next);
      saveRevealed(slug, next);
      setPendingIndex(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reveal failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (hints.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">{t("noHints")}</p>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in-up">
      <ol className="space-y-2 list-none">
        {hints.map((hint, i) => {
          const isOpen = revealed.has(i);
          const isNext = i === nextRevealableIndex;
          const isFutureLocked = !isOpen && !isNext;

          if (isOpen) {
            return (
              <li
                key={i}
                className="flex gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3"
              >
                <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                <div className="flex-1 text-sm">
                  <div className="text-xs font-semibold text-muted-foreground mb-0.5">
                    {t("hintLabel", { index: i + 1 })}
                  </div>
                  <div>{hint}</div>
                </div>
              </li>
            );
          }

          if (isNext) {
            return (
              <li
                key={i}
                className="flex gap-2 rounded-md border border-dashed bg-muted/20 p-3"
              >
                <Lock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    {t("hintLabel", { index: i + 1 })}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPendingIndex(i);
                      setError(null);
                    }}
                    aria-label={t("revealAria", { index: i + 1 })}
                  >
                    {t("reveal")}
                  </Button>
                </div>
              </li>
            );
          }

          // Future-locked: rendered greyed out so the user can see the
          // reveal queue without revealing them.
          return (
            <li
              key={i}
              className="flex gap-2 rounded-md border border-dashed bg-muted/10 p-3 opacity-60"
              data-locked={isFutureLocked || undefined}
            >
              <Lock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                {t("hintLabel", { index: i + 1 })}
                <span className="ml-2 text-xs">{t("revealPrevious")}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <Dialog
        open={pendingIndex !== null}
        onClose={() => {
          if (!submitting) setPendingIndex(null);
        }}
        title={t("confirmTitle")}
        description={t("confirmBody", { penalty: HINT_REVEAL_PENALTY_PERCENT })}
        size="sm"
      >
        {error && (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPendingIndex(null)}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          <Button size="sm" onClick={confirmReveal} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {t("confirmCta")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
