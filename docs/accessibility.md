# Accessibility Statement

**Last reviewed:** 2026-05-18

---

## Our commitment

LeetRank aims to conform to **WCAG 2.1 Level AA**. We want the platform to be usable by everyone, including people who use assistive technologies such as screen readers, keyboard navigation, or high-contrast displays.

> Full WCAG 2.1 AA conformance requires manual testing with assistive technologies and expert accessibility review. The status below reflects our current best knowledge, not a formal audit result.

---

## What is working today

| Feature                    | Implementation                                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skip-to-content link       | Present in the root layout; allows keyboard users to bypass the navigation bar                                                                                                         |
| Keyboard navigation        | All interactive elements (buttons, links, form fields, dropdowns) are reachable and operable via keyboard                                                                              |
| Semantic HTML              | Headings, landmarks (`<main>`, `<nav>`, `<header>`, `<footer>`), lists, and buttons use the correct HTML elements                                                                      |
| Reduced motion             | The root layout includes a `prefers-reduced-motion` media query; animation utilities (`fade-in-up`, `pulse-soft`, `shimmer`) are suppressed when the user has requested reduced motion |
| Dark / light / system mode | Theme toggle is wired via `next-themes`; all colour tokens are defined for both modes                                                                                                  |
| Difficulty labels          | Difficulty pills use both a colour token and a text label (Easy / Medium / Hard) — colour is not the only indicator                                                                    |
| Focus rings                | Tailwind's `focus-visible` ring utilities are applied to interactive elements                                                                                                          |
| Form labels                | All form inputs have associated `<label>` elements or `aria-label` attributes                                                                                                          |
| Error messages             | Validation errors are associated with their input fields via `aria-describedby`                                                                                                        |

---

## Known gaps

| Gap                             | Notes                                                                                                                                                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No formal accessibility audit   | The platform has not been tested by an accessibility specialist or with real assistive technology users                                                                                                                                      |
| No automated a11y testing in CI | Lighthouse CI and axe-core are not yet integrated into the GitHub Actions pipeline                                                                                                                                                           |
| Monaco Editor                   | The code editor is provided by the Monaco Editor library. Its accessibility is the library's responsibility. Monaco has [known screen reader limitations](https://github.com/microsoft/monaco-editor/wiki/Monaco-Editor-Accessibility-Guide) |
| Complex data tables             | Leaderboard and submission history tables do not yet have `scope` attributes on header cells                                                                                                                                                 |
| Live regions                    | Judge verdict results are not announced via `aria-live` regions; screen reader users may not be notified when a verdict arrives                                                                                                              |

---

## How to report an accessibility issue

If you encounter a barrier, please let us know:

- **Email:** jasonbmt06@gmail.com — subject line "Accessibility issue: [brief description]"
- **GitHub Issue:** [github.com/JasonTM17/Leetrank_Project/issues](https://github.com/JasonTM17/Leetrank_Project/issues) — use the label `accessibility`

We aim to respond within 7 days and to address confirmed issues in the next available release.

---

## Standards and references

- [WCAG 2.1](https://www.w3.org/TR/WCAG21/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Monaco Editor Accessibility Guide](https://github.com/microsoft/monaco-editor/wiki/Monaco-Editor-Accessibility-Guide)

---

_LeetRank — a learning project by Nguyễn Sơn (jasonbmt06@gmail.com). Feedback and questions welcome via email or [GitHub Issues](https://github.com/JasonTM17/Leetrank_Project/issues)._
