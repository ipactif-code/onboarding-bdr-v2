/**
 * M1: Adaptive Difficulty Engine Contract
 *
 * Implements Vygotsky's Zone of Proximal Development (ZPD) by dynamically
 * adjusting prospect difficulty based on real-time BDR performance.
 */

import { v } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";

// =============================================================================
// TYPES
// =============================================================================

export type EmotionalState =
  | "skeptical"
  | "neutral"
  | "interested"
  | "impressed"
  | "defensive"
  | "frustrated";

/**
 * Performance metrics tracked by M1 (all 0-100 scale)
 */
export interface PerformanceMetrics {
  spinQuality: number; // Quality of SPIN selling questions
  objectionHandling: number; // Response to prospect objections
  talkRatio: number; // BDR vs prospect speaking ratio
  responseTiming: number; // Response speed (ideal ~2s)
  questionDepth: number; // Follow-up question quality
  valueArticulation: number; // Value proposition clarity
  closingSignals: number; // Recognition of buying signals
}

/**
 * Weights for each metric in composite score calculation
 */
export const PERFORMANCE_WEIGHTS: Record<keyof PerformanceMetrics, number> = {
  spinQuality: 0.25,
  objectionHandling: 0.25,
  talkRatio: 0.1,
  responseTiming: 0.1,
  questionDepth: 0.1,
  valueArticulation: 0.1,
  closingSignals: 0.1,
} as const;

/**
 * Difficulty adjustment thresholds
 */
export const DIFFICULTY_THRESHOLDS = {
  /** Composite score above this triggers difficulty increase */
  increaseThreshold: 70,
  /** Composite score below this triggers difficulty decrease */
  decreaseThreshold: 55,
  /** Minimum time (ms) performance must be sustained before adjustment */
  sustainedDurationMs: 120_000, // 2 minutes
  /** Minimum time (ms) between difficulty adjustments */
  cooldownMs: 60_000, // 1 minute
  /** Minimum difficulty adjustment increment */
  minAdjustment: 0.05,
  /** Maximum difficulty adjustment increment */
  maxAdjustment: 0.1,
} as const;

/**
 * Behavior modifiers derived from difficulty level
 */
export interface BehaviorModifiers {
  /** Frequency of objections (0-1) */
  objectionFrequency: number;
  /** Intensity of objections (1-4 scale) */
  objectionIntensity: number;
  /** Rate of interruptions (0-1) */
  interruptionRate: number;
  /** How much info prospect reveals (1-4, 1=guarded, 4=open) */
  infoRevealLevel: number;
  /** Time pressure level (1-4 scale) */
  timePressure: number;
  /** Frequency of competitor mentions (0-1) */
  competitorMentions: number;
}

/**
 * Persona-specific difficulty configuration
 */
export interface PersonaDifficultyConfig {
  min: number; // Minimum difficulty (e.g., 0.3)
  max: number; // Maximum difficulty (e.g., 0.85)
  default: number; // Starting difficulty
}

/**
 * Current difficulty state for a session
 */
export interface DifficultyState {
  currentDifficulty: number;
  lastAdjustmentAt: number | null;
  adjustmentCount: number;
  personaBounds: PersonaDifficultyConfig;
}

/**
 * Result of difficulty adjustment evaluation
 */
export interface DifficultyAdjustmentResult {
  newDifficulty: number;
  adjusted: boolean;
  reason?: DifficultyAdjustmentReason;
  behaviorModifiers: BehaviorModifiers;
}

export type DifficultyAdjustmentReason =
  | "sustained_high"
  | "sustained_low"
  | "cooldown"
  | "bounds"
  | "insufficient_duration"
  | "evaluation_mode";

/**
 * Difficulty event for logging/analytics
 */
export interface DifficultyEvent {
  sessionId: Id<"trainingSessions">;
  userId: Id<"users">;
  timestamp: number;
  previousDifficulty: number;
  newDifficulty: number;
  adjustmentReason: "sustained_high" | "sustained_low" | "session_start" | "manual_override";
  compositeScore: number;
  metricsSnapshot: PerformanceMetrics;
  sustainedDurationMs: number;
  personaDifficultyBounds: { min: number; max: number };
}

