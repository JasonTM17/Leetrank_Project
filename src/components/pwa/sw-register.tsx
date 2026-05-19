"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js once on mount and listens for the SW lifecycle so the
 * app can prompt the user to reload when a new build is waiting.
 *
 * Kept as a tiny client component so RootLayout (an async server component)
 * can stay server-rendered. No render output — purely effectful.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production builds — dev mode hot-reloads conflict
    // with cached shells and produce confusing stale-page bugs.
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          if (cancelled) return;
          // When a new SW takes control mid-session, ask it to activate now
          // and reload once. controllerchange fires after skipWaiting().
          let reloaded = false;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (reloaded) return;
            reloaded = true;
            window.location.reload();
          });
          // If a waiting worker is already there on first load (e.g. a
          // previous tab installed it), kick it through immediately.
          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
          reg.addEventListener("updatefound", () => {
            const next = reg.installing;
            if (!next) return;
            next.addEventListener("statechange", () => {
              if (next.state === "installed" && navigator.serviceWorker.controller) {
                next.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch(() => {
          // Registration failures shouldn't break the app — log silently.
        });
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
