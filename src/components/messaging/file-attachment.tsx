"use client";

/**
 * FileAttachment - Display non-image file attachments with download capability.
 *
 * This component renders a file attachment card with:
 * - File icon based on MIME type
 * - File name (truncated if long)
 * - Formatted file size
 * - Download button
 * - Hover state with visual feedback
 *
 * Used for any non-image file attachments in messages.
 */

import { Download } from "lucide-react";

import { getFileIcon } from "@/lib/file-type-icons";
import { formatFileSize } from "@/lib/file-type-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface FileAttachmentProps {
  /** File name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type of the file */
  fileType: string;
  /** Download URL for the file */
  downloadUrl: string;
  /** Optional className for styling customization */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate filename if it exceeds maxLength while preserving extension.
 */
function truncateFileName(fileName: string, maxLength = 40): string {
  if (fileName.length <= maxLength) {
    return fileName;
  }

  const lastDotIndex = fileName.lastIndexOf(".");
  const extension = lastDotIndex !== -1 ? fileName.slice(lastDotIndex) : "";
  const nameWithoutExt =
    lastDotIndex !== -1 ? fileName.slice(0, lastDotIndex) : fileName;

  const availableLength = maxLength - extension.length - 3; // 3 for "..."

  if (availableLength <= 0) {
    return fileName.slice(0, maxLength - 3) + "...";
  }

  return nameWithoutExt.slice(0, availableLength) + "..." + extension;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Display a non-image file attachment with download capability.
 *
 * @example
 * ```tsx
 * <FileAttachment
 *   fileName="document.pdf"
 *   fileSize={1536000}
 *   fileType="application/pdf"
 *   downloadUrl="https://..."
 * />
 * ```
 */
export function FileAttachment({
  fileName,
  fileSize,
  fileType,
  downloadUrl,
  className,
}: FileAttachmentProps): React.ReactElement {
  const Icon = getFileIcon(fileType, fileName);
  const truncatedName = truncateFileName(fileName);
  const formattedSize = formatFileSize(fileSize);

  /**
   * Handle download button click.
   */
  const handleDownload = (): void => {
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      data-slot="file-attachment"
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border bg-background p-3",
        "transition-colors hover:bg-muted/50",
        "min-h-11", // WCAG 2.5.5 touch target
        className
      )}
    >
      {/* File Icon */}
      <div className="flex-shrink-0" aria-hidden="true">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* File Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {truncatedName}
        </p>
        <p className="text-xs text-muted-foreground">{formattedSize}</p>
      </div>

      {/* Download Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDownload}
        className="flex-shrink-0 min-h-11 min-w-11" // WCAG touch target
        aria-label={`Download ${fileName}`}
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
