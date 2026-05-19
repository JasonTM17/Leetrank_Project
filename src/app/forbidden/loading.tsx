import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function ForbiddenLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1" aria-busy="true" aria-live="polite">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <Skeleton className="h-12 w-12 mx-auto rounded-full mb-4" />
          <Skeleton className="h-6 w-40 mx-auto mb-2" />
          <Skeleton className="h-4 w-56 mx-auto" />
        </div>
      </main>
      <Footer />
    </>
  );
}
