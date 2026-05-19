// next-intl request configuration. Reads the active locale from a cookie
// (Phase 1: cookie-based locale, no /[locale] route restructure yet — see ADR 0030).
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const SUPPORTED_LOCALES = ["en", "vi"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isSupportedLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "vi";
}

// Pick a sensible default from Accept-Language when no cookie is set.
// We only auto-pick Vietnamese; everything else falls back to English so
// users with unsupported locales still see the canonical strings.
function pickFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const lower = header.toLowerCase();
  if (lower.includes("vi")) return "vi";
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  const locale: Locale = isSupportedLocale(cookieLocale)
    ? cookieLocale
    : pickFromAcceptLanguage(headerStore.get("accept-language"));

  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});
