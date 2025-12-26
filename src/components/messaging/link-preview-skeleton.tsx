"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================================================
// LinkPreviewSkeleton Component
// ============================================================================

export interface LinkPreviewSkeletonProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for LinkPreview component.
 * Displays animated placeholder while metadata is being fetched.
 *
 * @example
 * ```tsx
 * // Show skeleton while loading link metadata
 * {isLoading && <LinkPreviewSkeleton />}
 *
 * // With custom styling
 * <LinkPreviewSkeleton className="max-w-md" />
 * ```
 */
export function LinkPreviewSkeleton({
  className,
}: LinkPreviewSkeletonProps): React.ReactElement {
  return (
    <div
      data-slot="link-preview-skeleton"
      className={cn(
        "flex gap-3 rounded-lg border border-border bg-muted/30 p-3",
        className
      )}
    >
      {/* Thumbnail skeleton */}
      <Skeleton className="size-16 shrink-0 rounded-md" />
      {/* Content skeleton */}
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
