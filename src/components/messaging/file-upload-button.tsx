"use client";

/**
 * FileUploadButton - Button component with file picker and upload progress.
 *
 * This component provides:
 * - Paperclip icon label (styled as button) to trigger file picker
 * - Hidden file input for file selection (supports multiple files)
 * - Upload progress indicator (circular spinner)
 * - Error toast on upload failure (per-file, doesn't stop other uploads)
 * - Disabled state during upload
 * - Callback with file metadata (url, name, size, type) on success
 *
 * Uses HTML label pattern for cross-browser compatibility (no programmatic click).
 * Uploads files to UploadThing storage.
 *
 * Used in message input to add file attachments.
 */

import { useId, useRef, useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useUploadThing } from "@/hooks/use-upload-file";
import { cn } from "@/lib/utils";
import { validateFile } from "@/lib/file-type-utils";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a successful file upload.
 */
export interface UploadResult {
  /** The URL where the file is stored (UploadThing URL) */
  url: string;
  /** The original file name */
  name: string;
  /** The file size in bytes */
  size: number;
  /** The MIME type of the file */
  type: string;
}

export interface FileUploadButtonProps {
  /**
   * Callback fired when upload completes successfully.
   * @param result - Object containing url, name, size, and type of the uploaded file
   */
  onUploadComplete: (result: UploadResult) => void;

  /**
   * Callback fired immediately when a file is selected (before upload starts).
   * Used for instant preview with blob URLs.
   * @param file - The selected file
   */
  onFileSelect?: (file: File) => void;

  /**
   * Callback fired when upload fails.
   * @param error - Error message
   * @param file - The file that failed to upload
   */
  onUploadError?: (error: string, file: File) => void;

  /**
   * Whether the button is disabled.
   * @default false
   */
  disabled?: boolean;

  /**
   * Optional className for styling customization.
   */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Button with file picker and upload progress for message attachments.
 * Uses UploadThing for file storage.
 *
 * @example
 * ```tsx
 * <FileUploadButton
 *   onUploadComplete={({ url, name, size, type }) => {
 *     // Store file metadata with the message
 *     setAttachments([...attachments, { url, name, size, type }]);
 *   }}
 *   disabled={isSending}
 * />
 * ```
 */
export function FileUploadButton({
  onUploadComplete,
  onFileSelect,
  onUploadError,
  disabled = false,
  className,
}: FileUploadButtonProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate unique ID for input-label association
  const inputId = useId();

  // Track current files for error callback
  const currentFilesRef = useRef<File[]>([]);

  // Track upload progress percentage
  const [progress, setProgress] = useState(0);

  // Use UploadThing hook for message attachments
  const { startUpload, isUploading } = useUploadThing("messageAttachment", {
    onClientUploadComplete: (res) => {
      if (res && res.length > 0) {
        res.forEach((file) => {
          // Use ufsUrl (recommended) with fallback to url (deprecated) for compatibility
          const fileUrl = file.ufsUrl || file.url;
          if (!fileUrl) {
            toast.error(`Upload failed: No URL returned for ${file.name}`);
            return;
          }
          onUploadComplete({
            url: fileUrl,
            name: file.name,
            size: file.size,
            type: file.type,
          });
        });

        // Show success toast
        if (res.length === 1) {
          toast.success("File uploaded successfully");
        } else {
          toast.success(`${res.length} files uploaded successfully`);
        }
      }
      // Clear current files ref
      currentFilesRef.current = [];
      setProgress(0);
    },
    onUploadError: (error) => {
      const errorMessage = error.message || "Upload failed";
      toast.error(`Upload failed: ${errorMessage}`);

      // Call error callback for each file that was being uploaded
      if (onUploadError) {
        currentFilesRef.current.forEach((file) => {
          onUploadError(errorMessage, file);
        });
      }
      // Clear current files ref
      currentFilesRef.current = [];
      setProgress(0);
    },
    onUploadProgress: (p) => {
      setProgress(Math.min(p, 100));
    },
  });

  /**
   * Handle file selection from input.
   * Validates files, calls onFileSelect for instant preview, then uploads via UploadThing.
   */
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    // IMMEDIATELY convert FileList to array before any other operations.
    // FileList is a "live" object - clearing the input (event.target.value = "")
    // also clears the FileList, so we must capture files first.
    const fileArray = Array.from(event.target.files ?? []);

    // Reset input value AFTER capturing files (allows re-uploading same files)
    event.target.value = "";

    if (fileArray.length === 0) return;

    // Validate files before upload
    const validFiles: File[] = [];
    for (const file of fileArray) {
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(validation.error || "Invalid file");
        onUploadError?.(validation.error || "Invalid file", file);
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) return;

    // Immediately notify parent of all valid files for instant preview
    if (onFileSelect) {
      for (const file of validFiles) {
        onFileSelect(file);
      }
    }

    // Track files for error callback
    currentFilesRef.current = validFiles;

    // Start UploadThing upload (handles multiple files)
    try {
      const result = await startUpload(validFiles);

      // If result is null/undefined, the upload was rejected client-side
      if (!result) {
        toast.error("Upload failed - file type may not be supported");
      }
    } catch (error) {
      toast.error(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const isDisabled = disabled || isUploading;

  // Dynamic aria-label based on upload state
  const ariaLabel = isUploading
    ? `Uploading ${progress}%`
    : "Attach files";

  return (
    <div className="relative inline-flex">
      {/* Hidden File Input - supports multiple file selection */}
      {/* Uses label pattern for cross-browser compatibility */}
      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={isDisabled}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Upload Label (styled as button) */}
      {/* Label pattern triggers file picker natively - no JS click needed */}
      <label
        htmlFor={inputId}
        data-slot="file-upload-button"
        className={cn(
          // Base button styles (matches shadcn ghost icon button)
          "inline-flex items-center justify-center gap-2",
          "whitespace-nowrap rounded-md text-sm font-medium",
          "transition-colors",
          // Ghost variant colors
          "hover:bg-accent hover:text-accent-foreground",
          // Focus styles for accessibility
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Size: icon (min 44px for WCAG touch target)
          "h-10 w-10 min-h-11 min-w-11",
          // Cursor
          "cursor-pointer",
          // Disabled state
          isDisabled && "pointer-events-none opacity-50 cursor-not-allowed",
          className
        )}
        aria-label={ariaLabel}
      >
        {isUploading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <Paperclip className="h-5 w-5" aria-hidden="true" />
        )}
      </label>

      {/* Screen reader progress announcement */}
      {isUploading && (
        <span className="sr-only" role="status" aria-live="polite">
          Uploading file, {progress}% complete
        </span>
      )}
    </div>
  );
}
