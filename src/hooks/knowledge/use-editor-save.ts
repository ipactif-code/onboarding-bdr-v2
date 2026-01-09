"use client";

import { useRef } from "react";
import { type Value } from "platejs";
import { useMutation } from "convex/react";
import { Id } from "../../../convex/_generated/dataModel";
import { useDebouncedCallback } from "@/hooks/use-debounce-callback";
import { toast } from "sonner";

// Load API with require to avoid TS2589 deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;

// ============================================================================
// Constants
// ============================================================================

/**
 * Duration to display "Saved" status indicator before resetting to idle.
 */
export const SAVE_STATUS_DISPLAY_MS = 2000;

/**
 * Debounce delay for auto-save when in collaborative mode (offline fallback).
 * Longer delay since Yjs handles real-time sync when connected.
 */
export const COLLAB_SAVE_DEBOUNCE_MS = 1000;

/**
 * Maximum wait time for debounced save in collaborative mode.
 * Ensures save occurs within this window regardless of continued typing.
 */
export const COLLAB_SAVE_MAX_WAIT_MS = 5000;

/**
 * Debounce delay for auto-save in standalone (non-collaborative) mode.
 * Shorter delay for more responsive saving without Yjs sync.
 */
export const STANDALONE_SAVE_DEBOUNCE_MS = 500;

/**
 * Maximum wait time for debounced save in standalone mode.
 */
export const STANDALONE_SAVE_MAX_WAIT_MS = 2000;

// ============================================================================
// Types
// ============================================================================

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseEditorSaveOptions {
  documentId: Id<"kbDocuments">;
  /** Whether the editor is currently connected to collaboration server */
  isConnected?: boolean;
  /** Callback when save status changes */
  onSaveStatusChange?: (status: SaveStatus) => void;
  /** Debounce delay in ms. Default varies based on isConnected */
  debounceMs?: number;
  /** Max wait time for debounce in ms. Default varies based on isConnected */
  maxWaitMs?: number;
}

export interface UseEditorSaveReturn {
  /** Trigger a save of the current content */
  save: (value: Value) => void;
  /** Immediately flush any pending save */
  flush: () => void;
  /** Cancel any pending save */
  cancel: () => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract plain text from Slate value for search indexing.
 */
export function extractTextFromSlate(value: Value): string {
  const texts: string[] = [];

  function extractFromNode(node: unknown): void {
    if (!node || typeof node !== "object") return;

    const n = node as Record<string, unknown>;

    // If node has text property, it's a text node
    if (typeof n.text === "string") {
      texts.push(n.text);
      return;
    }

    // If node has children, recurse
    if (Array.isArray(n.children)) {
      for (const child of n.children) {
        extractFromNode(child);
      }
    }
  }

  for (const node of value) {
    extractFromNode(node);
  }

  return texts.join(" ").trim();
}

/**
 * Count words in a text string.
 */
export function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).length;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing editor auto-save functionality.
 *
 * Features:
 * - Debounced save to prevent excessive API calls
 * - Different debounce timings for collaborative vs standalone mode
 * - Automatic text extraction for search indexing
 * - Word count calculation
 * - Status change callbacks for UI feedback
 *
 * @example
 * ```tsx
 * const { save, flush, cancel } = useEditorSave({
 *   documentId,
 *   isConnected: false,
 *   onSaveStatusChange: setSaveStatus,
 * });
 *
 * // On editor change
 * <Plate onChange={({ value }) => save(value)} />
 *
 * // On unmount
 * useEffect(() => () => flush(), [flush]);
 * ```
 */
export function useEditorSave({
  documentId,
  isConnected = false,
  onSaveStatusChange,
  debounceMs,
  maxWaitMs,
}: UseEditorSaveOptions): UseEditorSaveReturn {
  const updateContent = useMutation(api.knowledge.documents.updateContent);

  // Store callback in ref to avoid re-creating debounced function when callback changes.
  // This is the standard pattern to avoid stale closures while maintaining stable dependencies.
  const onSaveStatusChangeRef = useRef(onSaveStatusChange);
  onSaveStatusChangeRef.current = onSaveStatusChange;

  // Track if we're currently saving to avoid race conditions
  const isSavingRef = useRef(false);

  // Calculate debounce timing based on connection status
  const actualDebounceMs =
    debounceMs ??
    (isConnected ? COLLAB_SAVE_DEBOUNCE_MS : STANDALONE_SAVE_DEBOUNCE_MS);
  const actualMaxWaitMs =
    maxWaitMs ??
    (isConnected ? COLLAB_SAVE_MAX_WAIT_MS : STANDALONE_SAVE_MAX_WAIT_MS);

  // Debounced save handler
  const debouncedSave = useDebouncedCallback(
    async (value: Value) => {
      // In collaborative mode when connected, skip local save
      // (Yjs handles persistence via Hocuspocus server)
      if (isConnected) {
        onSaveStatusChangeRef.current?.("idle");
        return;
      }

      // Prevent concurrent saves
      if (isSavingRef.current) {
        return;
      }

      isSavingRef.current = true;
      onSaveStatusChangeRef.current?.("saving");

      try {
        // Extract plain text for search indexing
        const contentText = extractTextFromSlate(value);
        const wordCount = countWords(contentText);

        await updateContent({
          documentId,
          content: value,
          contentText,
          wordCount,
        });

        onSaveStatusChangeRef.current?.("saved");

        // Reset to idle after a delay
        setTimeout(() => {
          onSaveStatusChangeRef.current?.("idle");
        }, SAVE_STATUS_DISPLAY_MS);
      } catch (error) {
        console.error("Failed to save document:", error);
        onSaveStatusChangeRef.current?.("error");
        toast.error("Failed to save document");
      } finally {
        isSavingRef.current = false;
      }
    },
    actualDebounceMs,
    { maxWait: actualMaxWaitMs }
  );

  return {
    save: debouncedSave,
    flush: debouncedSave.flush,
    cancel: debouncedSave.cancel,
  };
}
