import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1" aria-busy="true" aria-live="polite">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-56 mb-8" />
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
