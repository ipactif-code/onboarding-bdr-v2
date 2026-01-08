/**
 * Cartesia TTS Service Contract
 *
 * Streaming text-to-speech with emotional voice modulation.
 * Supports 5 languages with native-quality voices mapped to personas.
 */

// =============================================================================
// TYPES
// =============================================================================

export type SupportedLanguage = "fr" | "en" | "it" | "de" | "es";

export type EmotionalState =
  | "skeptical"
  | "neutral"
  | "interested"
  | "impressed"
  | "defensive"
  | "frustrated";

export type PersonaGender = "male" | "female";
export type PersonaAge = "senior" | "mid";
export type PersonaType = `${PersonaGender}_${PersonaAge}`;

export interface VoiceProfile {
  voiceId: string;
  name: string;
  baseSpeed: number; // 1.0 = normal
  basePitch: number; // 1.0 = normal
}

export interface VoiceModulation {
  speedMod: number; // Multiplier for base speed
  pitchMod: number; // Multiplier for base pitch
  emotion: string; // Cartesia emotion parameter
}

export interface TTSConfig {
  model: "sonic-2024-10-01";
  outputFormat: "pcm_16000" | "pcm_24000" | "mp3";
  sampleRate: number;
  streaming: boolean;
}

export interface TTSRequest {
  text: string;
  voiceId: string;
  language: SupportedLanguage;
  emotionalState: EmotionalState;
  speed?: number;
  pitch?: number;
}

export interface AudioChunk {
  data: ArrayBuffer; // Raw audio data
  durationMs: number; // Duration of this chunk
  isFinal: boolean; // Last chunk indicator
}

export interface TTSResult {
  totalDurationMs: number;
  characterCount: number;
  latencyToFirstChunk: number; // Milliseconds
  totalLatency: number; // Milliseconds
}

