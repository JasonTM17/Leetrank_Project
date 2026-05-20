/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, Loader2 } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";

interface EditorialTabProps {
  slug: string;
  /**
   * When false (anonymous user), the tab renders an inline sign-in CTA
   * without firing the network — the API would 401 anyway.
   */
  isAuthenticated: boolean;
}

interface EditorialResponse {
  unlocked: boolean;
  reason: "submitted" | "grace-elapsed" | "locked";
  editorial: string | null;
  unlocksAt?: string;
  countdownSeconds?: number;
}

// Render countdown as "Nd Hh Mm" — coarse units keep the chrome quiet.
function formatCountdown(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

export function EditorialTab({ slug, isAuthenticated }: EditorialTabProps) {
  const t = useTranslations("editorial");
  const [data, setData] = useState<EditorialResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/problems/${slug}/editorial`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) throw new Error("auth");
          if (res.status === 404) throw new Error("notFound");
          throw new Error("failed");
        }
        return res.json();
      })
      .then((payload: EditorialResponse) => {
        if (!cancelled) setData(payload);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, isAuthenticated]);

  // ── Anonymous gate ─────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center animate-fade-in-up">
        <Lock className="h-6 w-6 mx-auto text-muted-foreground" aria-hidden />
        <h3 className="mt-2 font-semibold">{t("signInTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("signInBody")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[160px]" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
        {error === "notFound" ? t("notFound") : t("loadFailed")}
      </div>
    );
  }

  // ── Locked: countdown to unlock ────────────────────────────────────────────
  if (data && !data.unlocked) {
    const countdown = formatCountdown(data.countdownSeconds ?? 0);
    return (
      <div className="rounded-md border border-dashed bg-muted/20 p-6 animate-fade-in-up">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden />
          <div className="flex-1">
            <h3 className="font-semibold">{t("lockedTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("lockedBody")}</p>
            <p className="mt-3 text-xs font-mono tabular-nums text-foreground/70">
              <span aria-hidden className="mr-1 text-amber-500">●</span>
              {t("unlockIn", { countdown })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Unlocked: render markdown editorial ────────────────────────────────────
  if (data && data.unlocked && !data.editorial) {
    return (
      <div className="rounded-md border bg-muted/20 p-6 text-center text-sm text-muted-foreground animate-fade-in-up">
        {t("noEditorialYet")}
      </div>
    );
  }

  if (data?.editorial) {
    return (
      <div className="animate-fade-in-up">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span aria-hidden className="text-emerald-500">●</span>
          {data.reason === "submitted" ? t("unlockedSubmitted") : t("unlockedGrace")}
        </div>
        <Markdown>{data.editorial}</Markdown>
      </div>
    );
  }

  return null;
}
