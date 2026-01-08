/**
 * Voice Pipeline Orchestration Contract
 *
 * Coordinates the full voice pipeline:
 * User Audio → STT → Guardrails → LLM → TTS → Audio Output
 *
 * Handles streaming, barge-in, graceful degradation, and cost tracking.
 */

import type { SupportedLanguage, TranscriptSegment, VADEvent, STTResult } from "./deepgram";
import type { EmotionalState, ConversationContext, LLMResult, StreamingChunk } from "./anthropic";
import type { VoiceProfile, AudioChunk, TTSResult, PersonaType } from "./cartesia";
import type { GuardrailResult, ViolationRecord } from "./guardrails";
import type { ContextBuildResult, PersonaContext, ScenarioContext, ProductContext } from "./context-builder";

// =============================================================================
// TYPES
// =============================================================================

export type PipelineState =
  | "idle"
  | "listening"
  | "processing"
  | "responding"
  | "interrupted"
  | "error"
  | "completed";

export interface PipelineConfig {
  sessionId: string;
  userId: string;
  organizationId?: string;
  language: SupportedLanguage;
  persona: PersonaContext;
  scenario: ScenarioContext;
  product: ProductContext;
  difficulty: "easy" | "medium" | "hard";
  avatarEnabled: boolean;
  budgetCents: number; // $0.50 = 50 cents
}

export interface TurnMetrics {
  turnNumber: number;
  sttLatencyMs: number;
  guardrailLatencyMs: number;
  llmLatencyMs: number; // Time to first token
  ttsLatencyMs: number; // Time to first chunk
  totalLatencyMs: number;
  userSpeakingDurationMs: number;
  aiAudioDurationMs: number;
  wasInterrupted: boolean;
  interruptedAtMs?: number;
  guardrailTriggered: boolean;
  guardrailLayer?: "pattern" | "embedding" | "llm";
}

export interface SessionMetrics {
  sessionId: string;
  totalTurns: number;
  sessionDurationMs: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  latencyBudgetExceeded: number; // Turns > 800ms
  sttCostCents: number;
  llmCostCents: number;
  ttsCostCents: number;
  avatarCostCents: number;
  totalCostCents: number;
  budgetExceeded: boolean;
  guardrailTriggeredCount: number;
  guardrailBlockedCount: number;
  bargeInCount: number;
  sttFailures: number;
  ttsFailures: number;
  avatarFailures: number;
}

export interface PipelineEvent {
  type:
    | "state_change"
    | "interim_transcript"
    | "final_transcript"
    | "vad_event"
    | "guardrail_result"
    | "llm_chunk"
    | "llm_complete"
    | "audio_chunk"
    | "emotional_state_change"
    | "turn_complete"
    | "error"
    | "barge_in"
    | "cost_alert";
  timestamp: number;
  data: unknown;
}

export interface TranscriptRecord {
  sessionId: string;
  turnNumber: number;
  userTranscript: string;
  userConfidence: number;
  userSpeakingDurationMs: number;
  aiResponse: string;
  aiAudioDurationMs: number;
  emotionalStateBefore: EmotionalState;
  emotionalStateAfter: EmotionalState;
  metrics: TurnMetrics;
  startedAt: number;
  completedAt: number;
}

// =============================================================================
// LATENCY TARGETS
// =============================================================================

export const LATENCY_TARGETS = {
  endToEndP50Ms: 800,
  endToEndP95Ms: 950,
  sttInterimMs: 200,
  llmFirstTokenMs: 300,
  ttsFirstChunkMs: 200,
  guardrailTotalMs: 60,
};

export const COST_THRESHOLDS = {
  alertPercentage: 0.8, // Alert at 80% of budget
  hardStopPercentage: 1.5, // Hard stop at 150% of budget
};

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface VoicePipelineService {
  /**
   * Initialize pipeline for a new session
   * @param config - Pipeline configuration
   * @returns Session ID
   */
  initialize(config: PipelineConfig): Promise<string>;

  /**
   * Start listening for user audio
   * Connects to Deepgram STT and begins streaming
   */
  startListening(): Promise<void>;

  /**
   * Stop listening (user finished speaking)
   * Triggers processing pipeline
   */
  stopListening(): Promise<void>;

  /**
   * Send audio chunk to STT
   * @param audioChunk - Raw audio data (PCM 16-bit, 16kHz mono)
   */
  sendAudio(audioChunk: ArrayBuffer): Promise<void>;

  /**
   * Handle user barge-in (interrupt during AI response)
   * Cancels TTS, stops audio playback, processes new input
   */
  handleBargeIn(): Promise<void>;

  /**
   * Get current pipeline state
   */
  getState(): PipelineState;

  /**
   * Get current emotional state
   */
  getEmotionalState(): EmotionalState;

  /**
   * Get current turn metrics
   */
  getCurrentTurnMetrics(): TurnMetrics | null;

  /**
   * Get session metrics
   */
  getSessionMetrics(): SessionMetrics;

  /**
   * Get conversation history
   */
  getConversationHistory(): TranscriptRecord[];

  /**
   * Subscribe to pipeline events
   * @param callback - Event handler
   * @returns Unsubscribe function
   */
  onEvent(callback: (event: PipelineEvent) => void): () => void;

  /**
   * End the session
   * Disconnects all services, saves final metrics
   */
  endSession(): Promise<SessionMetrics>;

  /**
   * Force stop (emergency shutdown)
   * Used for budget exceeded or critical errors
   */
  forceStop(reason: string): Promise<void>;
}

