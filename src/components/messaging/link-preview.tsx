"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { LinkPreviewCard } from "./link-preview-card";
import type { LinkPreviewCardProps } from "./link-preview-card";
import type { LinkMetadata } from "./link-preview-types";

// ============================================================================
// Re-exports from sub-components
// ============================================================================

export {
  LinkPreviewSkeleton,
  type LinkPreviewSkeletonProps,
} from "./link-preview-skeleton";

export {
  LinkPreviewMinimal,
  type LinkPreviewMinimalProps,
} from "./link-preview-minimal";

export { LinkPreviewCard, type LinkPreviewCardProps } from "./link-preview-card";

export type { LinkMetadata } from "./link-preview-types";

// ============================================================================
// LinkPreview Props (Backward Compatibility)
// ============================================================================

/**
 * Props for the LinkPreview component.
 * @deprecated Use LinkPreviewCardProps instead
 */
export type LinkPreviewProps = LinkPreviewCardProps;

// ============================================================================
// LinkPreview Component (Alias for LinkPreviewCard)
// ============================================================================

/**
 * Displays a rich preview card for a URL.
 * This is an alias for LinkPreviewCard for backward compatibility.
 *
 * @see LinkPreviewCard for full documentation
 */
export function LinkPreview(props: LinkPreviewProps): React.ReactElement {
  return <LinkPreviewCard {...props} />;
}

// ============================================================================
// LinkPreviewList Component
// ============================================================================

export interface LinkPreviewListProps {
  /** URLs to preview */
  urls: string[];
  /** Map of URL to metadata (from cache or query) */
  metadataMap?: Map<string, LinkMetadata | null>;
  /** Set of URLs currently being fetched */
  loadingUrls?: Set<string>;
  /** Maximum number of previews to show */
  maxPreviews?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders a list of link previews for multiple URLs.
 * Limits the number of previews shown to avoid spam.
 *
 * @example
 * ```tsx
 * <LinkPreviewList
 *   urls={["https://example.com", "https://other.com"]}
 *   metadataMap={new Map([["https://example.com", { url: "https://example.com", title: "Example" }]])}
 *   maxPreviews={3}
 * />
 * ```
 */
export function LinkPreviewList({
  urls,
  metadataMap = new Map(),
  loadingUrls = new Set(),
  maxPreviews = 3,
  className,
}: LinkPreviewListProps): React.ReactElement | null {
  // Deduplicate and limit URLs
  const uniqueUrls = React.useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const url of urls) {
      if (!seen.has(url) && result.length < maxPreviews) {
        seen.add(url);
        result.push(url);
      }
    }
    return result;
  }, [urls, maxPreviews]);

  if (uniqueUrls.length === 0) {
    return null;
  }

  return (
    <div
      data-slot="link-preview-list"
      className={cn("mt-2 flex flex-col gap-2", className)}
    >
      {uniqueUrls.map((url) => (
        <LinkPreviewCard
          key={url}
          url={url}
          metadata={metadataMap.get(url) ?? undefined}
          isLoading={loadingUrls.has(url)}
          hasError={metadataMap.has(url) && metadataMap.get(url) === null}
        />
      ))}
    </div>
  );
}
