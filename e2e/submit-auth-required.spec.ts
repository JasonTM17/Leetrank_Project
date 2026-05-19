import { test, expect } from "@playwright/test";

/**
 * Submit-auth-required UX — anonymous users must get a clear modal
 * with a "Sign in" CTA when they click Submit, NOT a generic
 * "Submission Error" toast or a silent 401.
 *
 * The flow has three phases:
 *   1. Anon visits /problems/<slug> and clicks Submit -> modal appears.
 *   2. The Sign in link inside the modal points at /login?from=...
 *      so the user can bounce back to the problem after authenticating.
 *   3. The modal Cancel/close path doesn't fire a network submission.
 *
 * We don't assert on a specific seeded slug because the test DB might
 * be empty in some environments — instead we discover the first
 * available problem link off /problems. If there's no problem on the
 * page (empty seed), we skip rather than fail because that's a
 * data-fixture problem, not a UX regression.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe("submit auth-required UX", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Run on chromium only");

  test("anon click on Submit opens the sign-in modal with from=<slug>", async ({
    page,
    context,
  }) => {
    // Make sure we're truly anonymous. Wipe cookies just in case a
    // previous test in the same project left a session behind.
    await context.clearCookies();

    await page.goto(`${BASE_URL}/problems`);

    // Find the first problem link — robust against empty seed.
    const firstLink = page.locator('a[href^="/problems/"]').first();
    const count = await firstLink.count();
    test.skip(count === 0, "No problems seeded — fixture issue, not a UX bug");

    const href = (await firstLink.getAttribute("href")) ?? "";
    const slug = href.replace("/problems/", "");
    expect(slug.length).toBeGreaterThan(0);

    await firstLink.click();
    await expect(page).toHaveURL(new RegExp(`/problems/${slug}$`));

    // Submit button is rendered for anon users too — but clicking it
    // must surface the modal, not a network call.
    const submitBtn = page.getByRole("button", { name: /sign in to submit solution|submit solution/i }).first();
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Modal headline + description must be visible.
    await expect(page.getByRole("heading", { name: /sign in to submit/i })).toBeVisible();
    await expect(
      page.getByText(/track your progress|climb the leaderboard|join contests/i)
    ).toBeVisible();

    // CTAs link to /login?from=/problems/<slug> and /register.
    const signInCta = page.getByRole("link", { name: /^sign in$/i }).first();
    await expect(signInCta).toBeVisible();
    const loginHref = await signInCta.getAttribute("href");
    expect(loginHref).toBe(`/login?from=/problems/${slug}`);

    const registerCta = page.getByRole("link", { name: /create account/i }).first();
    await expect(registerCta).toBeVisible();
    expect(await registerCta.getAttribute("href")).toBe("/register");
  });

  test("clicking Sign in lands on /login with the from param preserved", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto(`${BASE_URL}/problems`);
    const firstLink = page.locator('a[href^="/problems/"]').first();
    const count = await firstLink.count();
    test.skip(count === 0, "No problems seeded");

    const href = (await firstLink.getAttribute("href")) ?? "";
    const slug = href.replace("/problems/", "");
    await firstLink.click();
    await expect(page).toHaveURL(new RegExp(`/problems/${slug}$`));

    const submitBtn = page
      .getByRole("button", { name: /sign in to submit solution|submit solution/i })
      .first();
    await submitBtn.click();

    const signInCta = page.getByRole("link", { name: /^sign in$/i }).first();
    await signInCta.click();

    // The login page must have ?from=/problems/<slug> so post-login
    // redirect can return the user to the problem.
    await expect(page).toHaveURL(new RegExp(`/login\\?from=/problems/${slug}$`));
  });

  test("submit while anon does NOT POST /api/submissions", async ({ page, context }) => {
    await context.clearCookies();

    await page.goto(`${BASE_URL}/problems`);
    const firstLink = page.locator('a[href^="/problems/"]').first();
    const count = await firstLink.count();
    test.skip(count === 0, "No problems seeded");
    await firstLink.click();

    // Watch for any POST to /api/submissions — the modal path must
    // never fire one. We resolve the promise either way so the test
    // doesn't hang forever; a `null` POST = pass.
    let postFired = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/submissions") && req.method() === "POST") {
        postFired = true;
      }
    });

    const submitBtn = page
      .getByRole("button", { name: /sign in to submit solution|submit solution/i })
      .first();
    await submitBtn.click();

    // Modal opening is enough confirmation; give the page a tick to
    // catch any rogue fetch.
    await expect(page.getByRole("heading", { name: /sign in to submit/i })).toBeVisible();
    await page.waitForTimeout(400);
    expect(postFired).toBe(false);
  });
});
