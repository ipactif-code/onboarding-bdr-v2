import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the Knowledge Base document page.
 *
 * Displays a skeleton UI while the document is being fetched.
 * This matches the structure of the actual document editor for a smooth transition.
 */
export default function DocumentLoading(): React.ReactElement {
  return (
    <div className="flex h-full flex-col">
      {/* Header Skeleton */}
      <div className="border-b bg-background">
        {/* Breadcrumbs Row */}
        <div className="flex items-center gap-3 px-4 py-2 border-b">
          <Skeleton className="h-8 w-16" />
          <div className="h-4 w-px bg-border" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Document Info Row */}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <Skeleton className="size-10 rounded-lg" />
            {/* Title and metadata */}
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <div className="h-4 w-px bg-border" aria-hidden="true" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      </div>

      {/* Editor Area Skeleton */}
      <div className="flex-1 overflow-hidden">
        {/* Toolbar Skeleton */}
        <div className="flex items-center gap-2 p-2 border-b">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-32" />
        </div>

        {/* Content Skeleton */}
        <div className="p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Title */}
            <Skeleton className="h-10 w-3/4" />

            {/* First paragraph */}
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>

            {/* Spacing */}
            <div className="h-4" />

            {/* Second paragraph */}
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            {/* Spacing */}
            <div className="h-4" />

            {/* Third paragraph */}
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
