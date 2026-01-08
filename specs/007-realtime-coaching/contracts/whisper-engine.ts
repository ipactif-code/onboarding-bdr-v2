/**
 * M2: Coaching Whisper Engine Contract
 *
 * Real-time micro-advice system that displays coaching hints to BDRs
 * during practice sessions without breaking conversation flow.
 */

import { v } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Supported languages for whisper messages
 */
export type SupportedLanguage = "fr" | "en" | "it" | "de" | "es";

/**
 * Whisper rule identifiers (15 total rules)
 */
export type WhisperRuleId =
  | "talk_ratio_high"
  | "spin_stuck_situation"
  | "spin_missing_implication"
  | "objection_detected"
  | "competitor_mentioned"
  | "buying_signal"
  | "voice_confidence_low"
  | "speaking_too_fast"
  | "excellent_spin"
  | "racc_missing_reframe"
  | "racc_missing_confirm"
  | "silence_too_long"
  | "price_mentioned_early"
  | "no_discovery_questions"
  | "meeting_not_proposed";

/**
 * Whisper priority categories
 */
export type WhisperPriority = "racc" | "normal" | "positive";

/**
 * Whisper message configuration by language
 */
export interface WhisperMessages {
  fr: string;
  en: string;
  it: string;
  de: string;
  es: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Global whisper configuration (FR-002, FR-003, FR-004)
 */
export const WHISPER_CONFIG = {
  maxWhispersPerMinute: 4,
  globalCooldownMs: 15_000, // 15 seconds
  displayDurationMs: 5_000, // 5 seconds
  disabledInEvaluationMode: true,
  triggerEvaluationBudgetMs: 100, // FR-010: 100ms budget
} as const;

/**
 * Rule-specific cooldowns in milliseconds
 */
export const WHISPER_COOLDOWNS: Record<WhisperRuleId, number> = {
  talk_ratio_high: 180_000, // 3 minutes
  spin_stuck_situation: 120_000, // 2 minutes
  spin_missing_implication: 150_000, // 2.5 minutes
  objection_detected: 60_000, // 1 minute
  competitor_mentioned: 90_000, // 1.5 minutes
  buying_signal: 120_000, // 2 minutes
  voice_confidence_low: 120_000, // 2 minutes
  speaking_too_fast: 90_000, // 1.5 minutes
  excellent_spin: 180_000, // 3 minutes
  racc_missing_reframe: 60_000, // 1 minute
  racc_missing_confirm: 60_000, // 1 minute
  silence_too_long: 45_000, // 45 seconds
  price_mentioned_early: 120_000, // 2 minutes
  no_discovery_questions: 180_000, // 3 minutes
  meeting_not_proposed: 300_000, // 5 minutes
} as const;

/**
 * Priority scores (higher = more important)
 * RACC whispers: 80-100
 * Normal corrective: 40-60
 * Positive reinforcement: 20-30
 */
export const WHISPER_PRIORITIES: Record<WhisperRuleId, number> = {
  racc_missing_reframe: 100,
  racc_missing_confirm: 95,
  objection_detected: 90,
  talk_ratio_high: 60,
  spin_stuck_situation: 55,
  spin_missing_implication: 55,
  voice_confidence_low: 50,
  speaking_too_fast: 50,
  silence_too_long: 50,
  price_mentioned_early: 45,
  no_discovery_questions: 45,
  meeting_not_proposed: 40,
  competitor_mentioned: 40,
  buying_signal: 25,
  excellent_spin: 20,
} as const;

/**
 * Whisper messages in 5 languages
 */
export const WHISPER_MESSAGES: Record<WhisperRuleId, WhisperMessages> = {
  talk_ratio_high: {
    fr: "⚠️ Tu parles trop. Pose une question ouverte.",
    en: "⚠️ You're talking too much. Ask an open question.",
    it: "⚠️ Stai parlando troppo. Fai una domanda aperta.",
    de: "⚠️ Du redest zu viel. Stelle eine offene Frage.",
    es: "⚠️ Estás hablando demasiado. Haz una pregunta abierta.",
  },
  spin_stuck_situation: {
    fr: "💡 Tu poses beaucoup de questions Situation. Passe aux Problèmes.",
    en: "💡 Too many Situation questions. Move to Problems.",
    it: "💡 Troppe domande di Situazione. Passa ai Problemi.",
    de: "💡 Zu viele Situationsfragen. Gehe zu Problemen über.",
    es: "💡 Demasiadas preguntas de Situación. Pasa a los Problemas.",
  },
  spin_missing_implication: {
    fr: "💡 Tu explores bien les problèmes. Et les conséquences ?",
    en: "💡 Good problem exploration. What about implications?",
    it: "💡 Buona esplorazione dei problemi. E le implicazioni?",
    de: "💡 Gute Problemerkundung. Was sind die Auswirkungen?",
    es: "💡 Buena exploración de problemas. ¿Y las implicaciones?",
  },
  objection_detected: {
    fr: "🎯 Objection détectée ! Utilise RACC : Reformule avec empathie.",
    en: "🎯 Objection detected! Use RACC: Reframe with empathy.",
    it: "🎯 Obiezione rilevata! Usa RACC: Riformula con empatia.",
    de: "🎯 Einwand erkannt! Nutze RACC: Reformuliere mit Empathie.",
    es: "🎯 ¡Objeción detectada! Usa RACC: Reformula con empatía.",
  },
  competitor_mentioned: {
    fr: "🔍 Concurrent mentionné. Demande ce qu'ils apprécient chez eux.",
    en: "🔍 Competitor mentioned. Ask what they like about them.",
    it: "🔍 Concorrente menzionato. Chiedi cosa apprezzano di loro.",
    de: "🔍 Wettbewerber erwähnt. Frage, was sie an ihnen schätzen.",
    es: "🔍 Competidor mencionado. Pregunta qué les gusta de ellos.",
  },
  buying_signal: {
    fr: "✨ Signal d'achat détecté ! Propose une prochaine étape concrète.",
    en: "✨ Buying signal detected! Propose a concrete next step.",
    it: "✨ Segnale d'acquisto rilevato! Proponi un passo concreto.",
    de: "✨ Kaufsignal erkannt! Schlage einen konkreten nächsten Schritt vor.",
    es: "✨ ¡Señal de compra detectada! Propón un siguiente paso concreto.",
  },
  voice_confidence_low: {
    fr: "🧘 Respire et ralentis. Tu maîtrises ton sujet.",
    en: "🧘 Breathe and slow down. You know your stuff.",
    it: "🧘 Respira e rallenta. Conosci la materia.",
    de: "🧘 Atme und verlangsame. Du kennst dein Thema.",
    es: "🧘 Respira y reduce la velocidad. Dominas el tema.",
  },
  speaking_too_fast: {
    fr: "🐢 Ralentis ! Tu parles trop vite.",
    en: "🐢 Slow down! You're speaking too fast.",
    it: "🐢 Rallenta! Stai parlando troppo veloce.",
    de: "🐢 Langsamer! Du sprichst zu schnell.",
    es: "🐢 ¡Más despacio! Estás hablando muy rápido.",
  },
  excellent_spin: {
    fr: "🌟 Excellente progression SPIN ! Continue comme ça.",
    en: "🌟 Excellent SPIN progression! Keep it up.",
    it: "🌟 Eccellente progressione SPIN! Continua così.",
    de: "🌟 Ausgezeichnete SPIN-Progression! Weiter so.",
    es: "🌟 ¡Excelente progresión SPIN! Sigue así.",
  },
  racc_missing_reframe: {
    fr: "⚠️ Tu n'as pas reformulé l'objection avec empathie.",
    en: "⚠️ You didn't reframe the objection with empathy.",
    it: "⚠️ Non hai riformulato l'obiezione con empatia.",
    de: "⚠️ Du hast den Einwand nicht empathisch reformuliert.",
    es: "⚠️ No reformulaste la objeción con empatía.",
  },
  racc_missing_confirm: {
    fr: "⚠️ N'oublie pas de confirmer que l'objection est résolue.",
    en: "⚠️ Don't forget to confirm the objection is resolved.",
    it: "⚠️ Non dimenticare di confermare che l'obiezione è risolta.",
    de: "⚠️ Vergiss nicht zu bestätigen, dass der Einwand gelöst ist.",
    es: "⚠️ No olvides confirmar que la objeción está resuelta.",
  },
  silence_too_long: {
    fr: "💬 8 secondes de silence. Relance la conversation.",
    en: "💬 8 seconds of silence. Re-engage the conversation.",
    it: "💬 8 secondi di silenzio. Riprendi la conversazione.",
    de: "💬 8 Sekunden Stille. Belebe das Gespräch wieder.",
    es: "💬 8 segundos de silencio. Retoma la conversación.",
  },
  price_mentioned_early: {
    fr: "💰 Prix mentionné trop tôt ! Établis d'abord la valeur.",
    en: "💰 Price mentioned too early! Establish value first.",
    it: "💰 Prezzo menzionato troppo presto! Stabilisci prima il valore.",
    de: "💰 Preis zu früh genannt! Etabliere zuerst den Wert.",
    es: "💰 ¡Precio mencionado muy pronto! Establece primero el valor.",
  },
  no_discovery_questions: {
    fr: "❓ 5 minutes sans question de découverte. Pose une question !",
    en: "❓ 5 minutes without discovery questions. Ask a question!",
    it: "❓ 5 minuti senza domande di scoperta. Fai una domanda!",
    de: "❓ 5 Minuten ohne Entdeckungsfragen. Stelle eine Frage!",
    es: "❓ 5 minutos sin preguntas de descubrimiento. ¡Haz una pregunta!",
  },
  meeting_not_proposed: {
    fr: "📅 80% de l'appel écoulé. Propose un prochain rdv !",
    en: "📅 80% of call elapsed. Propose a follow-up meeting!",
    it: "📅 80% della chiamata trascorsa. Proponi un incontro!",
    de: "📅 80% des Gesprächs vorbei. Schlage ein Folgemeeting vor!",
    es: "📅 80% de la llamada transcurrida. ¡Propón una reunión!",
  },
} as const;

// =============================================================================
// TRIGGER CONDITIONS
// =============================================================================

/**
 * Trigger condition definition
 */
export interface WhisperTriggerCondition {
  metricType: string;
  operator: "gt" | "lt" | "gte" | "lte" | "eq" | "between";
  threshold: number;
  thresholdMax?: number;
  sustainedDurationMs?: number;
}

/**
 * Trigger conditions for each whisper rule
 */
export const WHISPER_TRIGGERS: Record<WhisperRuleId, WhisperTriggerCondition> = {
  talk_ratio_high: {
    metricType: "talk_ratio",
    operator: "gt",
    threshold: 60,
    sustainedDurationMs: 120_000, // 2 minutes
  },
  spin_stuck_situation: {
    metricType: "consecutive_situation_questions",
    operator: "gte",
    threshold: 3,
  },
  spin_missing_implication: {
    metricType: "problem_without_implication",
    operator: "eq",
    threshold: 1, // Boolean-like: 1 = condition met
    sustainedDurationMs: 180_000, // 3 minutes
  },
  objection_detected: {
    metricType: "objection_detected",
    operator: "eq",
    threshold: 1,
  },
  competitor_mentioned: {
    metricType: "competitor_mentioned",
    operator: "eq",
    threshold: 1,
  },
  buying_signal: {
    metricType: "buying_signal_detected",
    operator: "eq",
    threshold: 1,
  },
  voice_confidence_low: {
    metricType: "voice_confidence",
    operator: "lt",
    threshold: 0.35,
    sustainedDurationMs: 30_000, // 30 seconds
  },
  speaking_too_fast: {
    metricType: "pace_wpm",
    operator: "gt",
    threshold: 180,
    sustainedDurationMs: 20_000, // 20 seconds
  },
  excellent_spin: {
    metricType: "spin_progression",
    operator: "gte",
    threshold: 0.85,
  },
  racc_missing_reframe: {
    metricType: "objection_without_empathy",
    operator: "eq",
    threshold: 1,
  },
  racc_missing_confirm: {
    metricType: "response_without_confirm",
    operator: "eq",
    threshold: 1,
  },
  silence_too_long: {
    metricType: "bdr_silence_ms",
    operator: "gt",
    threshold: 8000, // 8 seconds
  },
  price_mentioned_early: {
    metricType: "price_before_value",
    operator: "eq",
    threshold: 1,
  },
  no_discovery_questions: {
    metricType: "time_without_questions_ms",
    operator: "gt",
    threshold: 300_000, // 5 minutes
  },
  meeting_not_proposed: {
    metricType: "call_progress_no_next_step",
    operator: "eq",
    threshold: 1, // >80% call, no next step
  },
} as const;

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Current whisper state for a session (client-side tracking)
 */
export interface WhisperState {
  lastWhisperAt: number | null;
  whispersInLastMinute: number[];
  ruleCooldowns: Map<WhisperRuleId, number>;
  totalWhispersShown: number;
  isEnabled: boolean;
  language: SupportedLanguage;
}

/**
 * Input metrics for whisper evaluation
 */
export interface WhisperEvaluationInput {
  sessionId: Id<"trainingSessions">;
  userId: Id<"users">;
  sessionMode: "practice" | "evaluation";
  language: SupportedLanguage;
  currentTime: number;

