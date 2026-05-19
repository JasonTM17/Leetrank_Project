import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function ContestDetailLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <Skeleton className="h-4 w-48 mb-6" />

          {/* Hero card */}
          <div className="rounded-2xl border bg-muted/30 p-8 mb-8 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-96 max-w-full" />
            <div className="flex gap-4 pt-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-11 w-36 mt-2" />
          </div>

          {/* Two-column grid */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-lg border p-6 space-y-3">
              <Skeleton className="h-6 w-24 mb-4" />
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
            <div className="rounded-lg border p-6 space-y-2">
              <Skeleton className="h-6 w-24 mb-4" />
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
