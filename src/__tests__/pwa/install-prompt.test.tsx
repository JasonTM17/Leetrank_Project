import { describe, it, expect } from "vitest";
import {
  shouldShowInstallPrompt,
  INSTALL_DISMISS_KEY,
  INSTALL_COOLDOWN_MS,
} from "@/components/pwa/install-prompt";

/**
 * The install banner is rendered through useEffect + browser-only events
 * (`beforeinstallprompt`), which doesn't survive node `renderToString`.
 * The user-visible behavior we care about is the cooldown logic — that
 * dismissals are honored for 7 days. Cover that purely.
 */

function makeStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
}

describe("InstallPrompt — shouldShowInstallPrompt", () => {
  const NOW = 1_700_000_000_000;

  it("shows the prompt when storage is unavailable", () => {
    expect(shouldShowInstallPrompt(null, NOW)).toBe(true);
  });

  it("shows the prompt when no dismissal has been recorded", () => {
    const storage = makeStorage();
    expect(shouldShowInstallPrompt(storage, NOW)).toBe(true);
  });

  it("hides the prompt immediately after a dismissal", () => {
    const storage = makeStorage({ [INSTALL_DISMISS_KEY]: String(NOW - 1000) });
    expect(shouldShowInstallPrompt(storage, NOW)).toBe(false);
  });

  it("hides the prompt for the entire 7-day cooldown window", () => {
    const oneMinuteShy = NOW - (INSTALL_COOLDOWN_MS - 60_000);
    const storage = makeStorage({ [INSTALL_DISMISS_KEY]: String(oneMinuteShy) });
    expect(shouldShowInstallPrompt(storage, NOW)).toBe(false);
  });

  it("shows the prompt again after the 7-day cooldown elapses", () => {
    const oneMinutePast = NOW - (INSTALL_COOLDOWN_MS + 60_000);
    const storage = makeStorage({ [INSTALL_DISMISS_KEY]: String(oneMinutePast) });
    expect(shouldShowInstallPrompt(storage, NOW)).toBe(true);
  });

  it("treats a non-numeric dismissal value as no dismissal", () => {
    const storage = makeStorage({ [INSTALL_DISMISS_KEY]: "definitely-not-a-number" });
    expect(shouldShowInstallPrompt(storage, NOW)).toBe(true);
  });

  it("treats an empty-string dismissal value as no dismissal", () => {
    const storage = makeStorage({ [INSTALL_DISMISS_KEY]: "" });
    expect(shouldShowInstallPrompt(storage, NOW)).toBe(true);
  });

  it("uses the exact 7-day window as the threshold", () => {
    expect(INSTALL_COOLDOWN_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
