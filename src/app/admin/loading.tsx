import { Navbar } from "@/components/layout/navbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1" aria-busy="true" aria-live="polite">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-64 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-5 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-14" />
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-card p-6 space-y-3">
            <Skeleton className="h-5 w-44 mb-3" />
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10" />)}
          </div>
        </div>
      </main>
    </>
  );
}
