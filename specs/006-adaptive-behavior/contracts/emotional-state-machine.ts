/**
 * M3: Emotional State Machine Contract
 *
 * Manages 6 emotional states with probabilistic transitions based on
 * BDR actions, affecting voice tone and conversation behavior.
 */

import { v } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";

// =============================================================================
// TYPES
// =============================================================================

/**
 * The 6 emotional states the prospect can be in
 */
export type EmotionalState =
  | "skeptical"
  | "neutral"
  | "interested"
  | "impressed"
  | "defensive"
  | "frustrated";

/**
 * Supported session languages
 */
export type SupportedLanguage = "fr" | "en" | "it" | "de" | "es";

/**
 * State transition trigger types
 */
export type TransitionTrigger =
  | "good_spin_question"
  | "excellent_spin_question"
  | "poor_listening"
  | "premature_pitch"
  | "excellent_objection_handling"
  | "good_objection_handling"
  | "ignored_objection"
  | "value_articulation"
  | "rapport_building"
  | "pushy_behavior"
  | "time_wasting"
  | "closing_signal_recognized"
  | "closing_signal_missed";

/**
 * State machine configuration
 */
export const STATE_MACHINE_CONFIG = {
  /** Maximum state transitions per minute */
  maxTransitionsPerMinute: 2,
  /** Grace period before frustrated state can be entered (ms) */
  frustratedGracePeriodMs: 30_000, // 30 seconds
  /** Turns in frustrated before warning is given */
  turnsBeforeWarning: 2,
  /** Turns after warning before call termination */
  turnsAfterWarningBeforeExit: 2,
  /** Sustained excellent exchanges required for "impressed" state */
  exchangesForImpressed: 5,
} as const;

/**
 * Single state transition definition
 */
export interface StateTransition {
  from: EmotionalState;
  to: EmotionalState;
  baseProbability: number; // 0-1
}

/**
 * Persona modifier configuration
 */
export interface PersonaEmotionalConfig {
  defaultState: EmotionalState;
  /** Multipliers for reaching each state (1.0 = normal) */
  stateModifiers: Record<EmotionalState, number>;
}

/**
 * Current emotional state for a session
 */
export interface EmotionalStateContext {
  currentState: EmotionalState;
  stateHistory: EmotionalState[];
  transitionsLastMinute: number;
  lastTransitionAt: number | null;
  turnsSinceStateChange: number;
  turnsInFrustrated: number;
  warningGivenAt: number | null;
  sessionStartedAt: number;
}

/**
 * Result of state transition evaluation
 */
export interface TransitionResult {
  newState: EmotionalState;
  transitioned: boolean;
  reason?: TransitionReason;
  warningRequired: boolean;
  callShouldEnd: boolean;
  warningMessage?: string;
}

export type TransitionReason =
  | "action_triggered"
  | "rate_limited"
  | "probability_miss"
  | "grace_period"
  | "no_applicable_transition";

/**
 * Emotional state event for logging/analytics
 */
export interface EmotionalStateEvent {
  sessionId: Id<"trainingSessions">;
  userId: Id<"users">;
  timestamp: number;
  previousState: EmotionalState;
  newState: EmotionalState;
  triggerAction: string;
  triggerQuality: number;
  transitionProbability: number;
  transitionsInLastMinute: number;
  turnNumber: number;
  isWarning: boolean;
  isCallTermination: boolean;
}

// =============================================================================
// VALIDATORS (for Convex functions)
// =============================================================================

export const emotionalStateValidator = v.union(
  v.literal("skeptical"),
  v.literal("neutral"),
  v.literal("interested"),
  v.literal("impressed"),
  v.literal("defensive"),
  v.literal("frustrated")
);

export const emotionalStateContextValidator = v.object({
  currentState: emotionalStateValidator,
  stateHistory: v.array(emotionalStateValidator),
  transitionsLastMinute: v.number(),
  lastTransitionAt: v.union(v.number(), v.null()),
  turnsSinceStateChange: v.number(),
  turnsInFrustrated: v.number(),
  warningGivenAt: v.union(v.number(), v.null()),
  sessionStartedAt: v.number(),
});

