"use client";

import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Pencil,
  Check,
  X,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { TranscriptionDisplayProps } from "./types";

// ============================================================================
// TranscriptionDisplay Component
// ============================================================================

/**
 * Displays voice message transcription with various states.
 *
 * States:
 * - pending (no transcription): Shows "Transcribe" button for on-demand transcription
 * - processing: Shows loading spinner with skeleton text
 * - completed: Shows transcription text with optional edit capability
 * - failed: Shows error message with retry button
 * - editing: Shows textarea with save/cancel buttons
 */
export function TranscriptionDisplay({
  transcription,
  transcriptionStatus,
  isEditing,
  editedValue,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onRetry,
  onRequestTranscription,
  canEdit,
}: TranscriptionDisplayProps): React.ReactElement | null {
  // Don't render if no transcription and not in a state we handle
  // Note: pending without transcription = not yet transcribed (show button)
  // Note: pending with transcription = should not happen, but treat as completed
  if (
    !transcription &&
    transcriptionStatus !== "pending" &&
    transcriptionStatus !== "processing" &&
    transcriptionStatus !== "failed"
  ) {
    return null;
  }

  // "Not transcribed" state - pending status with no transcription text
  // This means transcription was never requested (on-demand transcription)
  if (transcriptionStatus === "pending" && !transcription) {
    // Only show button if handler is provided (owner only)
    if (!onRequestTranscription) {
      return null;
    }
    return (
      <div
        data-slot="transcription-request"
        className="mt-3 border-t border-border pt-3"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onRequestTranscription}
          className="text-muted-foreground"
        >
          <FileText className="mr-2 size-4" />
          Transcribe
        </Button>
      </div>
    );
  }

  // Pending state with transcription (unlikely, but handle as processing)
  // This state shouldn't normally occur but we handle it gracefully
  if (transcriptionStatus === "pending" && transcription) {
    // If we have transcription text, show it as completed
    // Fall through to the completed state handling below
  }

  // Processing state
  if (transcriptionStatus === "processing") {
    return (
      <div
        data-slot="transcription-processing"
        className="mt-3 space-y-2 border-t border-border pt-3"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Transcribing audio...</span>
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  // Failed state
  if (transcriptionStatus === "failed") {
    return (
      <div
        data-slot="transcription-failed"
        className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="size-4 text-destructive" />
          <span>Transcription unavailable</span>
        </div>
        {onRetry && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onRetry}
            className="shrink-0"
          >
            <RefreshCw className="mr-1 size-3" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  // Completed state with transcription
  if (transcription) {
    if (isEditing) {
      return (
        <div
          data-slot="transcription-editing"
          className="mt-3 space-y-2 border-t border-border pt-3"
        >
          <textarea
            value={editedValue}
            onChange={(e) => onEditChange(e.target.value)}
            className="w-full resize-none rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
            aria-label="Edit transcription"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={onEditCancel}
              aria-label="Cancel editing"
            >
              <X className="mr-1 size-3" />
              Cancel
            </Button>
            <Button
              variant="default"
              size="xs"
              onClick={onEditSave}
              aria-label="Save transcription"
            >
              <Check className="mr-1 size-3" />
              Save
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div
        data-slot="transcription-display"
        className="mt-3 border-t border-border pt-3"
      >
        <div className="group flex items-start justify-between gap-2">
          <p className="text-sm text-foreground/80">{transcription}</p>
          {canEdit && (
            <Tooltip>
              <TooltipTrigger
                onClick={onEditStart}
                className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label="Edit transcription"
              >
                <Pencil className="size-3" />
              </TooltipTrigger>
              <TooltipContent>Edit transcription</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    );
  }

  return null;
}
