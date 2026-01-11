import { type ReactElement, Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchPageClient } from "./search-page-client";

/**
 * Metadata for the search page.
 */
export const metadata = {
  title: "Search - Knowledge Base",
  description: "Search documents in the Knowledge Base",
};

/**
 * Loading skeleton for search page.
 */
function SearchPageSkeleton(): ReactElement {
  return (
    <div className="flex gap-8">
      {/* Filters sidebar skeleton */}
      <aside className="w-64 shrink-0 space-y-6">
        <Skeleton className="h-6 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-4 pt-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </main>
    </div>
  );
}

/**
 * Knowledge Base Search Page.
 *
 * Server Component that:
 * - Authenticates the user via Clerk
 * - Renders the client-side search interface with Suspense boundary
 */
export default async function SearchPage(): Promise<ReactElement> {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="container max-w-5xl py-8">
      <h1 className="text-2xl font-bold mb-6">Search Knowledge Base</h1>
      <Suspense fallback={<SearchPageSkeleton />}>
        <SearchPageClient />
      </Suspense>
    </div>
  );
}