// =============================================================================
// TRANSITION DEFINITIONS
// =============================================================================

/**
 * All possible state transitions triggered by BDR actions
 */
export const TRANSITION_TRIGGERS: Record<TransitionTrigger, StateTransition[]> = {
  good_spin_question: [
    { from: "neutral", to: "interested", baseProbability: 0.4 },
    { from: "skeptical", to: "neutral", baseProbability: 0.3 },
    { from: "defensive", to: "neutral", baseProbability: 0.2 },
  ],
  excellent_spin_question: [
    { from: "neutral", to: "interested", baseProbability: 0.6 },
    { from: "skeptical", to: "neutral", baseProbability: 0.5 },
    { from: "interested", to: "impressed", baseProbability: 0.1 },
    { from: "defensive", to: "neutral", baseProbability: 0.35 },
  ],
  poor_listening: [
    { from: "neutral", to: "defensive", baseProbability: 0.35 },
    { from: "interested", to: "neutral", baseProbability: 0.3 },
    { from: "defensive", to: "frustrated", baseProbability: 0.25 },
  ],
  premature_pitch: [
    { from: "neutral", to: "skeptical", baseProbability: 0.5 },
    { from: "interested", to: "defensive", baseProbability: 0.4 },
    { from: "skeptical", to: "defensive", baseProbability: 0.3 },
  ],
  excellent_objection_handling: [
    { from: "skeptical", to: "interested", baseProbability: 0.35 },
    { from: "defensive", to: "neutral", baseProbability: 0.4 },
    { from: "interested", to: "impressed", baseProbability: 0.15 },
    { from: "neutral", to: "interested", baseProbability: 0.3 },
  ],
  good_objection_handling: [
    { from: "skeptical", to: "neutral", baseProbability: 0.35 },
    { from: "defensive", to: "neutral", baseProbability: 0.25 },
    { from: "frustrated", to: "defensive", baseProbability: 0.15 },
  ],
  ignored_objection: [
    { from: "neutral", to: "defensive", baseProbability: 0.5 },
    { from: "defensive", to: "frustrated", baseProbability: 0.4 },
    { from: "skeptical", to: "defensive", baseProbability: 0.35 },
    { from: "interested", to: "skeptical", baseProbability: 0.3 },
  ],
  value_articulation: [
    { from: "skeptical", to: "neutral", baseProbability: 0.25 },
    { from: "neutral", to: "interested", baseProbability: 0.3 },
    { from: "interested", to: "impressed", baseProbability: 0.1 },
  ],
  rapport_building: [
    { from: "skeptical", to: "neutral", baseProbability: 0.2 },
    { from: "defensive", to: "neutral", baseProbability: 0.25 },
    { from: "neutral", to: "interested", baseProbability: 0.15 },
  ],
  pushy_behavior: [
    { from: "neutral", to: "defensive", baseProbability: 0.45 },
    { from: "interested", to: "defensive", baseProbability: 0.4 },
    { from: "defensive", to: "frustrated", baseProbability: 0.35 },
    { from: "impressed", to: "interested", baseProbability: 0.3 },
  ],
  time_wasting: [
    { from: "neutral", to: "defensive", baseProbability: 0.3 },
    { from: "interested", to: "neutral", baseProbability: 0.25 },
    { from: "defensive", to: "frustrated", baseProbability: 0.4 },
  ],
  closing_signal_recognized: [
    { from: "interested", to: "impressed", baseProbability: 0.25 },
    { from: "impressed", to: "impressed", baseProbability: 1.0 }, // Stay impressed
  ],
  closing_signal_missed: [
    { from: "impressed", to: "interested", baseProbability: 0.3 },
    { from: "interested", to: "neutral", baseProbability: 0.2 },
  ],
};

/**
 * Default persona emotional modifiers
 */