export interface TTSError {
  code: "voice_not_found" | "rate_limited" | "invalid_text" | "timeout" | "api_error";
  message: string;
  retryable: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const TTS_CONFIG: TTSConfig = {
  model: "sonic-2024-10-01",
  outputFormat: "pcm_16000",
  sampleRate: 16000,
  streaming: true,
};

// =============================================================================
// VOICE PROFILES BY LANGUAGE AND PERSONA
// =============================================================================

export const CARTESIA_VOICES: Record<SupportedLanguage, Record<PersonaType, VoiceProfile>> = {
  fr: {
    male_senior: {
      voiceId: "a0e99841-438c-4a64-b679-ae501e7d6091",
      name: "Philippe",
      baseSpeed: 0.95,
      basePitch: 0.98,
    },
    male_mid: {
      voiceId: "ab7c61f5-3daa-47dd-a23b-4ac0aac5f5c3",
      name: "Marc",
      baseSpeed: 1.0,
      basePitch: 1.0,
    },
    female_senior: {
      voiceId: "c2ac25f9-efd4-4f5d-8d5c-4e56b1e44d7c",
      name: "Isabelle",
      baseSpeed: 0.95,
      basePitch: 0.98,
    },
    female_mid: {
      voiceId: "156fb8d2-335b-4950-9cb3-a2d33befec77",
      name: "Julie",
      baseSpeed: 1.0,
      basePitch: 1.02,
    },
  },
  en: {
    male_senior: {
      voiceId: "2ee87190-8f84-4925-97da-e52547f9462c",
      name: "Richard",
      baseSpeed: 0.95,
      basePitch: 0.98,
    },
    male_mid: {
      voiceId: "95856005-0332-41b0-935f-352e296aa0df",
      name: "Michael",
      baseSpeed: 1.0,
      basePitch: 1.0,
    },
    female_senior: {
      voiceId: "00a77add-48d5-4ef6-8157-71e5437b282d",
      name: "Elizabeth",
      baseSpeed: 0.95,
      basePitch: 0.98,
    },
    female_mid: {
      voiceId: "a0e99841-438c-4a64-b679-ae501e7d6091",
      name: "Sarah",
      baseSpeed: 1.0,
      basePitch: 1.02,
    },
  },
  it: {
    male_senior: {
      voiceId: "it-male-senior-placeholder",
      name: "Giovanni",
      baseSpeed: 0.95,
      basePitch: 0.98,
    },
    male_mid: {
      voiceId: "it-male-mid-placeholder",
      name: "Marco",
      baseSpeed: 1.0,
      basePitch: 1.0,
    },
    female_senior: {
      voiceId: "it-female-senior-placeholder",
      name: "Francesca",
      baseSpeed: 0.95,
      basePitch: 0.98,
    },
    female_mid: {
      voiceId: "it-female-mid-placeholder",
      name: "Giulia",
      baseSpeed: 1.0,
      basePitch: 1.02,
    },
  },
  de: {
    male_senior: {
      voiceId: "de-male-senior-placeholder",
      name: "Hans",
      baseSpeed: 0.95,
      basePitch: 0.98,
    },
    male_mid: {
      voiceId: "de-male-mid-placeholder",
      name: "Thomas",
      baseSpeed: 1.0,
      basePitch: 1.0,
    },
    female_senior: {
      voiceId: "de-female-senior-placeholder",
      name: "Ursula",
      baseSpeed: 0.95,
      basePitch: 0.98,
    },
    female_mid: {
      voiceId: "de-female-mid-placeholder",
      name: "Anna",
      baseSpeed: 1.0,
      basePitch: 1.02,
    },
  },
  es: {
    male_senior: {
      voiceId: "es-male-senior-placeholder",
      name: "Carlos",
      baseSpeed: 0.95,
      basePitch: 0.98,
    },
    male_mid: {
      voiceId: "es-male-mid-placeholder",
      name: "Miguel",
      baseSpeed: 1.0,
      basePitch: 1.0,
    },
    female_senior: {
      voiceId: "es-female-senior-placeholder",
      name: "Carmen",
      baseSpeed: 0.95,
      basePitch: 0.98,
    },
    female_mid: {
      voiceId: "es-female-mid-placeholder",
      name: "Elena",
      baseSpeed: 1.0,
      basePitch: 1.02,
    },
  },
};

// =============================================================================
// EMOTIONAL VOICE MODULATION
// =============================================================================

export const EMOTIONAL_MODULATION: Record<EmotionalState, VoiceModulation> = {
  skeptical: {
    speedMod: 1.0,
    pitchMod: 1.0,
    emotion: "neutral",
  },
  neutral: {
    speedMod: 1.0,
    pitchMod: 1.0,
    emotion: "neutral",
  },
  interested: {
    speedMod: 1.05,
    pitchMod: 1.02,
    emotion: "curious",
  },
  impressed: {
    speedMod: 1.08,
    pitchMod: 1.05,
    emotion: "enthusiastic",
  },
  defensive: {
    speedMod: 0.95,
    pitchMod: 0.98,
    emotion: "defensive",
  },
  frustrated: {
    speedMod: 1.15,
    pitchMod: 1.08,
    emotion: "frustrated",
  },
};

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface CartesiaTTSService {
  /**
   * Stream text-to-speech audio
   * @param request - TTS request with text and voice settings
   * @param onChunk - Callback for each audio chunk
   * @returns TTS result with metrics
   */
  streamAudio(
    request: TTSRequest,
    onChunk: (chunk: AudioChunk) => void
  ): Promise<TTSResult>;

  /**
   * Get voice profile for persona
   * @param language - Session language
   * @param gender - Persona gender
   * @param age - Persona age bracket
   * @returns Voice profile for the persona
   */
  getVoiceProfile(
    language: SupportedLanguage,
    gender: PersonaGender,
    age: PersonaAge
  ): VoiceProfile;

  /**
   * Calculate voice parameters with emotional modulation
   * @param baseProfile - Base voice profile
   * @param emotionalState - Current M3 state
   * @returns Adjusted speed and pitch values
   */
  applyEmotionalModulation(
    baseProfile: VoiceProfile,
    emotionalState: EmotionalState
  ): { speed: number; pitch: number; emotion: string };

  /**
   * Cancel active TTS stream (for barge-in)
   * @param streamId - Active stream identifier
   */
  cancelStream(streamId: string): Promise<void>;

  /**
   * Check service health
   */
  healthCheck(): Promise<boolean>;
}

// =============================================================================
// COST ESTIMATION
// =============================================================================

export const TTS_COST = {
  model: "sonic-2024-10-01",
  pricePerThousandChars: 0.01, // USD
};

export function estimateTTSCost(characterCount: number): number {
  return (characterCount / 1000) * TTS_COST.pricePerThousandChars;
}

// Average response: 200-400 characters
// Per-turn cost: ~$0.002-0.004
// 20-30 turns per session: ~$0.04-0.12

// =============================================================================
// LATENCY REQUIREMENTS
// =============================================================================

export const TTS_LATENCY_REQUIREMENTS = {
  firstChunkMaxMs: 200, // First audio chunk within 200ms
  interChunkMaxMs: 50, // Subsequent chunks every 50ms max
};
