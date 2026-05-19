import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function DiscussionsLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1" aria-busy="true" aria-live="polite">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-44 mb-2" />
          <Skeleton className="h-4 w-72 mb-8" />
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
