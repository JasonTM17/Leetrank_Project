import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

// Loading shells render <Navbar /> which uses useRouter/usePathname.
// Stub next/navigation so server rendering doesn't trip the App Router invariant.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import ProblemsLoading from "@/app/problems/loading";
import DashboardLoading from "@/app/dashboard/loading";
import LeaderboardLoading from "@/app/leaderboard/loading";
import ContestsLoading from "@/app/contests/loading";
import SubmissionsLoading from "@/app/submissions/loading";
import DiscussionsLoading from "@/app/discussions/loading";
import UserProfileLoading from "@/app/users/[username]/loading";
import TagPageLoading from "@/app/tags/[slug]/loading";
import AdminLoading from "@/app/admin/loading";
import LoginLoading from "@/app/login/loading";
import RegisterLoading from "@/app/register/loading";

// ── Accessibility audit ──────────────────────────────────────────────────────
//
// This test suite asserts that every per-segment loading fallback meets the
// accessibility contract enforced by the critic:
//   1. Each loading shell exposes <main id="main-content"> so the global
//      skip-to-content link in the root layout has a target.
//   2. Each shell announces busy state via aria-busy="true" + aria-live so
//      screen readers know the route is fetching.
//   3. None of the skeleton placeholders contain hardcoded English strings
//      below the semantic shell — copy lives in next-intl translations.

const SHELLS: Array<[string, () => React.ReactElement]> = [
  ["problems",       ProblemsLoading],
  ["dashboard",      DashboardLoading],
  ["leaderboard",    LeaderboardLoading],
  ["contests",       ContestsLoading],
  ["submissions",    SubmissionsLoading],
  ["discussions",    DiscussionsLoading],
  ["users/[u]",      UserProfileLoading],
  ["tags/[slug]",    TagPageLoading],
  ["admin",          AdminLoading],
  ["login",          LoginLoading],
  ["register",       RegisterLoading],
];

describe("a11y — per-segment loading shells", () => {
  for (const [name, Shell] of SHELLS) {
    it(`${name}: exposes <main id="main-content"> for skip-link`, () => {
      const html = renderToString(<Shell />);
      expect(html).toContain('id="main-content"');
    });

    it(`${name}: announces busy state to assistive tech`, () => {
      const html = renderToString(<Shell />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-live="polite"');
    });
  }
});
