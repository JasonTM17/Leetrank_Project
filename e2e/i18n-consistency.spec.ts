import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * Manual UX QA against the local dev server:
 *   1. Mixed EN/VI strings on the same page (i18n leaks).
 *   2. PWA install prompt dismissal — does "Maybe later" actually
 *      suppress the popup on subsequent loads?
 *
 * The spec is read-only against the rest of the repo (no DB / file mutations
 * outside e2e/test-results) and uses soft assertions throughout so a single
 * leak doesn't bail the whole audit. Failure screenshots go to test-results/.
 *
 * Run desktop:
 *   E2E_BASE_URL=http://localhost:3000 pnpm exec playwright test \
 *     e2e/i18n-consistency.spec.ts --project=chromium-desktop
 * Run mobile:
 *   pnpm exec playwright test e2e/i18n-consistency.spec.ts --project=mobile
 */

const PROD_BASE_URL = process.env.E2E_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

type Locale = "en" | "vi";
type Severity = "HIGH" | "MEDIUM" | "LOW";

interface Leak {
  route: string;
  locale: Locale;
  element: string;
  staleText: string;
  severity: Severity;
}

const LEAKS: Leak[] = [];
const PWA_OBSERVATIONS: { behavior: string; observation: string; severity: Severity }[] = [];
const OTHER: { area: string; detail: string; severity: Severity }[] = [];

function pushLeak(l: Leak) {
  LEAKS.push(l);

  console.log(
    `[i18n ${l.severity}] ${l.locale.toUpperCase()} ${l.route} :: ${l.element} -> "${l.staleText.slice(0, 80)}"`
  );
}

// Routes to walk. Detail page handled separately (we click into one).
const ROUTES = [
  "/",
  "/problems",
  "/leaderboard",
  "/contests",
  "/login",
  "/register",
  "/dashboard/settings",
  "/study-plans",
  "/achievements",
];

// Quick heuristics. Vietnamese strings carry diacritics from this set; English
// strings don't. We also flag literal i18n key paths (e.g. "achievements.title")
// and the placeholder phrase "Loading..." surfacing inside Vietnamese sentences.
const VIETNAMESE_DIACRITIC_RX =
  /[ăâđêôơưĂÂĐÊÔƠƯáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]/;

const I18N_KEY_RX = /\b[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)?\b/;

// Common English tokens that, if seen verbatim while VI is active, indicate a
// stale (untranslated) string. Conservative — we only flag well-known UI labels
// that have a known VI counterpart in messages/vi.json.
const STALE_EN_PHRASES = [
  /\bLoading\.\.\./,
  /\bSomething went wrong\b/i,
  /\bSign\s*up\b/i,
  /\bSign\s*in\b/i,
  /\bLog\s*in\b/i,
  /\bLog\s*out\b/i,
  /\bDashboard\b/,
  /\bSettings\b/,
  /\bLeaderboard\b/,
  /\bContests\b/,
  /\bProblems\b/,
  /\bStudy Plans\b/i,
  /\bAchievements\b/,
  /\bSubmissions\b/,
  /\bBookmarks\b/,
  /\bSearch\b/,
  /\bFilter\b/,
  /\bDifficulty\b/i,
  /\bCreate account\b/i,
  /\bGet started\b/i,
  /\bBrowse problems\b/i,
  /\bMaybe later\b/i,
  /\bInstall LeetRank\b/i,
];

// English brand / proper-noun text we accept as legitimate inside VI pages.
const ALLOWLIST_EN_IN_VI = [
  /^LeetRank$/,
  /^Python$/i,
  /^TypeScript$/i,
  /^JavaScript$/i,
  /^Go$/i,
  /^Rust$/i,
  /^Java$/i,
  /^C\+\+$/i,
  /^Kotlin$/i,
  /^Easy$/, // difficulty pills sometimes intentionally bilingual
  /^Medium$/,
  /^Hard$/,
  /^[A-Z]{1,4}$/, // short codes (EN, VI, AC, WA, TLE, etc.)
  /^[\d.,%+\-:/\s]+$/, // pure numbers / punctuation
];

