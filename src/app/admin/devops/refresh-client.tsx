/* eslint-disable react-hooks/purity */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const REFRESH_MS = 30_000;

/**
 * Refresh control + 30s auto-refresh for the DevOps console.
 *
 * - Calls `router.refresh()` so the server component re-renders with a
 *   fresh snapshot. No client-side fetch / state required because the
 *   page itself is server-rendered.
 * - The "Refresh now" button is also wired to `/api/admin/devops/snapshot`
 *   for a quick health-check ping (auth + 200 envelope) before triggering
 *   the full server refresh.
 */
export function DevopsRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastTick, setLastTick] = useState<number>(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      startTransition(() => {
        router.refresh();
        setLastTick(Date.now());
      });
    }, REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [router]);

  async function refreshNow() {
    try {
      await fetch("/api/admin/devops/snapshot", { cache: "no-store" });
    } catch {
      // Ignore — the server refresh below is the source of truth.
    }
    startTransition(() => {
      router.refresh();
      setLastTick(Date.now());
    });
  }

  const seconds = Math.floor((Date.now() - lastTick) / 1000);

  return (
    <div className="flex items-center gap-3">
      <span className="hidden md:inline text-xs text-muted-foreground tabular-nums">
        auto-refresh {Math.max(0, Math.floor(REFRESH_MS / 1000) - seconds)}s
      </span>
      <Button onClick={refreshNow} size="sm" variant="outline" disabled={pending} className="gap-2">
        <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
        Refresh now
      </Button>
    </div>
  );
}
