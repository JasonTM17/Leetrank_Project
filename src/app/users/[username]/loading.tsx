import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function UserProfileLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1" aria-busy="true" aria-live="polite">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-5 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-14" />
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-card p-6">
            <Skeleton className="h-5 w-36 mb-4" />
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