// =============================================================================
// VALIDATORS (for Convex functions)
// =============================================================================

export const performanceMetricsValidator = v.object({
  spinQuality: v.number(),
  objectionHandling: v.number(),
  talkRatio: v.number(),
  responseTiming: v.number(),
  questionDepth: v.number(),
  valueArticulation: v.number(),
  closingSignals: v.number(),
});

export const behaviorModifiersValidator = v.object({
  objectionFrequency: v.number(),
  objectionIntensity: v.number(),
  interruptionRate: v.number(),
  infoRevealLevel: v.number(),
  timePressure: v.number(),
  competitorMentions: v.number(),
});

export const difficultyStateValidator = v.object({
  currentDifficulty: v.number(),
  lastAdjustmentAt: v.union(v.number(), v.null()),
  adjustmentCount: v.number(),
  personaBounds: v.object({
    min: v.number(),
    max: v.number(),
    default: v.number(),
  }),
});

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface DifficultyEngineService {
  /**
   * Calculate composite performance score from individual metrics
   * @param metrics - Individual performance metrics (0-100 each)
   * @returns Weighted composite score (0-100)
   */
  calculateCompositeScore(metrics: PerformanceMetrics): number;

  /**
   * Evaluate whether difficulty should be adjusted
   * @param state - Current difficulty state
   * @param compositeScore - Current composite performance score
   * @param sustainedDurationMs - How long performance has been sustained
   * @param isEvaluationMode - Whether session is in evaluation mode
   * @returns Adjustment result with new difficulty and reason
   */
  evaluateAdjustment(
    state: DifficultyState,
    compositeScore: number,
    sustainedDurationMs: number,
    isEvaluationMode: boolean
  ): DifficultyAdjustmentResult;

  /**
   * Calculate behavior modifiers for current difficulty
   * @param difficulty - Current difficulty level (0.1-0.95)
   * @returns Behavior modifiers for Context Builder
   */
  calculateBehaviorModifiers(difficulty: number): BehaviorModifiers;

  /**
   * Initialize difficulty state for new session
   * @param personaConfig - Persona-specific difficulty configuration
   * @returns Initial difficulty state
   */
  initializeState(personaConfig: PersonaDifficultyConfig): DifficultyState;

  /**
   * Create difficulty event for logging
   * @param sessionId - Session ID
   * @param userId - User ID
   * @param previousDifficulty - Difficulty before change
   * @param newDifficulty - Difficulty after change
   * @param reason - Reason for adjustment
   * @param metrics - Performance metrics at time of adjustment
   * @param sustainedDurationMs - Duration of sustained performance
   * @param bounds - Persona difficulty bounds
   * @returns Difficulty event object
   */
  createEvent(
    sessionId: Id<"trainingSessions">,
    userId: Id<"users">,
    previousDifficulty: number,
    newDifficulty: number,
    reason: DifficultyEvent["adjustmentReason"],
    metrics: PerformanceMetrics,
    sustainedDurationMs: number,
    bounds: { min: number; max: number }
  ): DifficultyEvent;
}

// =============================================================================
// PURE FUNCTIONS (Internal Implementation)
// =============================================================================

/**
 * Calculate composite score from metrics
 * Pure function, no side effects
 */
export function calculateCompositeScore(metrics: PerformanceMetrics): number {
  return Object.entries(PERFORMANCE_WEIGHTS).reduce((sum, [key, weight]) => {
    const metricValue = metrics[key as keyof PerformanceMetrics] ?? 0;
    return sum + metricValue * weight;
  }, 0);
}

/**
 * Linear interpolation helper
 */
function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * Math.max(0, Math.min(1, t));
}

/**
 * Calculate behavior modifiers based on difficulty
 * Pure function, no side effects
 */
export function calculateBehaviorModifiers(difficulty: number): BehaviorModifiers {
  // Normalize difficulty to 0-1 range (from 0.1-0.95)
  const t = (difficulty - 0.1) / 0.85;

  return {
    objectionFrequency: lerp(0.2, 0.8, t),
    objectionIntensity: Math.round(lerp(1, 4, t)),
    interruptionRate: lerp(0.05, 0.35, t),
    infoRevealLevel: Math.round(lerp(4, 1, t)), // Inverse: easier = more open
    timePressure: Math.round(lerp(1, 4, t)),
    competitorMentions: lerp(0.1, 0.6, t),
  };
}

