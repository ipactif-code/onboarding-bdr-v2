"use client";

/**
 * ImageAttachment - Display image attachments with inline preview.
 *
 * This component renders an image attachment with:
 * - Inline image preview (thumbnail or full URL)
 * - Click to open full-size in new tab
 * - Image dimensions if available
 * - Loading skeleton while image loads
 * - Responsive sizing with max dimensions
 *
 * Used for image file attachments in messages.
 */

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface ImageAttachmentProps {
  /** File name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type of the file */
  fileType: string;
  /** Download/view URL for the full-size image */
  downloadUrl: string;
  /** Optional thumbnail URL (optimized/smaller version) */
  thumbnailUrl?: string;
  /** Optional image width in pixels */
  width?: number;
  /** Optional image height in pixels */
  height?: number;
  /** Optional className for styling customization */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Display an image attachment with inline preview.
 *
 * @example
 * ```tsx
 * <ImageAttachment
 *   fileName="screenshot.png"
 *   fileSize={256000}
 *   fileType="image/png"
 *   downloadUrl="https://..."
 *   thumbnailUrl="https://...thumbnail"
 *   width={1920}
 *   height={1080}
 * />
 * ```
 */
export function ImageAttachment({
  fileName,
  fileSize: _fileSize,
  fileType: _fileType,
  downloadUrl,
  thumbnailUrl,
  width,
  height,
  className,
}: ImageAttachmentProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Use thumbnail if available, otherwise use full URL
  const imageUrl = thumbnailUrl ?? downloadUrl;

  /**
   * Handle image load complete.
   */
  const handleLoad = (): void => {
    setIsLoading(false);
  };

  /**
   * Handle image load error.
   */
  const handleError = (): void => {
    setIsLoading(false);
    setHasError(true);
  };

  /**
   * Handle click to open full-size image.
   */
  const handleClick = (): void => {
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  };

  /**
   * Format dimensions for display.
   */
  const dimensionsText =
    width && height ? `${width} × ${height}` : undefined;

  return (
    <div
      data-slot="image-attachment"
      className={cn("group relative inline-block max-w-full", className)}
    >
      {/* Loading Skeleton */}
      {isLoading && (
        <Skeleton className="h-48 w-full max-w-md rounded-lg" />
      )}

      {/* Error State */}
      {hasError && !isLoading && (
        <div className="flex h-48 w-full max-w-md items-center justify-center rounded-lg border border-border bg-muted">
          <p className="text-sm text-muted-foreground">
            Failed to load image
          </p>
        </div>
      )}

      {/* Image Preview */}
      {!hasError && (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "relative block max-w-md overflow-hidden rounded-lg border border-border",
            "transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            // Use absolute + invisible instead of hidden to allow image to load
            // (display:none prevents image load, so onLoad never fires)
            isLoading && "absolute invisible"
          )}
          aria-label={`Open ${fileName} in new tab`}
        >
          {/* Image - using img because src is dynamic external URL from Convex storage */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={fileName}
            className="max-h-96 w-auto object-contain"
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
          />

          {/* Overlay with icon on hover */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
            <ExternalLink className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </button>
      )}

      {/* Image Info */}
      {!hasError && !isLoading && (
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{fileName}</span>
          {dimensionsText && (
            <>
              <span aria-hidden="true">•</span>
              <span>{dimensionsText}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
