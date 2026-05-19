import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatusLoading() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          {/* Breadcrumb skeleton */}
          <Skeleton className="h-4 w-32" />

          {/* Heading skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>

          {/* Overall indicator skeleton */}
          <Skeleton className="h-20 w-full rounded-xl" />

          {/* Services card skeleton */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <Skeleton className="h-5 w-20" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
