import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw, Code2 } from "lucide-react";

export const metadata = {
  title: "Offline",
  description: "You're offline — cached problems are still available.",
};

/**
 * Rendered by the service worker when a navigation request fails because
 * the user has no network. Plain server component; the SW serves the
 * pre-cached HTML directly. The "cached problems" list is intentionally
 * the SW shell list (no client storage probe) so this page works even
 * when JS hasn't booted yet.
 */
export default function OfflinePage() {
  const cachedRoutes: { href: string; label: string }[] = [
    { href: "/problems", label: "Problems" },
    { href: "/contests", label: "Contests" },
    { href: "/leaderboard", label: "Leaderboard" },
  ];

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden="true" />
        <div className="absolute inset-0 bg-radial-fade" aria-hidden="true" />

        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center px-4 text-center">
          <div className="animate-fade-in-up">
            <div
              aria-hidden="true"
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-elevated"
            >
              <WifiOff className="h-7 w-7" />
            </div>

            <h1 className="gradient-text text-3xl md:text-4xl font-bold tracking-tight">
              You&apos;re offline
            </h1>
            <p className="mt-3 text-muted-foreground">
              Cached pages are available below. Reconnect to submit solutions
              and see live leaderboard updates.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/">
                <Button size="lg" className="gap-2 shadow-glow">
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </Button>
              </Link>
              <Link href="/problems">
                <Button variant="outline" size="lg" className="gap-2">
                  <Code2 className="h-4 w-4" />
                  Browse cached problems
                </Button>
              </Link>
            </div>

            <div className="mt-12 rounded-xl border border-border bg-card/60 backdrop-blur px-5 py-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Available offline
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {cachedRoutes.map((r) => (
                  <li key={r.href} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                    />
                    <Link
                      href={r.href}
                      className="text-foreground hover:text-primary transition-colors"
                    >
                      {r.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
