/**
 * Voice hooks for audio capture, playback, sending, and waveform visualization.
 */

// Main orchestrator hooks
export { useVoiceRecorder } from "./use-voice-recorder";
export { useVoicePlayback } from "./use-voice-playback";
export { useVoiceSender } from "./use-voice-sender";

// Sub-hooks (for advanced usage)
export { useMediaRecorder } from "./use-media-recorder";
export { useWaveformAnalyzer } from "./use-waveform-analyzer";

// Types
export type {
  UseVoiceRecorderOptions,
  UseVoiceRecorderReturn,
  UseMediaRecorderReturn,
  UseWaveformAnalyzerReturn,
} from "./types";

export type {
  UseVoiceSenderOptions,
  UseVoiceSenderReturn,
} from "./use-voice-sender";

export type {
  UseVoicePlaybackOptions,
  UseVoicePlaybackReturn,
} from "@/components/messaging/voice-player/types";
