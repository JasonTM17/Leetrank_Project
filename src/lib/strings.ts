// Tiny pure utilities. No React, no Node-specific APIs — testable in isolation.

/**
 * Convert a free-form title into a URL-safe slug. Strips diacritics,
 * lowercases, replaces non-alphanumeric runs with single dashes, and trims
 * leading/trailing dashes.
 *
 *   slugify("Two Sum!")          === "two-sum"
 *   slugify("Café résumé")       === "cafe-resume"
 *   slugify("  --hello world--") === "hello-world"
 *   slugify("a/b\\c")            === "a-b-c"
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

/**
 * Truncate at a word boundary when possible, otherwise at the hard cap.
 * Appends an ellipsis on truncation so callers don't have to.
 */
export function truncate(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input;
  const slice = input.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxLen * 0.7 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd() + "…";
}

/**
 * Pluralise a word based on count using English rules. Optional irregular
 * plural form for cases the +s rule doesn't cover.
 *
 *   pluralize(0, "problem")        === "0 problems"
 *   pluralize(1, "problem")        === "1 problem"
 *   pluralize(3, "submission")     === "3 submissions"
 *   pluralize(2, "person", "people") === "2 people"
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return `${count} ${singular}`;
  return `${count} ${plural ?? singular + "s"}`;
}
