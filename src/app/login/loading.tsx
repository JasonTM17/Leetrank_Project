import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoginLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-12" aria-busy="true" aria-live="polite">
        <div className="w-full max-w-md rounded-lg border bg-card p-8 space-y-4">
          <Skeleton className="h-7 w-32 mx-auto" />
          <Skeleton className="h-4 w-56 mx-auto" />
          <div className="space-y-3 pt-3">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </main>
      <Footer />
    </>
  );
}
