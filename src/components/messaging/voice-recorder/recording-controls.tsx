"use client";

import { Mic, Pause, Play, Send, Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RecordingControlsProps } from "./types";

/**
 * Recording controls component.
 *
 * Renders different control sets based on recording state:
 * - idle: Start button
 * - recording/paused: Cancel, Pause/Resume, Stop buttons
 * - preview: Cancel, Send buttons
 */
export function RecordingControls({
  state,
  isPaused,
  disabled,
  onStart,
  onStop,
  onPause,
  onResume,
  onCancel,
  onSend,
}: RecordingControlsProps): React.ReactElement {
  // Idle state - Start button
  if (state === "idle") {
    return (
      <div className="flex items-center justify-center py-4">
        <Button
          type="button"
          size="lg"
          onClick={onStart}
          disabled={disabled}
          aria-label="Start recording voice message"
          className="gap-2"
        >
          <Mic className="size-4" />
          Start Recording
        </Button>
      </div>
    );
  }

  // Recording or Paused state
  if (state === "recording" || state === "paused") {
    return (
      <div className="flex items-center justify-between">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          aria-label="Cancel recording"
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="size-4 mr-1" />
          Cancel
        </Button>

        <div className="flex items-center gap-2">
          {/* Pause/Resume button */}
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={isPaused ? onResume : onPause}
            aria-label={isPaused ? "Resume recording" : "Pause recording"}
            className="min-h-11 min-w-11"
          >
            {isPaused ? (
              <>
                <Play className="size-4" />
                <span className="sr-only">Resume recording</span>
              </>
            ) : (
              <>
                <Pause className="size-4" />
                <span className="sr-only">Pause recording</span>
              </>
            )}
          </Button>

          {/* Stop button */}
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={onStop}
            aria-label="Stop recording"
            className="min-h-11 min-w-11 bg-destructive hover:bg-destructive/90"
          >
            <Square className="size-4 fill-current" />
            <span className="sr-only">Stop recording</span>
          </Button>
        </div>
      </div>
    );
  }

  // Preview state
  if (state === "preview") {
    return (
      <div className="flex items-center justify-between">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          aria-label="Cancel and discard recording"
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="size-4 mr-1" />
          Cancel
        </Button>

        <Button
          type="button"
          size="default"
          onClick={onSend}
          disabled={disabled}
          aria-label="Send voice message"
          className="gap-2"
        >
          <Send className="size-4" />
          Send
        </Button>
      </div>
    );
  }

  // Error or unexpected state - render nothing
  return <></>;
}
