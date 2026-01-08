"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useRecordAccess hook.
 */
export interface UseRecordAccessOptions {
  /** The document ID to record access for. If undefined, no access is recorded. */
  documentId: Id<"kbDocuments"> | undefined;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Records document access for recents tracking.
 *
 * This hook calls the recordAccess mutation once when the documentId changes.
 * It's designed to track which documents a user has recently viewed.
 *
 * Features:
 * - Only records access once per document (per component mount)
 * - Silently handles errors (not critical to user experience)
 * - Skips recording if documentId is undefined
 *
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * // In a document view component
 * useRecordAccess({ documentId });
 *
 * // Or with conditional documentId
 * const documentId = params.documentId as Id<"kbDocuments"> | undefined;
 * useRecordAccess({ documentId });
 * ```
 */
export function useRecordAccess(options: UseRecordAccessOptions): void {
  const { documentId } = options;
  const recordAccess = useMutation(api.knowledge.documents.recordAccess);
  const hasRecorded = useRef<string | null>(null);

  useEffect(() => {
    // Skip if no documentId or if already recorded for this document
    if (!documentId || hasRecorded.current === documentId) {
      return;
    }

    // Mark as recorded before the async call to prevent double-recording
    hasRecorded.current = documentId;

    // Record access - silently fail (not critical to UX)
    recordAccess({ documentId }).catch(() => {
      // Silently ignore errors - recording access is not critical
      // Reset hasRecorded so it can retry on next render if needed
      hasRecorded.current = null;
    });
  }, [documentId, recordAccess]);
}