function looksLikeI18nKey(text: string): boolean {
  // Reject obvious matches: e.g. `achievements.title` rendered raw.
  // Filter common false-positives (file extensions, version numbers).
  if (/\.(png|jpe?g|svg|ts|tsx|md|json|html|css)$/i.test(text)) return false;
  if (/^\d+(\.\d+)+$/.test(text)) return false;
  return I18N_KEY_RX.test(text) && !/\s/.test(text.trim());
}

function isAllowlistedEnglish(text: string): boolean {
  const t = text.trim();
  return ALLOWLIST_EN_IN_VI.some((rx) => rx.test(t));
}

async function getActiveLocale(page: Page): Promise<Locale> {
  // The locale switcher trigger contains a span with uppercase "EN" or "VI".
  const code = await page
    .locator('[aria-label*="Switch language" i], [aria-label*="Đổi ngôn ngữ" i]')
    .first()
    .innerText()
    .catch(() => "");
  if (/VI/i.test(code) && !/EN/i.test(code.replace(/VI/i, ""))) return "vi";
  if (/EN/i.test(code)) return "en";
  // Fallback: read <html lang>.
  const htmlLang = await page.evaluate(() => document.documentElement.lang).catch(() => "");
  return htmlLang.startsWith("vi") ? "vi" : "en";
}

async function switchLocale(page: Page, target: Locale): Promise<boolean> {
  const trigger = page
    .locator('[aria-label*="Switch language" i], [aria-label*="Đổi ngôn ngữ" i]')
    .first();
  if (!(await trigger.count())) return false;
  await trigger.click({ trial: false }).catch(() => undefined);
  await page.waitForTimeout(200);

  const optionText = target === "vi" ? /^Tiếng Việt$/ : /^English$/;
  const option = page
    .locator('[role="menuitem"], [role="option"], button, a')
    .filter({ hasText: optionText })
    .first();
  if (!(await option.count())) {
    // Close popper before bailing.
    await page.keyboard.press("Escape").catch(() => undefined);
    return false;
  }
  await option.click().catch(() => undefined);
  // Server action revalidates; wait for navigation / hydration to settle.
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(800);
  return true;
}

async function captureLeaks(page: Page, route: string, locale: Locale): Promise<void> {
  // Sample headings, buttons, links, breadcrumbs, badges. We avoid
  // form `<input>` value text — placeholders are intentional EN sometimes.
  const samples = await page.evaluate(() => {
    function visible(el: Element): boolean {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el as HTMLElement);
      return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
    }
    const sel =
      "h1, h2, h3, button, a, [role='button'], [data-testid], nav li, nav span, label, summary";
    const out: { tag: string; text: string; aria?: string }[] = [];
    document.querySelectorAll(sel).forEach((el) => {
      if (!visible(el)) return;
      const text = ((el as HTMLElement).innerText ?? "").trim();
      if (!text || text.length > 200) return;
      out.push({
        tag: el.tagName.toLowerCase(),
        text,
        aria: (el as HTMLElement).getAttribute("aria-label") ?? undefined,
      });
    });
    return out.slice(0, 400); // cap to avoid pathological pages
  });

  for (const s of samples) {
    const text = s.text;

    // 1) Raw i18n key path leaked into the DOM.
    if (looksLikeI18nKey(text)) {
      pushLeak({
        route,
        locale,
        element: s.tag,
        staleText: text,
        severity: "MEDIUM",
      });
      continue;
    }

    if (locale === "vi") {
      // 2) VI active but element shows English-only stale label.
      if (!VIETNAMESE_DIACRITIC_RX.test(text) && !isAllowlistedEnglish(text)) {
        const stale = STALE_EN_PHRASES.find((rx) => rx.test(text));
        if (stale) {
          pushLeak({
            route,
            locale,
            element: s.tag,
            staleText: text,
            severity: "HIGH",
          });
          continue;
        }
        // 3) "Loading..." mixed inside otherwise-Vietnamese sentence (already
        //    covered above); also flag bare English sentences ≥3 words that
        //    aren't allowlisted.
        const wordish = text.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
        if (wordish.length >= 3 && !text.includes("@") && !text.match(/^https?:/)) {
          pushLeak({
            route,
            locale,
            element: s.tag,
            staleText: text,
            severity: "MEDIUM",
          });
        }
      }
    } else {
      // 4) EN active but VI diacritics surfaced.
      if (VIETNAMESE_DIACRITIC_RX.test(text)) {
        pushLeak({
          route,
          locale,
          element: s.tag,
          staleText: text,
          severity: "HIGH",
        });
      }
    }
  }
}

