import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function DiscussionDetailLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1" aria-busy="true" aria-live="polite">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-2/3 mb-3" />
          <div className="flex gap-2 mb-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="rounded-lg border bg-card p-6 space-y-3 mb-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
