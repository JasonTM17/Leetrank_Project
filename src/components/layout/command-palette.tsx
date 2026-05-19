"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search,
  X,
  ArrowRight,
  Home,
  BookOpen,
  Trophy,
  Calendar,
  ListChecks,
  Bookmark,
  Settings as SettingsIcon,
  User as UserIcon,
  Activity,
  Shield,
  Sun,
  Moon,
  Monitor,
  CornerDownLeft,
  FileJson,
  CornerUpLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// ── Types ─────────────────────────────────────────────────────────────────────

type CommandIcon = React.ComponentType<{ className?: string }>;

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: CommandIcon;
  group: "Navigation" | "Account" | "Theme" | "Problems" | "Admin";
  /** Run on Enter / click. Return false to keep palette open. */
  run: () => void | boolean;
  /** Optional keywords for fuzzier matching. */
  keywords?: string;
}

interface ProblemHit {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
}

const DIFFICULTY_DOT: Record<string, string> = {
  easy: "bg-easy",
  medium: "bg-medium",
  hard: "bg-hard",
};

// ── Hook: keyboard shortcut handler ───────────────────────────────────────────

function useCmdK(onOpen: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onOpen();
      }
      // Forward-slash also opens, like GitHub
      if (e.key === "/" && !isMod) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable) return;
        e.preventDefault();
        onOpen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}