export const DEFAULT_PERSONA_MODIFIERS: Record<EmotionalState, number> = {
  skeptical: 1.0,
  neutral: 1.0,
  interested: 1.0,
  impressed: 1.0,
  defensive: 1.0,
  frustrated: 1.0,
};

/**
 * Preset persona modifier configurations
 */
export const PERSONA_PRESETS: Record<string, Record<EmotionalState, number>> = {
  skeptical_analyst: {
    skeptical: 1.2, // Harder to move out of skeptical
    neutral: 1.0,
    interested: 0.8, // Harder to reach
    impressed: 0.5, // Much harder to reach
    defensive: 1.1,
    frustrated: 0.9,
  },
  friendly_champion: {
    skeptical: 0.7, // Easier to move out of skeptical
    neutral: 1.0,
    interested: 1.3, // Easier to reach
    impressed: 1.0,
    defensive: 0.8,
    frustrated: 0.7,
  },
  pressured_executive: {
    skeptical: 1.0,
    neutral: 0.9,
    interested: 0.85,
    impressed: 0.6,
    defensive: 1.3, // More easily defensive
    frustrated: 1.2, // More easily frustrated
  },
  aggressive_negotiator: {
    skeptical: 1.3, // Starts skeptical, stays skeptical
    neutral: 0.8,
    interested: 0.9,
    impressed: 0.7,
    defensive: 1.1,
    frustrated: 1.0,
  },
};

// =============================================================================
// FRUSTRATED STATE HANDLING
// =============================================================================

/**
 * Warning messages when prospect is about to end call (localized)
 */
export const FRUSTRATED_WARNING_MESSAGES: Record<SupportedLanguage, string> = {
  fr: "Écoutez, je vais être honnête avec vous - je ne suis pas sûr que ce soit le bon moment pour nous. Si vous n'avez pas quelque chose de concret à me proposer, je vais devoir raccrocher.",
  en: "Look, I'm going to be honest with you - I'm not sure this is the right time for us. If you don't have something concrete to offer, I'm going to have to end this call.",
  de: "Hören Sie, ich bin ehrlich zu Ihnen - ich bin mir nicht sicher, ob das der richtige Zeitpunkt ist. Wenn Sie mir nichts Konkretes anbieten können, muss ich das Gespräch beenden.",
  it: "Guardi, sarò onesto con lei - non sono sicuro che questo sia il momento giusto. Se non ha qualcosa di concreto da propormi, dovrò interrompere la chiamata.",
  es: "Mire, voy a ser honesto con usted - no estoy seguro de que este sea el momento adecuado. Si no tiene algo concreto que ofrecerme, voy a tener que terminar esta llamada.",
};

/**
 * Call termination messages (localized)
 */
export const CALL_TERMINATION_MESSAGES: Record<SupportedLanguage, string> = {
  fr: "Je suis désolé, mais je dois vraiment y aller. Ce n'est pas le bon moment pour nous. Au revoir.",
  en: "I'm sorry, but I really have to go. This isn't the right time for us. Goodbye.",
  de: "Es tut mir leid, aber ich muss wirklich gehen. Das ist nicht der richtige Zeitpunkt für uns. Auf Wiedersehen.",
  it: "Mi dispiace, ma devo proprio andare. Non è il momento giusto per noi. Arrivederci.",
  es: "Lo siento, pero realmente tengo que irme. Este no es el momento adecuado para nosotros. Adiós.",
};

// =============================================================================
// PURE FUNCTIONS (Internal Implementation)
// =============================================================================

/**
 * Count transitions in the last minute from state history
 */
export function countRecentTransitions(
  lastTransitionAt: number | null,
  currentTime: number = Date.now()
): number {
  if (lastTransitionAt === null) return 0;
  const oneMinuteAgo = currentTime - 60_000;
  return lastTransitionAt > oneMinuteAgo ? 1 : 0;
}

/**
 * Evaluate state transition based on BDR action
 * Pure function, no side effects
 */
