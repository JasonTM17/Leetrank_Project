import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Page title */}
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-64 mb-8" />

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-5 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-14" />
              </div>
            ))}
          </div>

          {/* Two-column content */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Recent submissions */}
            <div className="rounded-lg border bg-card p-6 space-y-3">
              <Skeleton className="h-5 w-36 mb-4" />
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 rounded-md" />
              ))}
            </div>
            {/* Activity / progress */}
            <div className="rounded-lg border bg-card p-6 space-y-3">
              <Skeleton className="h-5 w-28 mb-4" />
              <Skeleton className="h-40 rounded-lg" />
              <div className="flex gap-3 pt-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>

          {/* Bottom wide card */}
          <div className="rounded-lg border bg-card p-6">
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-8 rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
