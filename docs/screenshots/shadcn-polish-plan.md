# shadcn polish plan

Recommendations for the next round of UI polish — surfaced via the shadcn MCP
registry, scored against what LeetRank already ships and where the friction
shows up in the captured screenshots.

This is a **plan**, not an applied change. Install when ready.

## Already on board

LeetRank already uses these shadcn primitives (verified in
`packages/ui/src/components` and `src/components/ui`):

`accordion`, `alert`, `alert-dialog`, `avatar`, `badge`, `breadcrumb`,
`button`, `card`, `checkbox`, `collapsible`, `dialog`, `dropdown-menu`,
`form`, `input`, `label`, `progress`, `radio-group`, `scroll-area`,
`select`, `separator`, `skeleton`, `slider`, `switch`, `table`, `tabs`,
`textarea`, `tooltip`.

## High-impact additions

| Component | Why it matters here | Where to apply |
|-----------|---------------------|----------------|
| `sonner` | Modern, headless toast system. Replaces our hand-rolled `Toast` shim with a single global `<Toaster />`, slide-in animation, stacking, dismiss-by-swipe on mobile, and a tiny API. | Submission verdict toast, "Copied to clipboard" on solution links, "Bookmark saved" on problem detail, password-changed flow. |
| `hover-card` | Card-on-hover for richer link previews without a full click. | Hover a username in leaderboard / discussions to preview rating, country, top tags — no extra navigation. |
| `command` | Cmd+K palette (the navbar already shows `Search…  ⌘K` placeholder with no implementation). Pairs with `dialog`. | Global problem search, jump-to-route, "open contest #42", language switcher. |
| `sheet` | Slide-in drawer. Better than a centred modal for long-form auxiliary panels. | Mobile filter panel on `/problems`, "Submission detail" side-panel without leaving the page. |
| `drawer` (vaul) | Mobile-first bottom-sheet with momentum + snap points. | Mobile problem actions (Run, Submit, Reset, Bookmark) — frees the cramped editor toolbar at 375px width. |
| `navigation-menu` | Keyboard-accessible mega-nav with positioned subviews. | Top nav: collapse Problems / Contests / Leaderboard / Discussions into structured submenus instead of flat links. |

## Install command

When you decide to pull these in, run:

```bash
pnpm dlx shadcn@latest add @shadcn/sonner @shadcn/hover-card @shadcn/command @shadcn/sheet @shadcn/drawer @shadcn/navigation-menu
```

Resolved by `mcp__shadcn__get_add_command_for_items` against `@shadcn`.

## Suggested rollout order

1. **`sonner`** — replaces every ad-hoc toast in one PR. Lowest risk, highest
   visible polish. Wire `<Toaster richColors closeButton />` into
   `app/layout.tsx`, then refactor existing `useToast()` callers.
2. **`command`** — implements the `⌘K` placeholder already shown in the navbar
   ([navbar evidence](../screenshots/home.png)). Routes-only to start; layer
   in problem search later via the `apps/api` `/v1/search` endpoint.
3. **`hover-card`** — leaderboard usernames, problem-author bylines.
4. **`sheet` + `drawer`** — mobile-first refactor of `/problems` filters and
   the problem-detail action bar (the 375px capture in
   `docs/screenshots/mobile/problems.png` shows the bar is overcrowded).
5. **`navigation-menu`** — last, only if the navbar grows another tier.

## Out of scope (for now)

- `dashboard-01`, `sidebar-0X` blocks: the existing dashboard/admin layouts
  are already cohesive — adopting a block would be a rewrite, not a polish.
- `chart-*` blocks: rating timeline + activity heatmap already use Recharts
  directly with consistent tokens; no immediate gain.

## Acceptance checklist (when applied)

- [ ] `sonner` `<Toaster />` mounted exactly once at the layout root.
- [ ] `useToast()` shim removed; all callers migrated to `toast.success(...)` /
      `toast.error(...)` / `toast.promise(...)`.
- [ ] `⌘K` opens the command palette globally; `Esc` closes it.
- [ ] All new components inherit the gradient-text/bg-grid/animate-fade-in-up
      vocabulary the rest of the UI uses (see global UI rules in
      `feedback_ui_polish_vocabulary.md`).
- [ ] No `aria-hidden` regressions; tab order verified for the new palette.
- [ ] Screenshots refreshed under `docs/screenshots/` so the README stays
      current.