export function evaluateTransition(
  context: EmotionalStateContext,
  triggerAction: TransitionTrigger,
  actionQuality: number, // 0-100
  personaModifiers: Record<EmotionalState, number> = DEFAULT_PERSONA_MODIFIERS,
  language: SupportedLanguage = "en",
  currentTime: number = Date.now()
): TransitionResult {
  const { currentState, transitionsLastMinute, sessionStartedAt, turnsInFrustrated, warningGivenAt } = context;

  // Check if frustrated warning/exit needed
  if (currentState === "frustrated") {
    const totalTurnsInFrustrated = turnsInFrustrated + 1;

    // Check for call termination (4 total turns = 2 before warning + 2 after)
    if (warningGivenAt !== null && totalTurnsInFrustrated >= STATE_MACHINE_CONFIG.turnsBeforeWarning + STATE_MACHINE_CONFIG.turnsAfterWarningBeforeExit) {
      return {
        newState: "frustrated",
        transitioned: false,
        callShouldEnd: true,
        warningRequired: false,
        warningMessage: CALL_TERMINATION_MESSAGES[language],
      };
    }

    // Check for warning (2 turns in frustrated without warning yet)
    if (warningGivenAt === null && totalTurnsInFrustrated >= STATE_MACHINE_CONFIG.turnsBeforeWarning) {
      return {
        newState: "frustrated",
        transitioned: false,
        callShouldEnd: false,
        warningRequired: true,
        warningMessage: FRUSTRATED_WARNING_MESSAGES[language],
      };
    }
  }

  // Rate limiting check
  if (transitionsLastMinute >= STATE_MACHINE_CONFIG.maxTransitionsPerMinute) {
    return {
      newState: currentState,
      transitioned: false,
      reason: "rate_limited",
      warningRequired: false,
      callShouldEnd: false,
    };
  }

  // Grace period check for entering frustrated
  const sessionDuration = currentTime - sessionStartedAt;

  // Get possible transitions for this action
  const triggers = TRANSITION_TRIGGERS[triggerAction] ?? [];
  const applicable = triggers.filter((t) => t.from === currentState);

  if (applicable.length === 0) {
    return {
      newState: currentState,
      transitioned: false,
      reason: "no_applicable_transition",
      warningRequired: false,
      callShouldEnd: false,
    };
  }

  // Evaluate each possible transition
  for (const trigger of applicable) {
    // Skip transitions to frustrated during grace period
    if (trigger.to === "frustrated" && sessionDuration < STATE_MACHINE_CONFIG.frustratedGracePeriodMs) {
      continue;
    }

    // Calculate adjusted probability
    const personaMod = personaModifiers[trigger.to] ?? 1.0;
    const qualityMod = actionQuality / 100; // Scale by action quality
    const adjustedProb = trigger.baseProbability * personaMod * qualityMod;

    // Roll for transition
    if (Math.random() < adjustedProb) {
      return {
        newState: trigger.to,
        transitioned: true,
        reason: "action_triggered",
        warningRequired: false,
        callShouldEnd: false,
      };
    }
  }

  return {
    newState: currentState,
    transitioned: false,
    reason: "probability_miss",
    warningRequired: false,
    callShouldEnd: false,
  };
}

/**
 * Initialize emotional state context for new session
 */
export function initializeEmotionalState(
  defaultState: EmotionalState,
  sessionStartedAt: number = Date.now()
): EmotionalStateContext {
  return {
    currentState: defaultState,
    stateHistory: [defaultState],
    transitionsLastMinute: 0,
    lastTransitionAt: null,
    turnsSinceStateChange: 0,
    turnsInFrustrated: 0,
    warningGivenAt: null,
    sessionStartedAt,
  };
}

/**
 * Update context after transition
 */
