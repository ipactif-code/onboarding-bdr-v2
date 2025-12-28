/**
 * Shared types for VoicePlayer components.
 */

import type { RefObject } from "react";

// Note: RefObject is used by UseVoicePlaybackOptions below

// ============================================================================
// Player State Types
// ============================================================================

export type PlayerState = "loading" | "ready" | "playing" | "error";

// Available playback speed options
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

// ============================================================================
// Component Props Types
// ============================================================================

export interface VoicePlayerProps {
  /** URL of the audio file to play */
  audioUrl: string;
  /** Duration of the audio in seconds */
  duration: number;
  /** Transcription text of the voice message */
  transcription?: string | null;
  /** Current status of the transcription process */
  transcriptionStatus?: "pending" | "processing" | "completed" | "failed";
  /** Pre-computed waveform data for instant display (normalized 0-1 values) */
  waveformData?: number[];
  /** Callback when transcription is edited */
  onTranscriptionEdit?: (newTranscription: string) => void;
  /** Callback when transcription retry is requested */
  onTranscriptionRetry?: () => void;
  /** Callback when transcription is requested (on-demand) */
  onTranscriptionRequest?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export interface TranscriptionDisplayProps {
  /** Transcription text */
  transcription?: string | null;
  /** Current status of the transcription process */
  transcriptionStatus?: "pending" | "processing" | "completed" | "failed";
  /** Whether transcription is being edited */
  isEditing: boolean;
  /** Current edited value */
  editedValue: string;
  /** Handler to start editing */
  onEditStart: () => void;
  /** Handler for edit value changes */
  onEditChange: (value: string) => void;
  /** Handler to save edits */
  onEditSave: () => void;
  /** Handler to cancel editing */
  onEditCancel: () => void;
  /** Handler to retry transcription */
  onRetry?: () => void;
  /** Handler to request transcription (on-demand) */
  onRequestTranscription?: () => void;
  /** Whether editing is allowed */
  canEdit: boolean;
}

export interface VoicePlayerSkeletonProps {
  /** Show transcription skeleton */
  showTranscription?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Hook Types
// ============================================================================

export interface UseVoicePlaybackOptions {
  /** Ref to the container element for WaveSurfer */
  containerRef: RefObject<HTMLDivElement | null>;
  /** URL of the audio file to play */
  audioUrl: string;
  /** Pre-computed waveform data */
  waveformData?: number[];
  /** Duration of the audio in seconds */
  duration: number;
  /** Callback when audio is ready */
  onReady?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Callback on time update */
  onTimeUpdate?: (currentTime: number) => void;
  /** Callback when playback finishes */
  onFinish?: () => void;
}

export interface UseVoicePlaybackReturn {
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Current playback time in seconds */
  currentTime: number;
  /** Start or resume playback */
  play: () => Promise<void>;
  /** Pause playback */
  pause: () => void;
  /** Seek to a position (0-1 progress) */
  seekTo: (progress: number) => void;
  /** Set playback rate */
  setPlaybackRate: (rate: number) => void;
}