function attachConsoleWatcher(page: Page, route: string) {
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/MISSING_MESSAGE/i.test(text)) {
      pushLeak({
        route,
        locale: "vi", // best-effort; route-bound — actual locale captured elsewhere
        element: "console",
        staleText: text.slice(0, 200),
        severity: "MEDIUM",
      });
    }
  };
  page.on("console", onConsole);
}

test.describe.configure({ mode: "serial" });

test.describe("i18n consistency audit", () => {
  for (const route of ROUTES) {
    test(`route ${route}`, async ({ page }, testInfo) => {
      attachConsoleWatcher(page, route);

      // Visit at default (EN) locale first.
      const navResp = await page
        .goto(`${PROD_BASE_URL}${route}`, { waitUntil: "domcontentloaded" })
        .catch(() => null);
      const status = navResp?.status() ?? 0;
      if (status >= 400) {
        OTHER.push({
          area: route,
          detail: `HTTP ${status} on initial GET (skipped i18n audit)`,
          severity: "MEDIUM",
        });
        return;
      }
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

      // Force EN explicitly so subsequent runs are deterministic.
      const initialLocale = await getActiveLocale(page);
      if (initialLocale !== "en") {
        await switchLocale(page, "en").catch(() => undefined);
      }

      await captureLeaks(page, route, "en");
      await page.screenshot({
        path: testInfo.outputPath(`en-${route.replace(/[^a-z0-9]+/gi, "_") || "root"}.png`),
        fullPage: true,
      });

      // Switch to VI.
      const switched = await switchLocale(page, "vi");
      if (!switched) {
        OTHER.push({
          area: route,
          detail: "Locale switcher to VI not actionable on this route",
          severity: "MEDIUM",
        });
        return;
      }
      await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => undefined);
      await captureLeaks(page, route, "vi");
      await page.screenshot({
        path: testInfo.outputPath(`vi-${route.replace(/[^a-z0-9]+/gi, "_") || "root"}.png`),
        fullPage: true,
      });

      // Soft assert no leaks for this route — keeps the run going.
      const routeLeaks = LEAKS.filter((l) => l.route === route);
      expect.soft(routeLeaks, `i18n leaks on ${route}`).toEqual([]);
    });
  }

  test("/problems detail (read-only text)", async ({ page }, testInfo) => {
    attachConsoleWatcher(page, "/problems/[detail]");
    await page.goto(`${PROD_BASE_URL}/problems`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

    const first = page
      .locator('a[href^="/problems/"]')
      .filter({ hasNotText: /^(Easy|Medium|Hard)$/i })
      .first();
    if (!(await first.count())) {
      OTHER.push({
        area: "/problems/[detail]",
        detail: "No detail link on /problems list",
        severity: "LOW",
      });
      return;
    }
    await first.click().catch(() => undefined);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    const url = page.url();

    await captureLeaks(page, url, "en");
    if (await switchLocale(page, "vi")) {
      await captureLeaks(page, url, "vi");
    }
    await page.screenshot({
      path: testInfo.outputPath(`detail.png`),
      fullPage: true,
    });
  });
});