// =============================================================================
// PIPELINE ORCHESTRATION FLOW
// =============================================================================

/**
 * Standard turn flow:
 *
 * 1. LISTENING
 *    - User speaks into microphone
 *    - Audio chunks sent to Deepgram STT
 *    - Interim transcripts displayed in real-time
 *    - VAD detects speech end
 *
 * 2. PROCESSING
 *    - Final STT result obtained
 *    - Guardrails check input (3 layers, <60ms)
 *    - If blocked: prompt user to rephrase, skip to LISTENING
 *    - Context Builder assembles LLM input
 *    - Claude Haiku generates streaming response
 *
 * 3. RESPONDING
 *    - LLM response streams to Cartesia TTS
 *    - TTS audio chunks played to user
 *    - If avatar enabled: lip-sync video rendered
 *    - Emotional state updated from LLM output
 *
 * 4. BARGE-IN (if user interrupts during RESPONDING)
 *    - VAD detects user speech
 *    - Cancel TTS stream immediately
 *    - Stop audio playback
 *    - Clear pending audio buffer
 *    - Transition to LISTENING for new turn
 *
 * 5. TURN COMPLETE
 *    - Persist transcript to database
 *    - Update session metrics
 *    - Check cost budget
 *    - Transition to LISTENING for next turn
 */

// =============================================================================
// GRACEFUL DEGRADATION
// =============================================================================

export interface DegradationConfig {
  // Avatar degradation
  avatarRetryAttempts: 3;
  avatarFreezeTimeoutMs: 3000;
  avatarFallback: "audio_only";

  // TTS degradation
  ttsRetryAttempts: 2;
  ttsFallback: "text_display";

  // STT degradation
  sttRetryAttempts: 3;
  sttFallback: "retry_prompt";

  // LLM degradation (rare)
  llmRetryAttempts: 2;
  llmFallback: "error_message";
}

export const DEGRADATION_CONFIG: DegradationConfig = {
  avatarRetryAttempts: 3,
  avatarFreezeTimeoutMs: 3000,
  avatarFallback: "audio_only",
  ttsRetryAttempts: 2,
  ttsFallback: "text_display",
  sttRetryAttempts: 3,
  sttFallback: "retry_prompt",
  llmRetryAttempts: 2,
  llmFallback: "error_message",
};

// =============================================================================
// ERROR TYPES
// =============================================================================

export type PipelineErrorCode =
  | "stt_connection_failed"
  | "stt_timeout"
  | "guardrail_blocked"
  | "llm_error"
  | "tts_error"
  | "avatar_error"
  | "budget_exceeded"
  | "session_timeout"
  | "unknown_error";

export interface PipelineError {
  code: PipelineErrorCode;
  message: string;
  component: "stt" | "guardrails" | "llm" | "tts" | "avatar" | "pipeline";
  recoverable: boolean;
  timestamp: number;
}

// =============================================================================
// COST TRACKING
// =============================================================================

export interface CostBreakdown {
  stt: {
    minutesUsed: number;
    costCents: number;
  };
  llm: {
    inputTokens: number;
    outputTokens: number;
    costCents: number;
  };
  tts: {
    charactersUsed: number;
    costCents: number;
  };
  avatar: {
    secondsUsed: number;
    costCents: number;
  };
  total: number;
  budgetRemaining: number;
  percentUsed: number;
}

export function calculateCostBreakdown(
  metrics: SessionMetrics,
  budgetCents: number
): CostBreakdown {
  return {
    stt: {
      minutesUsed: 0, // Calculated from metrics
      costCents: metrics.sttCostCents,
    },
    llm: {
      inputTokens: 0, // Calculated from metrics
      outputTokens: 0,
      costCents: metrics.llmCostCents,
    },
    tts: {
      charactersUsed: 0, // Calculated from metrics
      costCents: metrics.ttsCostCents,
    },
    avatar: {
      secondsUsed: 0, // Calculated from metrics
      costCents: metrics.avatarCostCents,
    },
    total: metrics.totalCostCents,
    budgetRemaining: budgetCents - metrics.totalCostCents,
    percentUsed: (metrics.totalCostCents / budgetCents) * 100,
  };
}
