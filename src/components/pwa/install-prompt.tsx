"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Public for testing — pure helpers that decide whether the install banner
 * should be shown given the current localStorage state and a clock value.
 * The component itself is hard to render in our SSR-only test setup, so we
 * cover the user-visible logic here instead.
 */
export const INSTALL_DISMISS_KEY = "leetrank.pwa.installDismissedAt";
export const INSTALL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function shouldShowInstallPrompt(
  storage: Pick<Storage, "getItem"> | null,
  now: number,
): boolean {
  if (!storage) return true;
  const raw = storage.getItem(INSTALL_DISMISS_KEY);
  if (!raw) return true;
  const ts = Number.parseInt(raw, 10);
  if (!Number.isFinite(ts)) return true;
  return now - ts > INSTALL_COOLDOWN_MS;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldShowInstallPrompt(window.localStorage, Date.now())) return;

    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      try {
        window.gtag?.("event", "pwa_install");
      } catch {
        // ignore — analytics shouldn't surface as a runtime error
      }
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const remember = useCallback(() => {
    try {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    } catch {
      // private mode / disabled storage — banner just shows again next visit
    }
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) {
      setVisible(false);
      return;
    }
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        try {
          window.gtag?.("event", "pwa_install_accepted");
        } catch {
          /* noop */
        }
      } else {
        remember();
      }
    } finally {
      setDeferred(null);
      setVisible(false);
    }
  }, [deferred, remember]);

  const onDismiss = useCallback(() => {
    remember();
    setDeferred(null);
    setVisible(false);
  }, [remember]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-desc"
      className="animate-fade-in-up fixed bottom-4 left-1/2 z-[150] -translate-x-1/2 w-[min(92vw,28rem)] rounded-xl border border-border bg-card/95 backdrop-blur shadow-elevated px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p id="pwa-install-title" className="text-sm font-semibold leading-tight">
            Install LeetRank
          </p>
          <p id="pwa-install-desc" className="mt-0.5 text-xs text-muted-foreground">
            Add to your home screen for instant access and offline practice.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={onInstall} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Install
            </Button>
            <Button size="sm" variant="outline" onClick={onDismiss}>
              Maybe later
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={onDismiss}
          className="-m-1 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
