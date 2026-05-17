"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { AlertTriangle } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error("[/admin]", error); }, [error]);

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="mt-4 text-2xl font-bold">Admin panel error</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message || "Something went wrong loading the admin panel."}
          </p>
          <div className="mt-6">
            <Button onClick={reset}>Try again</Button>
          </div>
        </div>
      </main>
    </>
  );
}
