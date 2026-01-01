"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import {
  validateFile,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_DISPLAY,
} from "@/lib/file-type-utils";

/**
 * TECH DEBT: Using `any` type as workaround for Convex TS2589 error
 * "Type instantiation is excessively deep and possibly infinite"
 *
 * This is a known issue with Convex's generated types when used with
 * complex validator structures. The workaround is to use require() instead
 * of import to defer type checking and avoid the recursive type instantiation.
 *
 * @see https://github.com/get-convex/convex-js/issues (Convex deep type instantiation issue)
 * TODO: Remove when Convex improves type generation for deep validator nesting
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useFileUpload hook.
 */
export interface UseFileUploadOptions {
  /**
   * Maximum file size in bytes.
   * @default 50MB (52428800 bytes)
   */
  maxSize?: number;

  /**
   * Callback fired during upload progress.
   * Note: Progress is simulated as fetch doesn't provide real progress events.
   * @param progress - Progress percentage (0-100)
   */
  onProgress?: (progress: number) => void;

  /**
   * Callback fired when an error occurs during upload.
   * @param error - User-friendly error message
   */
  onError?: (error: string) => void;
}

/**
 * Return type for the useFileUpload hook.
 */
export interface UseFileUploadReturn {
  /**
   * Upload a file to Convex storage and create an attachment record.
   *
   * @param file - The File object to upload
   * @returns The ID of the created attachment, or null if upload failed
   *
   * @example
   * ```tsx
   * const { upload, isUploading } = useFileUpload();
   *
   * const handleFileSelect = async (file: File) => {
   *   const attachmentId = await upload(file);
   *   if (attachmentId) {
   *     // Use attachmentId to link to a message
   *   }
   * };
   * ```
   */
  upload: (file: File) => Promise<Id<"messageAttachments"> | null>;

  /**
   * Whether a file is currently being uploaded.
   */
  isUploading: boolean;

  /**
   * Current upload progress (0-100).
   * Note: Progress is simulated as fetch doesn't provide real progress events.
   */
  progress: number;

  /**
   * Error message if the last upload failed, or null if no error.
   */
  error: string | null;

  /**
   * Reset the hook state (clears error and progress).
   */
  reset: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Interval for simulated progress updates in milliseconds */
const PROGRESS_INTERVAL_MS = 100;

/** Progress increment per interval during simulated upload */
const PROGRESS_INCREMENT = 5;

/** Maximum progress before actual completion */
const MAX_SIMULATED_PROGRESS = 90;

// ============================================================================
// useFileUpload Hook
// ============================================================================

/**
 * Hook for uploading files to Convex storage.
 *
 * Handles the complete upload flow:
 * 1. Client-side validation (size, type)
 * 2. Generate upload URL via mutation
 * 3. Upload file to Convex storage
 * 4. Create attachment record
 * 5. Return attachment ID for linking to messages
 *
 * @param options - Configuration options for the hook
 * @returns Upload function and state (isUploading, progress, error, reset)
 *
 * @example
 * ```tsx
 * function FileUploader() {
 *   const { upload, isUploading, progress, error, reset } = useFileUpload({
 *     onProgress: (p) => console.log(`${p}% uploaded`),
 *     onError: (e) => toast.error(e),
 *   });
 *
 *   const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (!file) return;
 *
 *     const attachmentId = await upload(file);
 *     if (attachmentId) {
 *       // Success - use attachmentId
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleChange} disabled={isUploading} />
 *       {isUploading && <ProgressBar value={progress} />}
 *       {error && <ErrorMessage>{error}</ErrorMessage>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFileUpload(
  options: UseFileUploadOptions = {}
): UseFileUploadReturn {
  const { maxSize = MAX_FILE_SIZE, onProgress, onError } = options;

  // State
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Mutations
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const createAttachment = useMutation(api.attachments.createAttachment);

  /**
   * Reset hook state to initial values.
   */
  const reset = useCallback((): void => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  /**
   * Update progress and call callback.
   */
  const updateProgress = useCallback(
    (value: number): void => {
      const clampedValue = Math.min(100, Math.max(0, value));
      setProgress(clampedValue);
      onProgress?.(clampedValue);
    },
    [onProgress]
  );

  /**
   * Set error and call callback.
   */
  const setErrorState = useCallback(
    (message: string): void => {
      setError(message);
      onError?.(message);
    },
    [onError]
  );

  /**
   * Upload a file to Convex storage.
   */
  const upload = useCallback(
    async (file: File): Promise<Id<"messageAttachments"> | null> => {
      // Reset state before starting
      setError(null);
      setProgress(0);

      // Validate file client-side using existing utilities
      const validation = validateFile(file);
      if (!validation.valid) {
        setErrorState(validation.error ?? "File validation failed");
        return null;
      }

      // Additional check for custom maxSize
      if (file.size > maxSize) {
        const maxSizeDisplay =
          maxSize === MAX_FILE_SIZE
            ? MAX_FILE_SIZE_DISPLAY
            : `${Math.round(maxSize / (1024 * 1024))}MB`;
        setErrorState(`File size exceeds ${maxSizeDisplay} limit`);
        return null;
      }

      setIsUploading(true);
      updateProgress(5);

      // Start simulated progress
      let currentProgress = 5;
      const progressInterval = setInterval(() => {
        if (currentProgress < MAX_SIMULATED_PROGRESS) {
          currentProgress += PROGRESS_INCREMENT;
          updateProgress(currentProgress);
        }
      }, PROGRESS_INTERVAL_MS);

      try {
        // Step 1: Generate upload URL
        updateProgress(10);
        const uploadUrl = await generateUploadUrl({
          fileSize: file.size,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
        });

        updateProgress(20);

        // Step 2: Upload file to Convex storage
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text().catch(() => "");
          throw new Error(
            `Upload failed: ${uploadResponse.status}${errorText ? ` - ${errorText}` : ""}`
          );
        }

        updateProgress(70);

        // Step 3: Get storage ID from response
        const { storageId } = (await uploadResponse.json()) as {
          storageId: Id<"_storage">;
        };

        if (!storageId) {
          throw new Error("Upload response missing storageId");
        }

        updateProgress(80);

        // Step 4: Create attachment record
        const attachmentId = await createAttachment({
          storageId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || "application/octet-stream",
        });

        // Clear progress interval and set to 100%
        clearInterval(progressInterval);
        updateProgress(100);

        return attachmentId;
      } catch (err) {
        // Clear progress interval on error
        clearInterval(progressInterval);

        // Extract error message
        let errorMessage = "Failed to upload file";
        if (err instanceof Error) {
          // Handle specific Convex errors
          if (err.message.includes("size exceeds")) {
            errorMessage = `File size exceeds ${MAX_FILE_SIZE_DISPLAY} limit`;
          } else if (err.message.includes("not allowed")) {
            errorMessage = "This file type is not allowed for security reasons";
          } else if (err.message.includes("Upload failed")) {
            errorMessage = err.message;
          } else {
            errorMessage = err.message || "Failed to upload file";
          }
        }

        setErrorState(errorMessage);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [
      maxSize,
      generateUploadUrl,
      createAttachment,
      updateProgress,
      setErrorState,
    ]
  );

  return {
    upload,
    isUploading,
    progress,
    error,
    reset,
  };
}
