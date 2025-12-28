/**
 * Shared types for VoiceRecorder component family.
 */

/**
 * Recording state union type for state machine.
 */
export type RecordingState = "idle" | "recording" | "paused" | "preview" | "error";

/**
 * Maximum recording duration in seconds (5 minutes).
 */
export const MAX_DURATION_SECONDS = 300;

/**
 * Number of waveform bars to display.
 */
export const WAVEFORM_BAR_COUNT = 40;

/**
 * Props for the VoiceRecorder component.
 */
export interface VoiceRecorderProps {
  /** Callback when user sends the voice message */
  onSend: (
    blob: Blob,
    mimeType: string,
    duration: number,
    waveformData: number[]
  ) => void;
  /** Callback when user cancels recording */
  onCancel: () => void;
  /** Whether the recorder is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for WaveformVisualizer component.
 */
export interface WaveformVisualizerProps {
  /** Waveform amplitude data */
  data: number[];
  /** Whether to animate the waveform */
  isAnimating?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for RecordingTimer component.
 */
export interface RecordingTimerProps {
  /** Current duration in seconds */
  current: number;
  /** Maximum duration in seconds */
  max: number;
  /** Whether recording is paused */
  isPaused: boolean;
}

/**
 * Props for RecordingControls component.
 */
export interface RecordingControlsProps {
  /** Current recording state */
  state: RecordingState;
  /** Whether recording is paused */
  isPaused: boolean;
  /** Whether controls are disabled */
  disabled: boolean;
  /** Start recording callback */
  onStart: () => void;
  /** Stop recording callback */
  onStop: () => void;
  /** Pause recording callback */
  onPause: () => void;
  /** Resume recording callback */
  onResume: () => void;
  /** Cancel recording callback */
  onCancel: () => void;
  /** Send recording callback */
  onSend: () => void;
}

/**
 * Props for AudioPreview component.
 */
export interface AudioPreviewProps {
  /** URL to the audio blob */
  audioUrl: string;
  /** Duration of the recording in seconds */
  duration: number;
  /** Waveform data for visualization */
  waveformData: number[];
}

/**
 * Format duration in seconds to MM:SS string.
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
