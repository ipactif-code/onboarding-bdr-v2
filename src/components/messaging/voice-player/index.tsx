"use client";

import { useRef, useState, useEffect, useCallback, memo } from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useVoicePlayback } from "@/hooks/voice";

import {
  PlayPauseButton,
  TimeDisplay,
  SpeedSelector,
} from "./playback-controls";
import { WaveformSeeker } from "./waveform-seeker";
import { TranscriptionDisplay } from "./transcription-display";
import type { VoicePlayerProps, PlayerState, PlaybackSpeed } from "./types";

// ============================================================================
// VoicePlayerUnavailable Component
// ============================================================================

/**
 * Fallback component when audio URL is unavailable.
 * Displayed when audioUrl is null/empty to prevent WaveSurfer hanging.
 */
function VoicePlayerUnavailable({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      data-slot="voice-player"
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground",
        className
      )}
      role="region"
      aria-label="Voice message unavailable"
    >
      <AlertCircle className="size-4" aria-hidden="true" />
      <span>Audio file unavailable</span>
    </div>
  );
}

// ============================================================================
// VoicePlayer Component
// ============================================================================

/**
 * VoicePlayer component for playing voice messages with waveform visualization.
 *
 * Features:
 * - WaveSurfer.js integration for audio playback and waveform display
 * - Playback speed controls (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x)
 * - Seeking by clicking on waveform
 * - Transcription display with loading states
 * - Editable transcription support
 * - Graceful handling of unavailable audio (null/empty audioUrl)
 *
 * @example
 * ```tsx
 * <VoicePlayer
 *   audioUrl="https://example.com/audio.mp3"
 *   duration={154}
 *   transcription="This is the transcribed text..."
 *   transcriptionStatus="completed"
 *   waveformData={[0.2, 0.5, 0.8, ...]}
 *   onTranscriptionEdit={(text) => updateTranscription(text)}
 * />
 * ```
 */
