import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-72 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
