/**
 * Deepgram STT Service Contract
 *
 * Streaming speech-to-text using Deepgram Nova-2 via EU endpoint.
 * Provides interim results for real-time transcript display and VAD for turn detection.
 */

// =============================================================================
// TYPES
// =============================================================================

export type SupportedLanguage = "fr" | "en" | "it" | "de" | "es";

export interface DeepgramConfig {
  model: "nova-2";
  language: string; // Language code (e.g., "fr", "en-US")
  endpoint: "wss://api-eu.deepgram.com/v1/listen";
  punctuate: boolean;
  smart_format: boolean;
  diarize: boolean;
  endpointing: number; // ms silence before end of turn
  interim_results: boolean;
  vad_events: boolean;
}

export interface TranscriptSegment {
  text: string;
  confidence: number; // 0-1
  startTime: number; // seconds from start
  endTime: number; // seconds from start
  isFinal: boolean;
  words: Array<{
    word: string;
    confidence: number;
    start: number;
    end: number;
  }>;
}

export interface VADEvent {
  type: "speech_started" | "speech_stopped";
  timestamp: number;
}

export interface STTResult {
  segments: TranscriptSegment[];
  finalTranscript: string;
  confidence: number; // Average confidence
  speakingDuration: number; // Total ms of speech
  latency: number; // Time from audio to final transcript
}

export interface STTError {
  code: "connection_failed" | "timeout" | "invalid_audio" | "quota_exceeded";
  message: string;
  retryable: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const DEEPGRAM_CONFIGS: Record<SupportedLanguage, DeepgramConfig> = {
  fr: {
    model: "nova-2",
    language: "fr",
    endpoint: "wss://api-eu.deepgram.com/v1/listen",
    punctuate: true,
    smart_format: true,
    diarize: false,
    endpointing: 500,
    interim_results: true,
    vad_events: true,
  },
  en: {
    model: "nova-2",
    language: "en-US",
    endpoint: "wss://api-eu.deepgram.com/v1/listen",
    punctuate: true,
    smart_format: true,
    diarize: false,
    endpointing: 500,
    interim_results: true,
    vad_events: true,
  },
  it: {
    model: "nova-2",
    language: "it",
    endpoint: "wss://api-eu.deepgram.com/v1/listen",
    punctuate: true,
    smart_format: true,
    diarize: false,
    endpointing: 500,
    interim_results: true,
    vad_events: true,
  },
  de: {
    model: "nova-2",
    language: "de",
    endpoint: "wss://api-eu.deepgram.com/v1/listen",
    punctuate: true,
    smart_format: true,
    diarize: false,
    endpointing: 500,
    interim_results: true,
    vad_events: true,
  },
  es: {
    model: "nova-2",
    language: "es",
    endpoint: "wss://api-eu.deepgram.com/v1/listen",
    punctuate: true,
    smart_format: true,
    diarize: false,
    endpointing: 500,
    interim_results: true,
    vad_events: true,
  },
};

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface DeepgramSTTService {
  /**
   * Initialize streaming connection for a session
   * @param sessionId - Training session ID
   * @param language - Session language
   * @returns Connection ID for the stream
   */
  connect(sessionId: string, language: SupportedLanguage): Promise<string>;

  /**
   * Send audio chunk to stream
   * @param connectionId - Active connection ID
   * @param audioChunk - Raw audio data (PCM 16-bit, 16kHz mono)
   */
  sendAudio(connectionId: string, audioChunk: ArrayBuffer): Promise<void>;

  /**
   * Subscribe to interim transcript updates
   * @param connectionId - Active connection ID
   * @param callback - Called with each interim result
   */
  onInterimTranscript(
    connectionId: string,
    callback: (segment: TranscriptSegment) => void
  ): void;

  /**
   * Subscribe to VAD events
   * @param connectionId - Active connection ID
   * @param callback - Called when speech starts/stops
   */
  onVADEvent(connectionId: string, callback: (event: VADEvent) => void): void;

  /**
   * Get final transcript when turn is complete
   * @param connectionId - Active connection ID
   * @returns Final STT result
   */
  getFinalTranscript(connectionId: string): Promise<STTResult>;

  /**
   * Close streaming connection
   * @param connectionId - Active connection ID
   */
  disconnect(connectionId: string): Promise<void>;

  /**
   * Check service health and EU endpoint availability
   */
  healthCheck(): Promise<boolean>;
}

// =============================================================================
// COST ESTIMATION
// =============================================================================

export const STT_COST = {
  model: "nova-2",
  pricePerMinute: 0.0043, // USD
  minimumBillable: 1, // second
};

export function estimateSTTCost(speakingDurationMs: number): number {
  const minutes = Math.max(speakingDurationMs / 60000, STT_COST.minimumBillable / 60);
  return minutes * STT_COST.pricePerMinute;
}

// =============================================================================
// LATENCY REQUIREMENTS
// =============================================================================

export const STT_LATENCY_REQUIREMENTS = {
  interimResultsMaxMs: 200, // Interim results within 200ms of speech
  finalResultMaxMs: 500, // Final result within 500ms of speech end
  vadDetectionMaxMs: 100, // VAD events within 100ms
};
