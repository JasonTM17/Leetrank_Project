import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1" aria-busy="true" aria-live="polite">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-56 mb-8" />
          <div className="grid gap-6 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-6">
                <Skeleton className="h-5 w-32 mb-4" />
                <Skeleton className="h-40 w-full" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