export function updateContextAfterTransition(
  context: EmotionalStateContext,
  newState: EmotionalState,
  transitioned: boolean,
  warningGiven: boolean,
  currentTime: number = Date.now()
): EmotionalStateContext {
  const newHistory = transitioned ? [...context.stateHistory, newState] : context.stateHistory;

  return {
    ...context,
    currentState: newState,
    stateHistory: newHistory.slice(-20), // Keep last 20 states
    transitionsLastMinute: transitioned ? context.transitionsLastMinute + 1 : context.transitionsLastMinute,
    lastTransitionAt: transitioned ? currentTime : context.lastTransitionAt,
    turnsSinceStateChange: transitioned ? 0 : context.turnsSinceStateChange + 1,
    turnsInFrustrated: newState === "frustrated" ? context.turnsInFrustrated + 1 : 0,
    warningGivenAt: warningGiven ? currentTime : context.warningGivenAt,
  };
}

// =============================================================================
// VOICE MODULATION INTEGRATION
// =============================================================================

/**
 * Voice modulation parameters for each emotional state
 * (Aligned with Spec 005 Cartesia contract)
 */
export interface VoiceModulation {
  speedMod: number; // Multiplier for base speed
  pitchMod: number; // Multiplier for base pitch
  emotion: string; // Cartesia emotion parameter
}

export const EMOTIONAL_VOICE_MODULATION: Record<EmotionalState, VoiceModulation> = {
  skeptical: { speedMod: 1.0, pitchMod: 1.0, emotion: "neutral" },
  neutral: { speedMod: 1.0, pitchMod: 1.0, emotion: "neutral" },
  interested: { speedMod: 1.05, pitchMod: 1.02, emotion: "curious" },
  impressed: { speedMod: 1.08, pitchMod: 1.05, emotion: "enthusiastic" },
  defensive: { speedMod: 0.95, pitchMod: 0.98, emotion: "defensive" },
  frustrated: { speedMod: 1.15, pitchMod: 1.08, emotion: "frustrated" },
};

/**
 * Get voice modulation for current state
 */
export function getVoiceModulation(state: EmotionalState): VoiceModulation {
  return EMOTIONAL_VOICE_MODULATION[state];
}

// =============================================================================
// CONTEXT BUILDER INTEGRATION
// =============================================================================

/**
 * State descriptions for LLM context
 */
export const STATE_DESCRIPTIONS: Record<EmotionalState, { description: string; expression: string }> = {
  skeptical: {
    description: "You are doubtful about the product/service. You've heard many sales pitches and are not easily convinced.",
    expression: "Use short responses, ask challenging questions, request proof/data. Tone is professional but guarded. Cross-examine claims.",
  },
  neutral: {
    description: "You are open but not committed. The BDR has your attention but hasn't earned your trust yet.",
    expression: "Use measured responses, ask clarifying questions. Tone is professional and polite. Share basic context when asked.",
  },
  interested: {
    description: "Something resonated with you. You see potential value and want to learn more.",
    expression: "Lean into the conversation, ask follow-up questions, share more context about your situation. Tone becomes warmer.",
  },
  impressed: {
    description: "The BDR has demonstrated real value. You're seriously considering the solution.",
    expression: "Enthusiastic responses, ask about next steps, share internal details. Tone is positive and engaged.",
  },
  defensive: {
    description: "You feel pushed or pressured. The BDR is being too aggressive or not listening.",
    expression: "Short, guarded responses. Raise objections. Pull back from sharing. Tone becomes colder.",
  },
  frustrated: {
    description: "You want to end the conversation. The BDR has lost you through poor technique.",
    expression: "Curt responses, explicit disinterest. Mention being busy. Tone is dismissive. Look for exit.",
  },
};

/**
 * Format emotional state for Context Builder prompt
 */
export function formatEmotionalStateForPrompt(
  state: EmotionalState,
  turnsInState: number
): string {
  const { description, expression } = STATE_DESCRIPTIONS[state];

  return `
CURRENT EMOTIONAL STATE: ${state.toUpperCase()}

${description}

How to express this state:
${expression}

Turns in this state: ${turnsInState}
`.trim();
}
