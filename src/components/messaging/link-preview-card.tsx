"use client";

import * as React from "react";

import { ExternalLink, Globe } from "lucide-react";

import { cn } from "@/lib/utils";

import { LinkPreviewMinimal } from "./link-preview-minimal";
import { LinkPreviewSkeleton } from "./link-preview-skeleton";
import type { LinkMetadata } from "./link-preview-types";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts the hostname from a URL for display.
 */
function getHostname(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Truncates text to a maximum length with ellipsis.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trim() + "\u2026";
}

// ============================================================================
// LinkPreviewCard Component
// ============================================================================

export interface LinkPreviewCardProps {
  /** The URL to preview */
  url: string;
  /** Pre-fetched metadata (if available from cache) */
  metadata?: LinkMetadata | null;
  /** Whether the metadata is currently being fetched */
  isLoading?: boolean;
  /** Whether the fetch failed */
  hasError?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a rich preview card for a URL.
 *
 * Shows:
 * - Thumbnail image (when available)
 * - Title
 * - Description (truncated)
 * - Site name / hostname
 *
 * States:
 * - Loading: Shows skeleton
 * - Error/No metadata: Shows minimal URL-only preview
 * - Success: Shows full rich preview card
 *
 * @example
 * ```tsx
 * <LinkPreviewCard
 *   url="https://example.com/article"
 *   metadata={{
 *     url: "https://example.com/article",
 *     title: "Article Title",
 *     description: "Article description...",
 *     imageUrl: "https://example.com/image.jpg",
 *     siteName: "Example Site"
 *   }}
 * />
 * ```
 */
export function LinkPreviewCard({
  url,
  metadata,
  isLoading = false,
  hasError = false,
  className,
}: LinkPreviewCardProps): React.ReactElement {
  // Show skeleton while loading
  if (isLoading) {
    return <LinkPreviewSkeleton className={className} />;
  }

  // Show minimal preview on error or missing metadata
  if (hasError || !metadata || !metadata.title) {
    return <LinkPreviewMinimal url={url} className={className} />;
  }

  const hostname = metadata.siteName || getHostname(url);
  const description = metadata.description
    ? truncateText(metadata.description, 120)
    : null;
  const displayTitle = truncateText(metadata.title, 80);

  return (
    <a
      data-slot="link-preview"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${displayTitle} - ${hostname} (opens in new tab)`}
      className={cn(
        "group flex gap-3 rounded-lg border border-border bg-muted/30 p-3",
        "transition-colors hover:bg-muted/50",
        className
      )}
    >
      {/* Thumbnail */}
      {metadata.imageUrl && (
        <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={metadata.imageUrl}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Hide image on error
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Title */}
        <div className="flex items-start gap-1">
          <span className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">
            {displayTitle}
          </span>
          <ExternalLink
            className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </div>

        {/* Description */}
        {description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {description}
          </p>
        )}

        {/* Site name / hostname */}
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {metadata.faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={metadata.faviconUrl}
              alt=""
              className="size-3"
              loading="lazy"
              onError={(e) => {
                // Replace with globe icon on error
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Globe className="size-3" aria-hidden="true" />
          )}
          <span>{hostname}</span>
        </div>
      </div>
    </a>
  );
}