  // Metrics from various sources
  talkRatio?: number; // From M1
  spinProgression?: number; // From M1
  consecutiveSituationQuestions?: number; // From transcript analysis
  problemWithoutImplication?: boolean; // From transcript analysis
  objectionDetected?: boolean; // From transcript analysis
  objectionWithoutEmpathy?: boolean; // From RACC analysis
  responseWithoutConfirm?: boolean; // From RACC analysis
  competitorMentioned?: boolean; // From transcript analysis
  buyingSignalDetected?: boolean; // From transcript analysis
  voiceConfidence?: number; // From M6
  paceWpm?: number; // From M6
  bdrSilenceMs?: number; // From audio analysis
  priceBeforeValue?: boolean; // From transcript analysis
  timeWithoutQuestionsMs?: number; // From transcript analysis
  callProgressNoNextStep?: boolean; // From session progress
}

/**
 * Result of whisper evaluation
 */
export interface WhisperEvaluationResult {
  shouldDisplay: boolean;
  whisper?: {
    ruleId: WhisperRuleId;
    message: string;
    priority: WhisperPriority;
    displayDurationMs: number;
  };
  reason?: WhisperSkipReason;
  suppressedWhispers?: WhisperRuleId[]; // Lower priority whispers that were skipped
  evaluationLatencyMs: number;
}

export type WhisperSkipReason =
  | "evaluation_mode"
  | "global_cooldown"
  | "rule_cooldown"
  | "rate_limit"
  | "no_trigger_met";

/**
 * Whisper event for logging
 */
export interface WhisperEvent {
  sessionId: Id<"trainingSessions">;
  userId: Id<"users">;
  timestamp: number;
  ruleId: WhisperRuleId;
  messageLanguage: SupportedLanguage;
  messageContent: string;
  priority: WhisperPriority;
  ruleCooldownMs: number;
  triggerToDisplayLatencyMs: number;
  triggerContext?: {
    talkRatio?: number;
    spinProgression?: number;
    confidenceScore?: number;
    paceWpm?: number;
    silenceDurationMs?: number;
  };
  wasSuperseded: boolean;
  supersededBy?: string;
}

// =============================================================================
// VALIDATORS
// =============================================================================

export const whisperRuleIdValidator = v.union(
  v.literal("talk_ratio_high"),
  v.literal("spin_stuck_situation"),
  v.literal("spin_missing_implication"),
  v.literal("objection_detected"),
  v.literal("competitor_mentioned"),
  v.literal("buying_signal"),
  v.literal("voice_confidence_low"),
  v.literal("speaking_too_fast"),
  v.literal("excellent_spin"),
  v.literal("racc_missing_reframe"),
  v.literal("racc_missing_confirm"),
  v.literal("silence_too_long"),
  v.literal("price_mentioned_early"),
  v.literal("no_discovery_questions"),
  v.literal("meeting_not_proposed")
);

export const whisperPriorityValidator = v.union(
  v.literal("racc"),
  v.literal("normal"),
  v.literal("positive")
);

export const supportedLanguageValidator = v.union(
  v.literal("fr"),
  v.literal("en"),
  v.literal("it"),
  v.literal("de"),
  v.literal("es")
);

export const whisperEventValidator = v.object({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  timestamp: v.number(),
  ruleId: whisperRuleIdValidator,
  messageLanguage: supportedLanguageValidator,
  messageContent: v.string(),
  priority: whisperPriorityValidator,
  ruleCooldownMs: v.number(),
  triggerToDisplayLatencyMs: v.number(),
  triggerContext: v.optional(
    v.object({
      talkRatio: v.optional(v.number()),
      spinProgression: v.optional(v.number()),
      confidenceScore: v.optional(v.number()),
      paceWpm: v.optional(v.number()),
      silenceDurationMs: v.optional(v.number()),
    })
  ),
  wasSuperseded: v.boolean(),
  supersededBy: v.optional(v.string()),
});

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Get priority category from rule ID
 */
export function getWhisperPriority(ruleId: WhisperRuleId): WhisperPriority {
  const score = WHISPER_PRIORITIES[ruleId];
  if (score >= 80) return "racc";
  if (score >= 40) return "normal";
  return "positive";
}

/**
 * Initialize whisper state for a new session
 */
export function initializeWhisperState(
  isEnabled: boolean,
  language: SupportedLanguage
): WhisperState {
  return {
    lastWhisperAt: null,
    whispersInLastMinute: [],
    ruleCooldowns: new Map(),
    totalWhispersShown: 0,
    isEnabled,
    language,
  };
}

/**
 * Check if global cooldown is active
 */
export function isGlobalCooldownActive(
  lastWhisperAt: number | null,
  currentTime: number
): boolean {
  if (lastWhisperAt === null) return false;
  return currentTime - lastWhisperAt < WHISPER_CONFIG.globalCooldownMs;
}

/**
 * Check if rate limit is reached
 */
export function isRateLimitReached(
  whispersInLastMinute: number[],
  currentTime: number
): boolean {
  const oneMinuteAgo = currentTime - 60_000;
  const recentWhispers = whispersInLastMinute.filter((t) => t > oneMinuteAgo);
  return recentWhispers.length >= WHISPER_CONFIG.maxWhispersPerMinute;
}

/**
 * Check if rule-specific cooldown is active
 */
export function isRuleCooldownActive(
  ruleCooldowns: Map<WhisperRuleId, number>,
  ruleId: WhisperRuleId,
  currentTime: number
): boolean {
  const lastTriggered = ruleCooldowns.get(ruleId);
  if (!lastTriggered) return false;
  return currentTime - lastTriggered < WHISPER_COOLDOWNS[ruleId];
}

/**
 * Get whisper message for language
 */
export function getWhisperMessage(
  ruleId: WhisperRuleId,
  language: SupportedLanguage
): string {
  return WHISPER_MESSAGES[ruleId][language];
}

/**
 * Sort whispers by priority (highest first)
 */
export function sortByPriority(ruleIds: WhisperRuleId[]): WhisperRuleId[] {
  return [...ruleIds].sort(
    (a, b) => WHISPER_PRIORITIES[b] - WHISPER_PRIORITIES[a]
  );
}

/**
 * Update whisper state after displaying a whisper
 */
export function updateWhisperState(
  state: WhisperState,
  ruleId: WhisperRuleId,
  currentTime: number
): WhisperState {
  const oneMinuteAgo = currentTime - 60_000;
  const newWhispersInLastMinute = [
    ...state.whispersInLastMinute.filter((t) => t > oneMinuteAgo),
    currentTime,
  ];

  const newCooldowns = new Map(state.ruleCooldowns);
  newCooldowns.set(ruleId, currentTime);

  return {
    ...state,
    lastWhisperAt: currentTime,
    whispersInLastMinute: newWhispersInLastMinute,
    ruleCooldowns: newCooldowns,
    totalWhispersShown: state.totalWhispersShown + 1,
  };
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface WhisperEngineService {
  /**
   * Evaluate all whisper triggers and return the highest priority whisper to display
   * Must complete within 100ms (FR-010)
   */
  evaluateWhispers(
    input: WhisperEvaluationInput,
    state: WhisperState
  ): WhisperEvaluationResult;

  /**
   * Record a whisper event
   */
  recordWhisperEvent(event: WhisperEvent): Promise<void>;

  /**
   * Get whisper statistics for a session
   */
  getSessionWhisperStats(
    sessionId: Id<"trainingSessions">
  ): Promise<{
    totalShown: number;
    byRule: Record<WhisperRuleId, number>;
    byPriority: Record<WhisperPriority, number>;
    averageLatencyMs: number;
  }>;
}