function VoicePlayerComponent({
  audioUrl,
  duration,
  transcription,
  transcriptionStatus = "completed",
  waveformData,
  onTranscriptionEdit,
  onTranscriptionRetry,
  onTranscriptionRequest,
  className,
}: VoicePlayerProps): React.ReactElement {
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState>("loading");
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [isEditingTranscription, setIsEditingTranscription] = useState(false);
  const [editedTranscription, setEditedTranscription] = useState(
    transcription ?? ""
  );

  // Track previous state to only announce when it actually changes
  const prevStateRef = useRef<{ state: PlayerState; isPlaying: boolean } | null>(null);
  const [liveRegionAnnouncement, setLiveRegionAnnouncement] = useState<string>("");
  const announcementTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { isPlaying, currentTime, detectedDuration, play, pause, setPlaybackRate } =
    useVoicePlayback({
      containerRef: waveformContainerRef,
      audioUrl,
      waveformData,
      duration,
      onReady: () => setPlayerState("ready"),
      onError: () => setPlayerState("error"),
      onFinish: () => setPlayerState("ready"),
    });

  // Handle play/pause toggle
  const handlePlayPause = useCallback(async (): Promise<void> => {
    if (isPlaying) {
      pause();
    } else {
      await play();
      setPlayerState("playing");
    }
  }, [isPlaying, play, pause]);

  // Handle playback speed change
  const handleSpeedChange = useCallback(
    (speed: PlaybackSpeed): void => {
      setPlaybackSpeed(speed);
      setPlaybackRate(speed);
    },
    [setPlaybackRate]
  );

  // Handle transcription edit
  const handleSaveTranscription = useCallback((): void => {
    if (onTranscriptionEdit && editedTranscription.trim() !== transcription) {
      onTranscriptionEdit(editedTranscription.trim());
    }
    setIsEditingTranscription(false);
  }, [editedTranscription, transcription, onTranscriptionEdit]);

  const handleCancelEdit = useCallback((): void => {
    setEditedTranscription(transcription ?? "");
    setIsEditingTranscription(false);
  }, [transcription]);

  // Update edited transcription when prop changes
  useEffect(() => {
    if (!isEditingTranscription) {
      setEditedTranscription(transcription ?? "");
    }
  }, [transcription, isEditingTranscription]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      if (event.key === " " && !isEditingTranscription) {
        event.preventDefault();
        handlePlayPause();
      }
    },
    [handlePlayPause, isEditingTranscription]
  );

  // Handle retry for error state
  const handleRetry = useCallback((): void => {
    setPlayerState("loading");
  }, []);

  // Only announce when player state or playing status actually changes
  useEffect(() => {
    const currentState = { state: playerState, isPlaying };
    const prevState = prevStateRef.current;

    // Skip if state hasn't actually changed
    if (
      prevState &&
      prevState.state === currentState.state &&
      prevState.isPlaying === currentState.isPlaying
    ) {
      return;
    }

    prevStateRef.current = currentState;

    // Clear any pending announcement
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
    }

    // Debounce announcements by 100ms to prevent rapid-fire messages
    announcementTimeoutRef.current = setTimeout(() => {
      // Determine the announcement text based on state
      let announcement = "";

      if (playerState === "error") {
        announcement = "Error loading audio";
      } else if (playerState === "playing" || isPlaying) {
        announcement = "Playing";
      } else if (playerState === "ready" && !isPlaying) {
        announcement = "Paused";
      }
      // Note: We omit the "Loading audio..." announcement as it's implied by
      // the player state and causes unnecessary verbosity

      setLiveRegionAnnouncement(announcement);
    }, 100);

    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, [playerState, isPlaying]);

  return (
    <div
      data-slot="voice-player"
      className={cn(
        "rounded-lg border border-border bg-card p-3",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className
      )}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Voice message player"
      tabIndex={0}
    >
      {/* Screen reader announcements for state changes - only announces actual changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveRegionAnnouncement}
      </div>

      {/* Main player controls */}
      <div className="flex items-center gap-3">
        {/* Play/Pause button */}
        <PlayPauseButton
          state={playerState}
          isPlaying={isPlaying}
          onClick={handlePlayPause}
          onRetry={handleRetry}
        />

        {/* Waveform display - uses detectedDuration from WaveSurfer for accuracy */}
        <div className="relative flex-1">
          <WaveformSeeker
            containerRef={waveformContainerRef}
            state={playerState}
            currentTime={currentTime}
            duration={detectedDuration}
            waveformData={waveformData}
          />
        </div>

        {/* Time display - uses detectedDuration from WaveSurfer for accuracy */}
        <TimeDisplay
          currentTime={currentTime}
          duration={detectedDuration}
          isLoading={playerState === "loading"}
        />

        {/* Speed selector */}
        <SpeedSelector
          currentSpeed={playbackSpeed}
          onSpeedChange={handleSpeedChange}
          disabled={playerState !== "ready" && playerState !== "playing"}
        />
      </div>

      {/* Transcription section */}
      <TranscriptionDisplay
        transcription={transcription}
        transcriptionStatus={transcriptionStatus}
        isEditing={isEditingTranscription}
        editedValue={editedTranscription}
        onEditStart={() => setIsEditingTranscription(true)}
        onEditChange={setEditedTranscription}
        onEditSave={handleSaveTranscription}
        onEditCancel={handleCancelEdit}
        onRetry={onTranscriptionRetry}
        onRequestTranscription={onTranscriptionRequest}
        canEdit={!!onTranscriptionEdit}
      />
    </div>
  );
}

// Memoize the inner component for performance
const MemoizedVoicePlayer = memo(VoicePlayerComponent);

/**
 * VoicePlayer wrapper that handles null/empty audioUrl gracefully.
 * This prevents WaveSurfer from hanging on empty strings.
 */
export function VoicePlayer(props: VoicePlayerProps): React.ReactElement {
  // Defensive check: render unavailable state if audioUrl is missing
  if (!props.audioUrl) {
    return <VoicePlayerUnavailable className={props.className} />;
  }

  return <MemoizedVoicePlayer {...props} />;
}

// Re-export skeleton and types for convenience
export { VoicePlayerSkeleton } from "./voice-player-skeleton";
export type { VoicePlayerProps, VoicePlayerSkeletonProps } from "./types";
