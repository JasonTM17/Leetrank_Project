# 0010. Monaco Editor via next/dynamic with ssr:false

Date: 2026-05-17
Status: Accepted

## Context

LeetRank's problem-solving page (`src/app/problems/[slug]/page.tsx`) embeds a code editor. Monaco Editor (the editor that powers VS Code) was chosen for its syntax highlighting, language support, and familiar UX.

The `@monaco-editor/react` package (v4.7, see `package.json`) bundles Monaco's core, which is approximately 2 MB of JavaScript. This creates two problems in a Next.js App Router context:

1. **SSR incompatibility.** Monaco accesses browser-only globals (`window`, `document`, Web Workers) during module initialisation. Importing it in a Server Component or during server-side rendering throws a `ReferenceError`.

2. **Bundle size.** Including 2 MB of editor code in the initial page bundle delays Time to Interactive for all users, including those who never reach the problem page.

## Decision

Import Monaco using **`next/dynamic` with `{ ssr: false }`** in `src/app/problems/[slug]/page.tsx`:

```ts
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
```

This defers the Monaco bundle to a separate chunk that is only downloaded when the problem page is rendered in the browser. The component is excluded from the server render entirely, avoiding the `window` reference error.

The problem page is already a Client Component (`"use client"` directive), so `next/dynamic` is the correct code-splitting primitive here.

## Consequences

- **Easier:** No SSR errors from Monaco's browser globals. The initial JS bundle for other pages is unaffected by the 2 MB Monaco chunk.
- **Harder:** There is a brief flash while Monaco loads on first visit to a problem page. A loading skeleton or spinner should be shown during this window (currently the editor area is empty until Monaco hydrates).
- **Risk:** Monaco spawns Web Workers for language services. In some environments (strict CSP, sandboxed iframes) these workers may be blocked. The `options` prop passed to `MonacoEditor` disables the minimap and other heavy features to reduce worker load.

## Alternatives considered

- **Static import** — causes SSR `ReferenceError` and bloats the initial bundle. Rejected.
- **CodeMirror 6** — lighter (~500 KB), SSR-safe, but lacks the VS Code-familiar UX and the breadth of language support that Monaco provides out of the box.
- **Ace Editor** — older, less actively maintained than Monaco. Rejected.
- **`<textarea>` with syntax highlighting library** — minimal bundle but poor editing experience (no autocomplete, no bracket matching). Rejected.
