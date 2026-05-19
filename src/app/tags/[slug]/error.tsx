"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AlertTriangle } from "lucide-react";

export default function TagPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/tags/[slug]]", error);
  }, [error]);

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-16" role="alert" aria-live="assertive">
        <div className="text-center max-w-md animate-fade-in-up">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold">Couldn&apos;t load tag</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message || "Something went wrong loading problems for this tag."}
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-xs text-muted-foreground/60 select-all">ref: {error.digest}</p>
          )}
          <div className="mt-6">
            <Button onClick={reset}>Try again</Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
