import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProblemsLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-72 mb-8" />
          <div className="flex gap-2 mb-6">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-20" />)}
          </div>
          <div className="rounded-lg border bg-card overflow-hidden">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-32 hidden md:block" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
