import { test, expect, devices, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * Manual UX pass against the local dev server.
 *
 * Unlike the smoke specs (which only check HTTP 200 + body length),
 * this spec drives real user interactions: clicks the CTA, opens the language
 * switcher, toggles theme, opens a problem, etc. Failures are logged with a
 * severity classification (BLOCKER / HIGH / MEDIUM / LOW) and screenshots are
 * captured under test-results/manual-ux-pass-*.
 *
 * Run desktop:
 *   pnpm exec playwright test manual-ux-pass.spec.ts --project=chromium-desktop
 *
 * The mobile pass is folded into this same spec file, but uses a fresh context
 * with iPhone 13 device descriptors (so we can run it under chromium-desktop
 * project without spawning the real WebKit engine — which has a known RSC
 * cross-origin block on Windows).
 */

const PROD_BASE_URL = process.env.E2E_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

type Severity = "BLOCKER" | "HIGH" | "MEDIUM" | "LOW";

interface UxIssue {
  severity: Severity;
  area: string;
  detail: string;
  url?: string;
}

const ISSUES: UxIssue[] = [];

function logIssue(issue: UxIssue) {
  ISSUES.push(issue);

  console.log(
    `[${issue.severity}] ${issue.area} :: ${issue.detail}${issue.url ? ` (${issue.url})` : ""}`
  );
}

// Console patterns we don't classify as defects (placeholder DB on prod, etc.).
const IGNORED_CONSOLE: RegExp[] = [
  /Failed to load resource: the server responded with a status of (4\d\d|5\d\d)/i,
  /favicon\.ico/i,
  /manifest\.json/i,
  /\/api\/health/i,
  /MISSING_MESSAGE/i, // tracked separately by ICU spec
  /ChunkLoadError/i,
];

function attachConsoleWatchdog(page: Page, area: string) {
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((rx) => rx.test(text))) return;
    logIssue({
      severity: "MEDIUM",
      area,
      detail: `console.error: ${text.slice(0, 200)}`,
      url: page.url(),
    });
  };
  const onPageError = (err: Error) => {
    logIssue({
      severity: "BLOCKER",
      area,
      detail: `pageerror: ${err.message.slice(0, 200)}`,
      url: page.url(),
    });
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
}

async function expectNoHorizontalScroll(page: Page, area: string) {
  const overflow = await page.evaluate(() => {
    const b = document.body;
    return b ? b.scrollWidth - b.clientWidth : 0;
  });
  if (overflow > 1) {
    logIssue({
      severity: "MEDIUM",
      area,
      detail: `horizontal overflow ${overflow}px at ${page.viewportSize()?.width}px viewport`,
      url: page.url(),
    });
  }
}

async function expectVisibleBody(page: Page, area: string) {
  const len = await page.evaluate(() => (document.body?.innerText ?? "").trim().length);
  if (len < 20) {
    logIssue({
      severity: "BLOCKER",
      area,
      detail: `white screen (body text length ${len})`,
      url: page.url(),
    });
  }
}

test.describe.configure({ mode: "serial" });