/**
 * Evaluate difficulty adjustment
 * Pure function, no side effects
 */
export function evaluateAdjustment(
  state: DifficultyState,
  compositeScore: number,
  sustainedDurationMs: number,
  isEvaluationMode: boolean,
  currentTime: number = Date.now()
): DifficultyAdjustmentResult {
  const { currentDifficulty, lastAdjustmentAt, personaBounds } = state;

  // Evaluation mode: no adjustments
  if (isEvaluationMode) {
    return {
      newDifficulty: currentDifficulty,
      adjusted: false,
      reason: "evaluation_mode",
      behaviorModifiers: calculateBehaviorModifiers(currentDifficulty),
    };
  }

  // Cooldown check
  if (lastAdjustmentAt !== null && currentTime - lastAdjustmentAt < DIFFICULTY_THRESHOLDS.cooldownMs) {
    return {
      newDifficulty: currentDifficulty,
      adjusted: false,
      reason: "cooldown",
      behaviorModifiers: calculateBehaviorModifiers(currentDifficulty),
    };
  }

  // Sustained duration check
  if (sustainedDurationMs < DIFFICULTY_THRESHOLDS.sustainedDurationMs) {
    return {
      newDifficulty: currentDifficulty,
      adjusted: false,
      reason: "insufficient_duration",
      behaviorModifiers: calculateBehaviorModifiers(currentDifficulty),
    };
  }

  let newDifficulty = currentDifficulty;
  let reason: DifficultyAdjustmentReason | undefined;

  // Calculate adjustment based on performance
  const adjustmentAmount = (DIFFICULTY_THRESHOLDS.minAdjustment + DIFFICULTY_THRESHOLDS.maxAdjustment) / 2; // 0.075

  if (compositeScore > DIFFICULTY_THRESHOLDS.increaseThreshold) {
    // Performing well - increase difficulty
    newDifficulty = Math.min(currentDifficulty + adjustmentAmount, personaBounds.max);
    reason = newDifficulty === personaBounds.max ? "bounds" : "sustained_high";
  } else if (compositeScore < DIFFICULTY_THRESHOLDS.decreaseThreshold) {
    // Struggling - decrease difficulty
    newDifficulty = Math.max(currentDifficulty - adjustmentAmount, personaBounds.min);
    reason = newDifficulty === personaBounds.min ? "bounds" : "sustained_low";
  }

  return {
    newDifficulty,
    adjusted: newDifficulty !== currentDifficulty,
    reason,
    behaviorModifiers: calculateBehaviorModifiers(newDifficulty),
  };
}

/**
 * Initialize difficulty state for new session
 */
export function initializeDifficultyState(personaConfig: PersonaDifficultyConfig): DifficultyState {
  return {
    currentDifficulty: personaConfig.default,
    lastAdjustmentAt: null,
    adjustmentCount: 0,
    personaBounds: personaConfig,
  };
}

// =============================================================================
// CONTEXT BUILDER INTEGRATION
// =============================================================================

/**
 * Maps numeric difficulty to Context Builder's DifficultyLevel
 */
export function mapDifficultyToLevel(difficulty: number): "easy" | "medium" | "hard" {
  if (difficulty < 0.4) return "easy";
  if (difficulty < 0.7) return "medium";
  return "hard";
}

/**
 * Format behavior modifiers for Context Builder prompt
 */
export function formatBehaviorModifiersForPrompt(modifiers: BehaviorModifiers): string {
  return `
BEHAVIOR MODIFIERS:
- Objection frequency: ${Math.round(modifiers.objectionFrequency * 100)}% of responses
- Objection intensity: Level ${modifiers.objectionIntensity}/4
- Interruption tendency: ${Math.round(modifiers.interruptionRate * 100)}% chance
- Information sharing: Level ${modifiers.infoRevealLevel}/4 (${modifiers.infoRevealLevel >= 3 ? "open" : "guarded"})
- Time pressure: Level ${modifiers.timePressure}/4
- Competitor mentions: ${Math.round(modifiers.competitorMentions * 100)}% chance
`.trim();
}
