"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Code2, Menu, X, User, LogOut, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function Navbar() {
  const { user, setUser, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user || null))
      .catch(() => setUser(null));
  }, [setUser]);

  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: "/problems", label: "Problems" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/contests", label: "Contests" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <Code2 className="h-6 w-6 text-primary" />
              <span>LeetRank</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    pathname === link.href ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-full border p-1 pr-3 hover:bg-accent transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{user.username}</span>
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md border bg-card shadow-lg py-1 z-50">
                    <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent">
                      <User className="h-4 w-4" /> Dashboard
                    </Link>
                    {user.role === "admin" && (
                      <Link href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent">
                        <Shield className="h-4 w-4" /> Admin
                      </Link>
                    )}
                    <button
                      onClick={logout}
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent w-full text-left text-destructive"
                    >
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Sign up</Button>
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t bg-background px-4 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="block text-sm font-medium py-2">
              {link.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/dashboard" className="block text-sm font-medium py-2">Dashboard</Link>
              {user.role === "admin" && (
                <Link href="/admin" className="block text-sm font-medium py-2">Admin</Link>
              )}
              <button onClick={logout} className="block text-sm font-medium py-2 text-destructive">Logout</button>
            </>
          ) : (
            <div className="flex gap-2 pt-2">
              <Link href="/login"><Button variant="outline" size="sm">Log in</Button></Link>
              <Link href="/register"><Button size="sm">Sign up</Button></Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