test.describe("manual UX pass — desktop chromium", () => {
  // Skip non-chromium-desktop projects. Mobile is simulated via emulated context below.
  test.skip(({ browserName }) => browserName !== "chromium", "Run on chromium only");

  test("a) homepage hero + primary CTA reaches register", async ({ page }, testInfo) => {
    attachConsoleWatchdog(page, "home");
    await page.goto(`${PROD_BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

    await expectVisibleBody(page, "home");
    await expectNoHorizontalScroll(page, "home");

    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect.soft(h1, "hero h1 visible").toBeVisible({ timeout: 8_000 });

    // Look for any link that takes us to /register or /signup. The brief notes
    // /signup is not a real route — the canonical path is /register. We accept
    // either "Get started" / "Sign up" / "Register" CTAs.
    const cta = page
      .locator('a[href*="/register"], a[href*="/signup"]')
      .filter({ hasText: /get started|sign up|register|create account/i })
      .first();

    if (await cta.count()) {
      await cta.scrollIntoViewIfNeeded();
      await cta.click();
      await page.waitForLoadState("domcontentloaded");
      const url = page.url();
      if (!/\/register(\?|$|\/)/.test(url)) {
        logIssue({
          severity: "HIGH",
          area: "home/cta",
          detail: `Primary CTA did not land on /register, landed on ${url}`,
        });
      }
      // Register form should expose at least an email + password input.
      const emailInput = page.locator('input[type="email"], input[name*="mail" i]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      await expect.soft(emailInput, "register email input").toBeVisible({ timeout: 5_000 });
      await expect.soft(passwordInput, "register password input").toBeVisible({ timeout: 5_000 });
    } else {
      logIssue({
        severity: "MEDIUM",
        area: "home/cta",
        detail: "No register/signup CTA found in hero",
      });
    }

    await testInfo.attach("home.png", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });

  test("b) /problems list filters by difficulty + opens a problem", async ({ page }, testInfo) => {
    attachConsoleWatchdog(page, "problems");
    await page.goto(`${PROD_BASE_URL}/problems`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

    await expectVisibleBody(page, "problems");
    await expectNoHorizontalScroll(page, "problems");

    // Difficulty filter — accept select, button, or radio.
    const filterCandidates = page
      .locator('button, [role="button"], [role="tab"], a')
      .filter({ hasText: /^(easy|medium|hard)$/i });
    const filterCount = await filterCandidates.count();
    if (filterCount === 0) {
      logIssue({
        severity: "MEDIUM",
        area: "problems/filter",
        detail: "No difficulty filter chips/buttons visible",
      });
    } else {
      const easy = filterCandidates.filter({ hasText: /easy/i }).first();
      if (await easy.count()) {
        await easy.click().catch(() => undefined);
        await page.waitForTimeout(500);
      }
    }

    // Open the first problem detail link if present.
    const first = page
      .locator('a[href^="/problems/"]')
      .filter({ hasNotText: /^(easy|medium|hard)$/i })
      .first();
    if (await first.count()) {
      const href = await first.getAttribute("href");
      await first.click();
      await page.waitForLoadState("domcontentloaded");
      const url = page.url();
      if (!url.includes("/problems/")) {
        logIssue({
          severity: "HIGH",
          area: "problems/click",
          detail: `Problem link did not navigate (${href} -> ${url})`,
        });
      } else {
        // Editor surface should appear within ~10s. Accept Monaco textarea OR
        // the .monaco-editor container OR a fallback <textarea>.
        const editor = page
          .locator('.monaco-editor, textarea[aria-label*="editor" i], textarea')
          .first();
        const editorVisible = await editor.isVisible({ timeout: 10_000 }).catch(() => false);
        if (!editorVisible) {
          logIssue({
            severity: "HIGH",
            area: "problem/editor",
            detail: "Code editor did not appear on detail page",
          });
        } else {
          // Soft-test Ctrl+Enter shortcut by focusing the editor and pressing it.
          await editor.click().catch(() => undefined);
          await page.keyboard.press("Control+Enter");
          await page.waitForTimeout(800);
        }
      }
    } else {
      logIssue({
        severity: "LOW",
        area: "problems/list",
        detail: "No problem links on /problems (placeholder DB on prod is expected)",
      });
    }

    await testInfo.attach("problems.png", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });

  test("c) /leaderboard renders + sort control responds", async ({ page }, testInfo) => {
    attachConsoleWatchdog(page, "leaderboard");
    await page.goto(`${PROD_BASE_URL}/leaderboard`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

    await expectVisibleBody(page, "leaderboard");
    await expectNoHorizontalScroll(page, "leaderboard");

    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect.soft(h1).toBeVisible({ timeout: 5_000 });

    const sortControls = page
      .locator('button, [role="button"], select, [role="combobox"]')
      .filter({ hasText: /sort|rank|score|rating|points|weekly|monthly|all.?time/i });
    if ((await sortControls.count()) === 0) {
      logIssue({
        severity: "LOW",
        area: "leaderboard/sort",
        detail: "No visible sort/period control on leaderboard",
      });
    }

    await testInfo.attach("leaderboard.png", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });

  test("d) /contests renders", async ({ page }, testInfo) => {
    attachConsoleWatchdog(page, "contests");
    await page.goto(`${PROD_BASE_URL}/contests`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

    await expectVisibleBody(page, "contests");
    await expectNoHorizontalScroll(page, "contests");

    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect.soft(h1).toBeVisible({ timeout: 5_000 });

    await testInfo.attach("contests.png", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });

  test("e) language switcher vi <-> en flips visible copy", async ({ page }) => {
    attachConsoleWatchdog(page, "i18n");
    await page.goto(`${PROD_BASE_URL}/`, { waitUntil: "domcontentloaded" });

    // Pick something likely-translated near the top — the hero h1 text.
    const h1 = page.getByRole("heading", { level: 1 }).first();
    const before = (await h1.textContent().catch(() => null))?.trim() ?? "";

    // Open lang switcher; accept several patterns (button labelled VI/EN, language icon, dropdown).
    const langTrigger = page
      .locator('button, [role="button"]')
      .filter({ hasText: /^(EN|VI|English|Tiếng Việt|Vietnamese|Language)$/i })
      .first();

    if (!(await langTrigger.count())) {
      logIssue({
        severity: "MEDIUM",
        area: "i18n/switcher",
        detail: "Language switcher trigger not discoverable",
      });
      return;
    }

    await langTrigger.click().catch(() => undefined);
    await page.waitForTimeout(400);

    // Click the "other" locale option.
    const otherOption = page
      .locator('[role="option"], [role="menuitem"], button, a')
      .filter({ hasText: /^(English|Vietnamese|Tiếng Việt|EN|VI)$/i })
      .first();
    if (await otherOption.count()) {
      await otherOption.click().catch(() => undefined);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(800);
      const after = (await h1.textContent().catch(() => null))?.trim() ?? "";
      if (before && after && before === after) {
        logIssue({
          severity: "MEDIUM",
          area: "i18n/switcher",
          detail: `Hero copy did not change after locale flip ("${before}")`,
        });
      }
    } else {
      logIssue({
        severity: "MEDIUM",
        area: "i18n/switcher",
        detail: "Language switcher opened but no alternate locale option found",
      });
    }
  });

  test("f) theme toggle light <-> dark flips html.class", async ({ page }) => {
    attachConsoleWatchdog(page, "theme");
    await page.goto(`${PROD_BASE_URL}/`, { waitUntil: "domcontentloaded" });

    const before = await page.evaluate(() => document.documentElement.className);

    const themeBtn = page
      .locator('button, [role="button"]')
      .filter({ hasText: /theme|dark|light/i })
      .first();

    if (!(await themeBtn.count())) {
      // Many designs hide the toggle behind an icon — accept aria-label too.
      const iconBtn = page
        .locator(
          'button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="light" i]'
        )
        .first();
      if (!(await iconBtn.count())) {
        logIssue({
          severity: "LOW",
          area: "theme/toggle",
          detail: "Theme toggle button not discoverable",
        });
        return;
      }
      await iconBtn.click().catch(() => undefined);
    } else {
      await themeBtn.click().catch(() => undefined);
    }

    // Some dropdown variants need a second click on "Dark" / "Light" item.
    const themeOption = page
      .locator('[role="menuitem"], [role="option"], button')
      .filter({ hasText: /^(Light|Dark|System)$/i })
      .first();
    if (await themeOption.count()) {
      await themeOption.click().catch(() => undefined);
    }
    await page.waitForTimeout(400);

    const after = await page.evaluate(() => document.documentElement.className);
    if (before === after) {
      logIssue({
        severity: "MEDIUM",
        area: "theme/toggle",
        detail: `html class did not change after toggle ("${before}")`,
      });
    }
  });
});

test.describe("manual UX pass — emulated mobile (iPhone 13)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Run on chromium only");

  test("mobile: home + problems + leaderboard + hamburger", async ({ browser }, testInfo) => {
    // Build a fresh context with iPhone 13 emulation rather than test.use()
    // (test.use inside describe forces a worker swap and is rejected by the
    // Playwright runner). This keeps the mobile pass on the chromium engine
    // — WebKit on Windows is excluded per the brief.
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await context.newPage();
    attachConsoleWatchdog(page, "mobile");

    for (const path of ["/", "/problems", "/leaderboard", "/contests"]) {
      await page.goto(`${PROD_BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
      await expectVisibleBody(page, `mobile${path}`);
      await expectNoHorizontalScroll(page, `mobile${path}`);
    }

    await page.goto(`${PROD_BASE_URL}/`, { waitUntil: "domcontentloaded" });

    // Hamburger menu — accept aria-label "menu", "navigation", or visible icon.
    const hamburger = page
      .locator(
        'button[aria-label*="menu" i], button[aria-label*="navigation" i], button[aria-controls*="menu" i]'
      )
      .first();
    if (!(await hamburger.count())) {
      logIssue({
        severity: "HIGH",
        area: "mobile/nav",
        detail: "Hamburger trigger not discoverable on mobile viewport",
      });
    } else {
      await hamburger.click().catch(() => undefined);
      await page.waitForTimeout(500);
      // Drawer or sheet should expose nav links to /problems, /leaderboard, /contests.
      const drawerLink = page
        .locator('a[href="/problems"], a[href="/leaderboard"], a[href="/contests"]')
        .first();
      const drawerVisible = await drawerLink.isVisible({ timeout: 3_000 }).catch(() => false);
      if (!drawerVisible) {
        logIssue({
          severity: "HIGH",
          area: "mobile/nav",
          detail: "Hamburger opened but no nav links visible",
        });
      }
    }

    // /profile and /settings on mobile — flagged in handoff as "404 on mobile only".
    for (const path of ["/profile", "/settings"]) {
      const res = await page
        .goto(`${PROD_BASE_URL}${path}`, { waitUntil: "domcontentloaded" })
        .catch(() => null);
      const status = res?.status();
      if (status && status >= 400) {
        logIssue({
          severity: "HIGH",
          area: `mobile${path}`,
          detail: `HTTP ${status} on mobile viewport (handoff defect #5)`,
          url: page.url(),
        });
      }
      await expectNoHorizontalScroll(page, `mobile${path}`);
    }

    await testInfo.attach("mobile-home.png", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });

  test.afterAll(async () => {
    if (ISSUES.length === 0) {
      console.log("\n=== UX PASS SUMMARY: zero issues observed ===");
      return;
    }
    const buckets: Record<Severity, UxIssue[]> = { BLOCKER: [], HIGH: [], MEDIUM: [], LOW: [] };
    for (const i of ISSUES) buckets[i.severity].push(i);

    console.log("\n=== UX PASS SUMMARY ===");
    for (const sev of ["BLOCKER", "HIGH", "MEDIUM", "LOW"] as Severity[]) {
      console.log(`${sev}: ${buckets[sev].length}`);
      for (const i of buckets[sev]) {
        console.log(`  - [${i.area}] ${i.detail}${i.url ? ` (${i.url})` : ""}`);
      }
    }
  });
});
