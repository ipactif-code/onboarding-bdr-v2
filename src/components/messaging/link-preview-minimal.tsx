"use client";

import * as React from "react";

import { ExternalLink, Globe } from "lucide-react";

import { cn } from "@/lib/utils";

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

// ============================================================================
// LinkPreviewMinimal Component
// ============================================================================

export interface LinkPreviewMinimalProps {
  /** The URL to display */
  url: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Minimal fallback when metadata fetch fails.
 * Shows just the URL with a link icon.
 *
 * @example
 * ```tsx
 * // Simple URL-only preview
 * <LinkPreviewMinimal url="https://example.com" />
 *
 * // With custom styling
 * <LinkPreviewMinimal url="https://example.com" className="max-w-md" />
 * ```
 */
export function LinkPreviewMinimal({
  url,
  className,
}: LinkPreviewMinimalProps): React.ReactElement {
  const hostname = getHostname(url);

  return (
    <a
      data-slot="link-preview-minimal"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${hostname} (opens in new tab)`}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3",
        "text-sm text-muted-foreground transition-colors hover:bg-muted/50",
        className
      )}
    >
      <Globe className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{hostname}</span>
      <ExternalLink className="size-3 shrink-0 opacity-50" aria-hidden="true" />
    </a>
  );
}
