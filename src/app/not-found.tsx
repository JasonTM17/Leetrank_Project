import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4">
      <div>
        <h1 className="text-8xl font-bold text-muted-foreground/30">404</h1>
        <h2 className="text-2xl font-semibold mt-2">Page not found</h2>
        <p className="text-muted-foreground mt-2">The page you&apos;re looking for doesn&apos;t exist.</p>
      </div>
      <Button>
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
