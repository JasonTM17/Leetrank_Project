import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function SubmissionDetailLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1" aria-busy="true" aria-live="polite">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-72 mb-8" />
          <div className="rounded-lg border bg-card p-6 space-y-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-64 rounded-md" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