// ── Palette ───────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<ProblemHit[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    setHits([]);
  }, []);

  useCmdK(() => setOpen((v) => !v));

  // Focus input on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Lock background scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Debounced problem search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHits([]);
      return;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/problems?search=${encodeURIComponent(q)}&limit=8`)
        .then((r) => (r.ok ? r.json() : { problems: [] }))
        .then((data) => {
          if (!cancelled) setHits((data.problems ?? []).slice(0, 8));
        })
        .catch(() => !cancelled && setHits([]))
        .finally(() => !cancelled && setSearching(false));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  // Build flat command list
  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      { id: "nav-home", group: "Navigation", icon: Home, label: "Go to Home", keywords: "/ landing", run: () => router.push("/") },
      { id: "nav-problems", group: "Navigation", icon: BookOpen, label: "Browse Problems", keywords: "exercises practice", run: () => router.push("/problems") },
      { id: "nav-contests", group: "Navigation", icon: Trophy, label: "View Contests", keywords: "compete tournament", run: () => router.push("/contests") },
      { id: "nav-leaderboard", group: "Navigation", icon: Calendar, label: "Open Leaderboard", keywords: "ranking top", run: () => router.push("/leaderboard") },
      { id: "nav-status", group: "Navigation", icon: Activity, label: "System Status", keywords: "health uptime", run: () => router.push("/status") },
      { id: "nav-api", group: "Navigation", icon: FileJson, label: "API Docs", keywords: "openapi swagger reference", run: () => router.push("/api-docs") },
    ];

    if (user) {
      list.push(
        { id: "acc-dashboard", group: "Account", icon: UserIcon, label: "Dashboard", run: () => router.push("/dashboard") },
        { id: "acc-submissions", group: "Account", icon: ListChecks, label: "My Submissions", run: () => router.push("/submissions") },
        { id: "acc-bookmarks", group: "Account", icon: Bookmark, label: "Bookmarks", run: () => router.push("/dashboard/bookmarks") },
        { id: "acc-settings", group: "Account", icon: SettingsIcon, label: "Account Settings", run: () => router.push("/dashboard/settings") },
        { id: "acc-profile", group: "Account", icon: UserIcon, label: "View Public Profile", run: () => router.push(`/users/${user.username}`) },
        { id: "acc-logout", group: "Account", icon: CornerUpLeft, label: "Sign out", keywords: "logout", run: () => { void logout().then(() => router.push("/")); } },
      );
      if (user.role === "admin") {
        list.push({ id: "admin-console", group: "Admin", icon: Shield, label: "Admin Console", run: () => router.push("/admin") });
      }
    } else {
      list.push(
        { id: "acc-login", group: "Account", icon: ArrowRight, label: "Sign in", run: () => router.push("/login") },
        { id: "acc-register", group: "Account", icon: ArrowRight, label: "Create account", keywords: "signup register", run: () => router.push("/register") },
      );
    }

    list.push(
      { id: "theme-light", group: "Theme", icon: Sun, label: "Switch to Light theme", keywords: "theme light", run: () => { setTheme("light"); return false; } },
      { id: "theme-dark", group: "Theme", icon: Moon, label: "Switch to Dark theme", keywords: "theme dark", run: () => { setTheme("dark"); return false; } },
      { id: "theme-system", group: "Theme", icon: Monitor, label: "Match System theme", keywords: "theme system auto", run: () => { setTheme("system"); return false; } },
    );

    return list;
  }, [router, setTheme, user, logout]);

  // Filter commands by query
  const filteredCmds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = `${c.label} ${c.keywords ?? ""} ${c.group}`.toLowerCase();
      return q.split(/\s+/).every((tok) => hay.includes(tok));
    });
  }, [commands, query]);

  // Combined ordered list: problem hits first when searching, then commands
  const ordered = useMemo(() => {
    type Row =
      | { kind: "cmd"; cmd: CommandItem }
      | { kind: "hit"; hit: ProblemHit };
    const rows: Row[] = [];
    for (const h of hits) rows.push({ kind: "hit", hit: h });
    for (const c of filteredCmds) rows.push({ kind: "cmd", cmd: c });
    return rows;
  }, [hits, filteredCmds]);

  // Reset active index when results change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(0);
  }, [query, hits.length]);

  const runRow = useCallback(
    (idx: number) => {
      const row = ordered[idx];
      if (!row) return;
      if (row.kind === "hit") {
        router.push(`/problems/${row.hit.slug}`);
        close();
      } else {
        const result = row.cmd.run();
        if (result !== false) close();
      }
    },
    [ordered, router, close],
  );

  // Keyboard nav within palette
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, ordered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        runRow(active);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, ordered.length, active, runRow, close]);

  // Scroll active row into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  // Build groups for rendering
  const grouped: Record<string, CommandItem[]> = {};
  for (const cmd of filteredCmds) {
    if (!grouped[cmd.group]) grouped[cmd.group] = [];
    grouped[cmd.group].push(cmd);
  }
  const groupOrder = ["Navigation", "Problems", "Account", "Admin", "Theme"];

  // Compute the stable index of a command in `ordered` so highlight matches keyboard nav
  let cmdCursor = hits.length - 1;
  function nextCmdIndex() {
    cmdCursor += 1;
    return cmdCursor;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 py-[12vh] sm:py-[14vh]"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close command palette"
        onClick={close}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in-up motion-reduce:animate-none"
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border bg-card shadow-elevated animate-fade-in-up motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top edge gradient */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" aria-hidden="true" />

        {/* Search row */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={user ? `Hi ${user.username} — type a command or problem…` : "Search problems, jump anywhere…"}
            aria-label="Search commands"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70">
            ESC
          </span>
        </div>

        {/* Results scroll */}
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto scrollbar-thin py-2">
          {/* Problem hits */}
          {hits.length > 0 && (
            <div className="px-2">
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Problems
              </p>
              {hits.map((h, i) => (
                <button
                  key={h.id}
                  data-row={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => runRow(i)}
                  className={`group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                    active === i ? "bg-accent text-accent-foreground" : "text-foreground/90 hover:bg-accent/60"
                  }`}
                >
                  <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="truncate flex-1">{h.title}</span>
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${DIFFICULTY_DOT[h.difficulty.toLowerCase()] ?? "bg-muted-foreground"}`} aria-hidden="true" />
                  <span className="hidden sm:inline text-[11px] text-muted-foreground capitalize">{h.difficulty}</span>
                  <CornerDownLeft className={`h-3 w-3 shrink-0 transition-opacity ${active === i ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {/* Empty hint while searching */}
          {searching && hits.length === 0 && query.trim().length >= 2 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">Searching problems…</p>
          )}

          {/* Commands grouped */}
          {groupOrder.map((g) => {
            const cmds = grouped[g];
            if (!cmds || cmds.length === 0) return null;
            return (
              <div key={g} className="px-2 mt-1">
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g}
                </p>
                {cmds.map((c) => {
                  const idx = nextCmdIndex();
                  const isActive = active === idx;
                  return (
                    <button
                      key={c.id}
                      data-row={idx}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => runRow(idx)}
                      className={`group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                        isActive ? "bg-accent text-accent-foreground" : "text-foreground/90 hover:bg-accent/60"
                      }`}
                    >
                      <c.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
                      <span className="truncate flex-1">{c.label}</span>
                      {g === "Theme" && theme === c.id.replace("theme-", "") && (
                        <span className="text-[11px] text-primary">active</span>
                      )}
                      <CornerDownLeft className={`h-3 w-3 shrink-0 transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            );
          })}

          {ordered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matches for &ldquo;{query}&rdquo;
            </p>
          )}
        </div>

        {/* Footer hint bar */}
        <div className="flex items-center justify-between gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="inline-flex items-center rounded border border-border/60 bg-background px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="inline-flex items-center rounded border border-border/60 bg-background px-1 py-0.5 font-mono text-[10px]">↵</kbd>
              select
            </span>
          </div>
          <span className="hidden sm:inline">
            <span className="text-foreground font-medium">LeetRank</span> Command Palette
          </span>
        </div>
      </div>
    </div>
  );
}
