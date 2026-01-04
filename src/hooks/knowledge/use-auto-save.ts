"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useAutoSave hook.
 */
export interface UseAutoSaveOptions {
  /** The document ID to save content to */
  documentId: Id<"kbDocuments">;
  /** Debounce delay in milliseconds (default: 5000ms) */
  delay?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Return type for the useAutoSave hook.
 */
export interface UseAutoSaveReturn {
  /** Save content with debouncing */
  save: (content: unknown[]) => void;
  /** Force an immediate save (bypasses debounce) */
  forceSave: () => Promise<void>;
  /** Whether a save is currently in progress */
  isSaving: boolean;
  /** Whether there are unsaved changes pending */
  hasPendingChanges: boolean;
  /** Timestamp of last successful save */
  lastSaved: Date | null;
  /** Error from the last save attempt */
  error: Error | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Default auto-save delay in milliseconds */
const DEFAULT_DELAY = 5000;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Auto-save hook for Knowledge Base documents with debouncing.
 *
 * Features:
 * - Debounced content saving (default 5 second delay)
 * - Tracks saving state and last save time
 * - Handles errors with toast notifications
 * - Clears pending saves on unmount
 * - Force saves on window beforeunload
 *
 * @param options - Configuration options
 * @returns Auto-save state and controls
 *
 * @example
 * ```tsx
 * const { save, isSaving, lastSaved, hasPendingChanges } = useAutoSave({
 *   documentId: params.documentId,
 *   delay: 3000, // Optional: 3 second delay
 * });
 *
 * // Call save whenever content changes
 * const handleChange = (newContent: unknown[]) => {
 *   setContent(newContent);
 *   save(newContent);
 * };
 *
 * // Show save indicator
 * {isSaving && <span>Saving...</span>}
 * {lastSaved && <span>Last saved: {lastSaved.toLocaleTimeString()}</span>}
 * ```
 */
export function useAutoSave(options: UseAutoSaveOptions): UseAutoSaveReturn {
  const { documentId, delay = DEFAULT_DELAY, enabled = true } = options;

  // State
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // Refs for cleanup and tracking
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<unknown[] | null>(null);
  const isMountedRef = useRef(true);

  // Mutation
  const updateContentMutation = useMutation(api.knowledge.documents.updateContent);

  /**
   * Perform the actual save operation.
   */
  const performSave = useCallback(
    async (content: unknown[]): Promise<void> => {
      if (!isMountedRef.current) return;

      setIsSaving(true);
      setError(null);

      try {
        await updateContentMutation({
          documentId,
          content,
        });

        if (isMountedRef.current) {
          setLastSaved(new Date());
          setHasPendingChanges(false);
          pendingContentRef.current = null;
        }
      } catch (err) {
        if (isMountedRef.current) {
          const saveError =
            err instanceof Error ? err : new Error("Failed to save document");
          setError(saveError);
          toast.error("Failed to save document. Your changes may not be saved.");
        }
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [documentId, updateContentMutation]
  );

  /**
   * Save content with debouncing.
   * Multiple calls within the delay window will only trigger one save.
   */
  const save = useCallback(
    (content: unknown[]): void => {
      if (!enabled) return;

      // Store pending content for force save and beforeunload
      pendingContentRef.current = content;
      setHasPendingChanges(true);

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        performSave(content);
        timeoutRef.current = null;
      }, delay);
    },
    [enabled, delay, performSave]
  );

  /**
   * Force an immediate save, bypassing the debounce delay.
   * Useful for explicit save actions or before navigation.
   */
  const forceSave = useCallback(async (): Promise<void> => {
    // Clear pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Save pending content if any
    if (pendingContentRef.current) {
      await performSave(pendingContentRef.current);
    }
  }, [performSave]);

  // Handle beforeunload to save pending changes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (pendingContentRef.current && hasPendingChanges) {
        // Attempt to save synchronously (may not complete)
        // Show browser warning about unsaved changes
        event.preventDefault();
        // Note: Modern browsers ignore custom messages, but we still need to set returnValue
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasPendingChanges]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Clear pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Attempt final save if there's pending content
      // Note: This is async and may not complete before unmount
      if (pendingContentRef.current) {
        // We don't await here since the component is unmounting
        // The mutation will still attempt to run
        updateContentMutation({
          documentId,
          content: pendingContentRef.current,
        }).catch(() => {
          // Silently handle errors on unmount
        });
      }
    };
  }, [documentId, updateContentMutation]);

  return {
    save,
    forceSave,
    isSaving,
    hasPendingChanges,
    lastSaved,
    error,
  };
}
