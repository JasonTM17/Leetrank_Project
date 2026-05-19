"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 relative overflow-hidden">
        {/* Background treatment */}
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden="true" />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--destructive) 10%, transparent), transparent 60%)" }}
          aria-hidden="true"
        />

        <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 text-center">
          <div className="animate-fade-in-up max-w-md mx-auto">
            {/* Icon with destructive glow ring */}
            <div className="relative inline-flex items-center justify-center mb-6">
              {/* Outer glow ring */}
              <span
                className="absolute inset-0 rounded-full animate-pulse-soft"
                style={{
                  background: "radial-gradient(circle, color-mix(in oklab, var(--destructive) 25%, transparent) 0%, transparent 70%)",
                  transform: "scale(2.5)",
                }}
                aria-hidden="true"
              />
              <div
                className="relative flex h-20 w-20 items-center justify-center rounded-full border-2"
                style={{
                  borderColor: "color-mix(in oklab, var(--destructive) 40%, transparent)",
                  background: "color-mix(in oklab, var(--destructive) 8%, var(--card))",
                  boxShadow: "0 0 32px -4px var(--destructive)",
                }}
              >
                <AlertTriangle
                  className="h-9 w-9"
                  style={{ color: "var(--destructive)" }}
                  aria-hidden="true"
                />
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Something went wrong
            </h1>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              {error.message && error.message !== "An unexpected error occurred."
                ? error.message
                : "An unexpected error occurred. Our team has been notified."}
            </p>

            {/* Digest for support reference */}
            {error.digest && (
              <p className="mt-3 font-mono text-xs text-muted-foreground/60 select-all">
                ref: {error.digest}
              </p>
            )}

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={reset}
                size="lg"
                className="gap-2"
                style={{ background: "var(--destructive)", color: "var(--destructive-foreground)" }}
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </Button>
              <Link href="/">
                <Button variant="outline" size="lg" className="gap-2">
                  <Home className="h-4 w-4" />
                  Back to home
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
