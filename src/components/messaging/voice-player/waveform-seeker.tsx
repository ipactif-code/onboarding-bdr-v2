"use client";

import type { RefObject } from "react";

import { cn } from "@/lib/utils";
import {
  WaveformDisplay,
  WaveformDisplaySkeleton,
  generatePlaceholderWaveform,
} from "@/components/messaging/waveform-display";

import type { PlayerState } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface WaveformSeekerProps {
  /** Ref to the container element for WaveSurfer */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Current player state */
  state: PlayerState;
  /** Current playback time in seconds */
  currentTime?: number;
  /** Total duration in seconds */
  duration?: number;
  /** Pre-computed waveform data (optional, for error state display) */
  waveformData?: number[];
  /** Optional callback for keyboard-based seeking (receives relative offset, e.g., -0.05 for 5% back) */
  onSeek?: (relativeOffset: number) => void;
  /** Optional className for the outer container */
  className?: string;
}

// ============================================================================
// WaveformSeeker Component
// ============================================================================

/**
 * Waveform display with seeking capability for VoicePlayer.
 *
 * CRITICAL: The container div with containerRef MUST always exist in the DOM
 * for WaveSurfer to attach to. Loading/error states are rendered as overlays.
 *
 * Renders:
 * - Loading state: Animated skeleton waveform (overlay)
 * - Error state: Static placeholder with muted destructive color (overlay)
 * - Ready/Playing state: WaveSurfer container (visible)
 *
 * The actual WaveSurfer instance is managed by the useVoicePlayback hook.
 * This component only provides the container and handles loading/error states.
 *
 * Keyboard navigation:
 * - ArrowLeft/Right: Seek backward/forward by 5%
 * - Shift+ArrowLeft/Right: Seek backward/forward by 10%
 */
export function WaveformSeeker({
  containerRef,
  state,
  currentTime = 0,
  duration = 0,
  waveformData,
  onSeek,
  className,
}: WaveformSeekerProps): React.ReactElement {
  // Calculate progress percentage for ARIA
  const progressPercent = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;

  // Format time for screen readers (e.g., "1 minute 30 seconds")
  const formatTimeForAria = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const minLabel = mins === 1 ? "minute" : "minutes";
    const secLabel = secs === 1 ? "second" : "seconds";
    if (mins > 0 && secs > 0) {
      return `${mins} ${minLabel} ${secs} ${secLabel}`;
    } else if (mins > 0) {
      return `${mins} ${minLabel}`;
    }
    return `${secs} ${secLabel}`;
  };

  // Handle keyboard seeking
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (!onSeek || (state !== "ready" && state !== "playing")) return;

    const step = event.shiftKey ? 0.1 : 0.05; // 10% with shift, 5% normally

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        onSeek(-step);
        break;
      case "ArrowRight":
        event.preventDefault();
        onSeek(step);
        break;
    }
  };

  return (
    <div className={cn("relative h-10 w-full", className)}>
      {/* Container div ALWAYS exists for WaveSurfer to attach to */}
      <div
        ref={containerRef}
        data-slot="waveform-container"
        className={cn(
          "h-10 w-full",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          // Hide visually when loading or error, but keep in DOM
          (state === "loading" || state === "error") && "invisible"
        )}
        role="slider"
        aria-label="Audio playback position - use arrow keys to seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        aria-valuetext={`${formatTimeForAria(currentTime)} of ${formatTimeForAria(duration)}`}
        tabIndex={state === "ready" || state === "playing" ? 0 : -1}
        onKeyDown={handleKeyDown}
      />

      {/* Loading overlay */}
      {state === "loading" && (
        <div className="absolute inset-0">
          <WaveformDisplaySkeleton className="h-10 w-full" barCount={60} />
        </div>
      )}

      {/* Error overlay */}
      {state === "error" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <WaveformDisplay
            data={waveformData ?? generatePlaceholderWaveform(60)}
            className="h-10 w-full opacity-30"
            barColor="hsl(var(--destructive) / 0.5)"
          />
        </div>
      )}
    </div>
  );
}
