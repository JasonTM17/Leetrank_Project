"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Lock, ArrowLeft, Home } from "lucide-react";

export default function Forbidden() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden="true" />
        <div className="absolute inset-0 bg-radial-fade" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 -z-0 h-64 bg-gradient-to-b from-destructive/10 to-transparent blur-3xl" aria-hidden="true" />

        <div className="relative text-center max-w-md animate-fade-in-up">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20 mx-auto mb-6">
            <Lock className="h-8 w-8 text-destructive" aria-hidden="true" />
          </div>

          <div className="text-8xl md:text-9xl font-bold gradient-text leading-none mb-4" aria-hidden="true">
            403
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Access denied</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            You don&apos;t have permission to view this page. If you think this is a
            mistake, contact an administrator.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/">
              <Button className="gap-2 shadow-glow">
                <Home className="h-4 w-4" /> Go home
              </Button>
            </Link>
            <Button variant="outline" className="gap-2" onClick={() => history.back()}>
              <ArrowLeft className="h-4 w-4" /> Go back
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
