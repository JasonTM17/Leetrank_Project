"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ShieldOff } from "lucide-react";

export default function Forbidden() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-md">
          <ShieldOff className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="mt-4 text-2xl font-bold">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have permission to view this page.
          </p>
          <div className="mt-6">
            <Link href="/">
              <Button>Go home</Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
