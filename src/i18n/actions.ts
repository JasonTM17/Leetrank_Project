"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isSupportedLocale, type Locale } from "@/i18n/request";

// Server action invoked by the locale switcher. Persists the choice in a
// cookie so subsequent requests resolve the same locale via getRequestConfig.
export async function setLocale(next: string): Promise<{ ok: true; locale: Locale }> {
  if (!isSupportedLocale(next)) {
    throw new Error(`Unsupported locale: ${next}`);
  }
  const store = await cookies();
  store.set(LOCALE_COOKIE, next, {
    path: "/",
    sameSite: "lax",
    // ~1 year — locale preference is sticky and not security-sensitive
    maxAge: 60 * 60 * 24 * 365,
  });
  // Revalidate the root so server components re-render with new messages.
  revalidatePath("/", "layout");
  return { ok: true, locale: next };
}
