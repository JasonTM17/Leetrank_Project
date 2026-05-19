"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Compact locale switcher for the navbar. Server-action commits the choice
// to a cookie + revalidates so server components re-render with new strings.
export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const [pending, startTransition] = useTransition();

  function pick(next: "en" | "vi") {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
    });
  }

  const trigger = (
    <span
      className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-2 py-1.5 text-sm hover:border-primary/30 hover:bg-accent motion-safe:transition-all duration-200"
      aria-label={t("switchLanguage")}
    >
      <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="text-xs font-medium uppercase tracking-wide">
        {locale === "vi" ? "VI" : "EN"}
      </span>
    </span>
  );

  return (
    <DropdownMenu trigger={trigger} widthClass="w-44">
      <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => pick("en")}
        icon={
          <span className="text-xs font-mono text-muted-foreground">
            {locale === "en" ? "•" : " "}
          </span>
        }
      >
        {t("english")}
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => pick("vi")}
        icon={
          <span className="text-xs font-mono text-muted-foreground">
            {locale === "vi" ? "•" : " "}
          </span>
        }
      >
        {t("vietnamese")}
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
