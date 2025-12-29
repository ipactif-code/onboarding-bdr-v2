"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Mic, MicOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useVoiceRecorder } from "@/hooks/voice";

import { AudioPreview } from "./audio-preview";
import { RecordingControls } from "./recording-controls";
import { RecordingTimer } from "./recording-timer";
import { WaveformVisualizer } from "./waveform-visualizer";
import { VoiceRecorderSkeleton } from "./voice-recorder-skeleton";
import {
  MAX_DURATION_SECONDS,
  formatDuration,
  type RecordingState,
  type VoiceRecorderProps,
} from "./types";

// Re-export types and skeleton
export { VoiceRecorderSkeleton };
export type { VoiceRecorderProps };

/**
 * Error display component.
 */
function ErrorDisplay({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): React.ReactElement {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3"
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle className="size-5 shrink-0 text-destructive" />
      <p className="flex-1 text-sm text-destructive">{message}</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onRetry}
        aria-label="Retry recording"
      >
        Retry
      </Button>
    </div>
  );
}

/**
 * Voice recorder component for creating voice messages.
 *
 * Features:
 * - Real-time waveform visualization
 * - Recording duration display with progress indicator
 * - Pause/resume functionality
 * - Preview playback before sending
 * - Accessible with keyboard navigation and ARIA labels
 * - Error handling with retry capability
 *
 * @example
 * ```tsx
 * <VoiceRecorder
 *   onSend={(blob, mimeType, duration, waveform) => {
 *     // Upload blob and send message
 *   }}
 *   onCancel={() => setShowRecorder(false)}
 * />
 * ```
 */
export function VoiceRecorder({
  onSend,
  onCancel,
  disabled = false,
  className,
}: VoiceRecorderProps): React.ReactElement {
  const {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    error,
    waveformData,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    getActualDuration,
    mimeType,
    isSupported,
  } = useVoiceRecorder({
    maxDuration: MAX_DURATION_SECONDS,
    onMaxDurationReached: () => {
      // Auto-stop handled by hook
    },
  });

  // Derive current state from hook values
  const getState = (): RecordingState => {
    if (error) return "error";
    if (audioBlob && audioUrl) return "preview";
    if (isPaused) return "paused";
    if (isRecording) return "recording";
    return "idle";
  };

  const state = getState();

  // Handle send action
  // Uses getActualDuration() instead of duration state to prevent race condition
  // where user clicks Send before async state update completes
  const handleSend = useCallback(() => {
    if (!audioBlob) return;
    // Get duration from ref (synchronous, race-condition safe)
    const actualDuration = getActualDuration();
    onSend(audioBlob, mimeType, actualDuration, waveformData);
    resetRecording();
  }, [audioBlob, mimeType, getActualDuration, waveformData, onSend, resetRecording]);

  // Handle cancel action
  const handleCancel = useCallback(() => {
    resetRecording();
    onCancel();
  }, [resetRecording, onCancel]);

  // Handle retry after error
  const handleRetry = useCallback(() => {
    resetRecording();
  }, [resetRecording]);

  // Handle start recording
  const handleStart = useCallback(() => {
    void startRecording();
  }, [startRecording]);

  // Ref for the container element to scope keyboard handling
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle keyboard shortcuts - scoped to component
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      // Only handle if event target is within this component
      if (!containerRef.current?.contains(event.target as Node)) {
        return;
      }

      // Only handle if not in an input element
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
      }

      if (event.key === "Enter" && state === "preview") {
        event.preventDefault();
        handleSend();
      }
    },
    [state, handleCancel, handleSend]
  );

  // Screen reader announcements
  const [announcement, setAnnouncement] = useState<string>("");

  useEffect(() => {
    switch (state) {
      case "recording":
        setAnnouncement("Recording started");
        break;
      case "paused":
        setAnnouncement("Recording paused");
        break;
      case "preview":
        setAnnouncement("Recording complete. Preview available.");
        break;
      case "error":
        setAnnouncement(`Error: ${error}`);
        break;
      default:
        setAnnouncement("");
    }
  }, [state, error]);

  // Browser not supported
  if (!isSupported) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3",
          className
        )}
        role="alert"
      >
        <MicOff className="size-5 shrink-0 text-destructive" />
        <p className="text-sm text-destructive">
          Voice recording is not supported in this browser. Please try Chrome,
          Firefox, or Safari.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-slot="voice-recorder"
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-3",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      role="region"
      aria-label="Voice recorder"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Error state */}
      {state === "error" && error && (
        <ErrorDisplay message={error} onRetry={handleRetry} />
      )}

      {/* Idle state - Start button */}
      {state === "idle" && (
        <RecordingControls
          state={state}
          isPaused={isPaused}
          disabled={disabled}
          onStart={handleStart}
          onStop={stopRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onCancel={handleCancel}
          onSend={handleSend}
        />
      )}

      {/* Recording or Paused state */}
      {(state === "recording" || state === "paused") && (
        <>
          {/* Header with indicator and duration */}
          <RecordingTimer
            current={duration}
            max={MAX_DURATION_SECONDS}
            isPaused={isPaused}
          />

          {/* Waveform visualization */}
          <div className="py-2">
            <WaveformVisualizer
              data={waveformData}
              isAnimating={state === "recording"}
            />
          </div>

          {/* Controls */}
          <RecordingControls
            state={state}
            isPaused={isPaused}
            disabled={disabled}
            onStart={handleStart}
            onStop={stopRecording}
            onPause={pauseRecording}
            onResume={resumeRecording}
            onCancel={handleCancel}
            onSend={handleSend}
          />
        </>
      )}

      {/* Preview state */}
      {state === "preview" && audioUrl && (
        <>
          {/* Header */}
          <div className="flex items-center gap-2">
            <Mic className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Voice message</span>
            <span className="text-xs text-muted-foreground">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Audio preview player */}
          <AudioPreview
            audioUrl={audioUrl}
            duration={duration}
            waveformData={waveformData}
          />

          {/* Controls */}
          <RecordingControls
            state={state}
            isPaused={isPaused}
            disabled={disabled}
            onStart={handleStart}
            onStop={stopRecording}
            onPause={pauseRecording}
            onResume={resumeRecording}
            onCancel={handleCancel}
            onSend={handleSend}
          />
        </>
      )}
    </div>
  );
}

// Default export for convenience
export default VoiceRecorder;
