import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Home, Code2, Trophy } from "lucide-react";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 relative overflow-hidden">
        {/* Background treatment matching homepage */}
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden="true" />
        <div className="absolute inset-0 bg-radial-fade" aria-hidden="true" />
        <div
          className="absolute inset-x-0 -top-32 -z-0 h-96 blur-3xl"
          style={{ background: "linear-gradient(to bottom, color-mix(in oklab, var(--destructive) 15%, transparent), transparent)" }}
          aria-hidden="true"
        />

        <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 text-center">
          <div className="animate-fade-in-up">
            {/* Giant 404 */}
            <div
              className="gradient-text font-bold leading-none tracking-tighter select-none"
              style={{
                fontSize: "clamp(6rem, 18vw, 12rem)",
                background: "linear-gradient(135deg, var(--destructive) 0%, color-mix(in oklab, var(--destructive) 50%, var(--primary)) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
              aria-hidden="true"
            >
              404
            </div>

            <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">
              This page doesn&apos;t exist
            </h1>
            <p className="mt-3 text-muted-foreground max-w-sm mx-auto">
              The URL you followed may be broken, or the page may have been removed.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/">
                <Button size="lg" className="gap-2 shadow-glow">
                  <Home className="h-4 w-4" />
                  Home
                </Button>
              </Link>
              <Link href="/problems">
                <Button variant="outline" size="lg" className="gap-2">
                  <Code2 className="h-4 w-4" />
                  Problems
                </Button>
              </Link>
              <Link href="/contests">
                <Button variant="outline" size="lg" className="gap-2">
                  <Trophy className="h-4 w-4" />
                  Contests
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