// ---------------------------------------------------------------------------
// PWA install-prompt dismissal audit.
//
// The component listens for `beforeinstallprompt`, which Chromium does not
// fire automatically in headless contexts. We dispatch a synthetic event with
// the same shape and verify:
//   (a) The banner appears.
//   (b) Clicking "Maybe later" hides it.
//   (c) After reload + dispatching the event again, the banner does NOT
//       reappear (component reads `leetrank.pwa.installDismissedAt` from
//       localStorage and respects a 7-day cooldown).
// ---------------------------------------------------------------------------
test.describe("PWA install prompt dismissal", () => {
  test("Maybe later persists across reloads", async ({ page }, testInfo) => {
    await page.goto(`${PROD_BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

    // Clear any prior dismissal so the first dispatch can render the banner.
    await page.evaluate(() => {
      try {
        localStorage.removeItem("leetrank.pwa.installDismissedAt");
      } catch {
        /* private mode — banner shows anyway */
      }
    });

    // Dispatch a synthetic beforeinstallprompt event with the shape the
    // component expects (prompt() + userChoice promise + preventDefault).
    const dispatched1 = await page.evaluate(() => {
      const ev = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
      };
      ev.prompt = async () => undefined;
      ev.userChoice = Promise.resolve({ outcome: "dismissed" as const });
      window.dispatchEvent(ev);
      return true;
    });

    if (!dispatched1) {
      PWA_OBSERVATIONS.push({
        behavior: "dispatch beforeinstallprompt",
        observation: "Synthetic dispatch failed",
        severity: "MEDIUM",
      });
      return;
    }

    const banner = page.getByRole("dialog", { name: /install LeetRank|Install/i });
    const appeared = await banner.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!appeared) {
      PWA_OBSERVATIONS.push({
        behavior: "first dispatch shows banner",
        observation:
          "Banner did NOT render after beforeinstallprompt — component may be gated by SW registration or absent in this build",
        severity: "MEDIUM",
      });
      await testInfo.attach("pwa-no-banner.png", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      return;
    }

    PWA_OBSERVATIONS.push({
      behavior: "first dispatch shows banner",
      observation: "Banner rendered as expected",
      severity: "LOW",
    });

    // Click "Maybe later".
    const maybeLater = page.getByRole("button", { name: /maybe later|later|not now/i }).first();
    await maybeLater.click().catch(() => undefined);
    await page.waitForTimeout(400);

    const stillVisible = await banner.isVisible({ timeout: 1_500 }).catch(() => false);
    PWA_OBSERVATIONS.push({
      behavior: "click 'Maybe later' hides banner",
      observation: stillVisible
        ? "Banner still visible after click — dismissal handler not wired"
        : "Banner hidden",
      severity: stillVisible ? "HIGH" : "LOW",
    });

    // Verify localStorage marker.
    const stored = await page.evaluate(() =>
      localStorage.getItem("leetrank.pwa.installDismissedAt")
    );
    PWA_OBSERVATIONS.push({
      behavior: "dismissal persisted to localStorage",
      observation: stored
        ? `Stored timestamp: ${stored}`
        : "No localStorage entry — popup will re-appear next session",
      severity: stored ? "LOW" : "HIGH",
    });

    // Reload and re-dispatch.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

    await page.evaluate(() => {
      const ev = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
      };
      ev.prompt = async () => undefined;
      ev.userChoice = Promise.resolve({ outcome: "dismissed" as const });
      window.dispatchEvent(ev);
    });
    await page.waitForTimeout(800);

    const reappeared = await page
      .getByRole("dialog", { name: /install/i })
      .isVisible({ timeout: 1_500 })
      .catch(() => false);
    PWA_OBSERVATIONS.push({
      behavior: "popup reappears after reload",
      observation: reappeared
        ? "Popup REAPPEARED after reload — 'Maybe later' did NOT suppress future prompts (matches user's report)"
        : "Popup correctly suppressed for cooldown window",
      severity: reappeared ? "HIGH" : "LOW",
    });

    await testInfo.attach("pwa-final.png", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    // Soft assertion.
    expect.soft(reappeared, "popup must NOT reappear after Maybe later").toBe(false);
  });
});

test.afterAll(() => {
  console.log("\n=== I18N LEAKS ===");
  if (LEAKS.length === 0) {
    console.log("(none)");
  } else {
    for (const l of LEAKS) {
      console.log(
        `  | ${l.route} | ${l.locale.toUpperCase()} | ${l.element} | "${l.staleText.replace(/\n/g, " ").slice(0, 90)}" | ${l.severity} |`
      );
    }
  }

  console.log("\n=== PWA INSTALL POPUP ===");
  for (const p of PWA_OBSERVATIONS) {
    console.log(`  | ${p.behavior} | ${p.observation} | ${p.severity} |`);
  }

  console.log("\n=== OTHER ===");
  for (const o of OTHER) {
    console.log(`  | ${o.area} | ${o.detail} | ${o.severity} |`);
  }
});
