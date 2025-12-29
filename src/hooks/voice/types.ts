/**
 * Shared types for voice recording hooks.
 */

/**
 * Options for the useVoiceRecorder hook.
 */
export interface UseVoiceRecorderOptions {
  /**
   * Minimum recording duration in seconds.
   * @default 1
   */
  minDuration?: number;
  /**
   * Maximum recording duration in seconds.
   * @default 300 (5 minutes)
   */
  maxDuration?: number;
  /**
   * Callback fired when max duration is reached and recording auto-stops.
   */
  onMaxDurationReached?: () => void;
}

/**
 * Return type for the useVoiceRecorder hook.
 */
export interface UseVoiceRecorderReturn {
  /** Whether recording is currently in progress */
  isRecording: boolean;
  /** Whether recording is paused */
  isPaused: boolean;
  /** Current recording duration in seconds */
  duration: number;
  /** Recorded audio blob (available after stopping) */
  audioBlob: Blob | null;
  /** Object URL for audio playback (available after stopping) */
  audioUrl: string | null;
  /** Error message if any operation fails */
  error: string | null;
  /** Real-time waveform data for visualization (normalized 0-1 amplitude values) */
  waveformData: number[];
  /** Start recording */
  startRecording: () => Promise<void>;
  /** Stop recording and finalize audio blob */
  stopRecording: () => void;
  /** Pause current recording */
  pauseRecording: () => void;
  /** Resume paused recording */
  resumeRecording: () => void;
  /** Reset all state and release resources */
  resetRecording: () => void;
  /**
   * Get the actual duration from the ref (synchronous, race-condition safe).
   * Use this instead of the `duration` state when sending messages to ensure
   * the correct duration is stored even if user clicks Send immediately after stopping.
   */
  getActualDuration: () => number;
  /** Detected MIME type for recording */
  mimeType: string;
  /** Whether voice recording is supported in this browser */
  isSupported: boolean;
}

/**
 * Return type for the useMediaRecorder hook.
 */
export interface UseMediaRecorderReturn {
  /** MediaRecorder instance ref */
  mediaRecorderRef: React.RefObject<MediaRecorder | null>;
  /** MediaStream ref */
  mediaStreamRef: React.RefObject<MediaStream | null>;
  /** Collected audio chunks */
  audioChunksRef: React.RefObject<Blob[]>;
  /** Recording state */
  state: "inactive" | "recording" | "paused";
  /** Detected MIME type */
  mimeType: string;
  /** Whether MediaRecorder is supported */
  isSupported: boolean;
  /** Start recording with microphone access */
  start: () => Promise<MediaStream>;
  /** Stop recording and return blob */
  stop: () => Blob | null;
  /** Pause recording */
  pause: () => void;
  /** Resume recording */
  resume: () => void;
  /** Clean up all resources */
  cleanup: () => void;
}

/**
 * Return type for the useWaveformAnalyzer hook.
 */
export interface UseWaveformAnalyzerReturn {
  /** Current waveform data (normalized 0-1 values) */
  waveformData: number[];
  /** Start analyzing the audio stream */
  startAnalysis: (stream: MediaStream) => void;
  /** Stop waveform analysis */
  stopAnalysis: () => void;
  /** Pause waveform analysis */
  pauseAnalysis: () => void;
  /** Resume waveform analysis */
  resumeAnalysis: () => void;
  /** Reset waveform data */
  resetWaveform: () => void;
  /** AnalyserNode ref for external access */
  analyserRef: React.RefObject<AnalyserNode | null>;
}
