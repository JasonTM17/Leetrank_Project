"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Sheet } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { User, LogOut, Shield, Bookmark, ListChecks, Settings as SettingsIcon, Menu, Search, Activity } from "lucide-react";
import { useEffect, useState, startTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

export function Navbar() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const { user, setUser, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user || null))
      .catch(() => setUser(null));
  }, [setUser]);

  useEffect(() => {
    startTransition(() => {
      setMobileOpen(false);
    });
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  const navLinks = [
    { href: "/problems", label: t("problems") },
    { href: "/leaderboard", label: t("leaderboard") },
    { href: "/contests", label: t("contests") },
  ];

  const userMenuTrigger = user ? (
    <span className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-1 py-1 pr-3 hover:border-primary/30 hover:bg-accent motion-safe:transition-all duration-200">
      <span className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
        <User className="h-3.5 w-3.5 text-primary" />
      </span>
      <span className="text-sm font-medium">{user.username}</span>
    </span>
  ) : null;

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Left: logo + nav links */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl select-none">
              {/* Typographic mark — 4px primary square */}
              <span className="h-[14px] w-1 rounded-sm bg-primary shrink-0" aria-hidden="true" />
              <span>
                <span className="text-foreground">Leet</span>
                <span className="gradient-text">Rank</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative px-3 py-2 text-sm font-medium motion-safe:transition-all duration-200 rounded-md hover:text-foreground hover:bg-accent/50 ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {link.label}
                    {/* Active underline indicator */}
                    <span
                      className={`absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary motion-safe:transition-all duration-200 ${
                        isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                      }`}
                      style={{ transformOrigin: "left" }}
                      aria-hidden="true"
                    />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: search hint + theme + user */}
          <div className="hidden md:flex items-center gap-2">
            {/* Search trigger — opens the global command palette */}
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true }),
                );
              }}
              title={`${t("openCommandPalette")} (⌘K)`}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/30 hover:bg-muted/60 motion-safe:transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("openCommandPalette")}
            >
              <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline text-xs">{tc("searchHint")}</span>
              <kbd className="ml-1 hidden lg:inline-flex items-center gap-0.5 rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70">
                ⌘K
              </kbd>
            </button>

            <ThemeToggle />
            <LocaleSwitcher />

            {user ? (
              <DropdownMenu trigger={userMenuTrigger} widthClass="w-52">
                <DropdownMenuLabel>{user.email ?? user.username}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem href="/dashboard" icon={<User className="h-4 w-4" />}>
                  {t("dashboard")}
                </DropdownMenuItem>
                <DropdownMenuItem href="/submissions" icon={<ListChecks className="h-4 w-4" />}>
                  {t("submissions")}
                </DropdownMenuItem>
                <DropdownMenuItem href="/dashboard/bookmarks" icon={<Bookmark className="h-4 w-4" />}>
                  {t("bookmarks")}
                </DropdownMenuItem>
                <DropdownMenuItem href="/dashboard/settings" icon={<SettingsIcon className="h-4 w-4" />}>
                  {t("settings")}
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem href="/admin" icon={<Shield className="h-4 w-4" />}>
                      {t("admin")}
                    </DropdownMenuItem>
                    <DropdownMenuItem href="/admin/devops" icon={<Activity className="h-4 w-4" />}>
                      DevOps
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleLogout}
                  icon={<LogOut className="h-4 w-4" />}
                >
                  <span className="text-destructive">{t("logout")}</span>
                </DropdownMenuItem>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">{t("login")}</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="shadow-glow/50">{t("signup")}</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground motion-safe:transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label={t("openMenu")}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile Sheet */}
      <Sheet
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        side="left"
        size="sm"
        title={t("navigation")}
      >
        <div className="flex flex-col gap-1">
          {/* Logo in sheet */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-4 select-none">
            <span className="h-[12px] w-1 rounded-sm bg-primary shrink-0" aria-hidden="true" />
            <span>
              <span className="text-foreground">Leet</span>
              <span className="gradient-text">Rank</span>
            </span>
          </Link>

          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium motion-safe:transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
                )}
                {link.label}
              </Link>
            );
          })}

          <div className="my-3 h-px bg-border" />

          {user ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground">
                <span className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 text-primary" />
                </span>
                {user.username}
              </div>
              <Link href="/dashboard" className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground motion-safe:transition-colors">
                <User className="h-4 w-4" /> {t("dashboard")}
              </Link>
              <Link href="/submissions" className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground motion-safe:transition-colors">
                <ListChecks className="h-4 w-4" /> {t("submissions")}
              </Link>
              {user.role === "admin" && (
                <>
                  <Link href="/admin" className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground motion-safe:transition-colors">
                    <Shield className="h-4 w-4" /> {t("admin")}
                  </Link>
                  <Link href="/admin/devops" className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground motion-safe:transition-colors">
                    <Activity className="h-4 w-4" /> DevOps
                  </Link>
                </>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 motion-safe:transition-colors w-full text-left mt-1"
              >
                <LogOut className="h-4 w-4" /> {t("logout")}
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              <Link href="/login">
                <Button variant="outline" size="sm" className="w-full">{t("login")}</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="w-full shadow-glow/50">{t("signup")}</Button>
              </Link>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 px-1">
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </div>
      </Sheet>
    </nav>
  );
}
