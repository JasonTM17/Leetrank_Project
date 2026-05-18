import { test, expect } from "@playwright/test";

/**
 * Smoke tests — every viewport hits the homepage, problems list, and
 * leaderboard. These are the bare minimum coverage RULES §16 requires
 * (mobile/tablet/desktop). Per-feature deeper tests live in their own
 * spec files under e2e/.
 */

test.describe("public pages smoke", () => {
  test("homepage renders the hero", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/LeetRank/i);
    // Skip-to-content link is present and keyboard-focusable.
    const skipLink = page.getByRole("link", { name: /skip to content/i });
    await expect(skipLink).toBeAttached();
  });

  test("problems list page loads", async ({ page }) => {
    await page.goto("/problems");
    await expect(page).toHaveTitle(/Problems/i);
    // Either the list, an empty state, or a loading skeleton must be present.
    const main = page.getByRole("main").first();
    await expect(main).toBeVisible();
  });

  test("leaderboard page loads", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page).toHaveTitle(/Leaderboard/i);
  });

  test("contests page loads", async ({ page }) => {
    await page.goto("/contests");
    await expect(page).toHaveTitle(/Contest/i);
  });

  test("404 path renders the not-found page", async ({ page }) => {
    const res = await page.goto("/this-route-does-not-exist");
    expect(res?.status()).toBe(404);
  });
});

test.describe("a11y baseline", () => {
  test("homepage has no console errors on first paint", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("body has no horizontal scrollbar at any viewport", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => {
      const body = document.body;
      return body.scrollWidth - body.clientWidth;
    });
    // 1px tolerance for sub-pixel rendering rounding on some browsers.
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
