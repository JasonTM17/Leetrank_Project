import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the problem detail / editor page.
 * Mirrors the split-pane layout: description panel on the left,
 * editor + test panel on the right.
 */
export default function ProblemDetailLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        {/* Toolbar strip */}
        <div className="border-b px-4 py-2 flex items-center gap-3">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>

        {/* Split pane */}
        <div className="flex h-[calc(100vh-8rem)] divide-x overflow-hidden">
          {/* Left: description */}
          <div className="w-full md:w-[45%] overflow-y-auto p-6 space-y-4 shrink-0">
            {/* Title + difficulty */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            {/* Tags */}
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            {/* Description body */}
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            {/* Example block */}
            <Skeleton className="h-24 w-full rounded-lg mt-2" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>

          {/* Right: editor */}
          <div className="hidden md:flex flex-col flex-1 overflow-hidden">
            {/* Editor area */}
            <Skeleton className="flex-1 rounded-none" />
            {/* Test panel */}
            <div className="border-t p-4 space-y-2 h-36 shrink-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
