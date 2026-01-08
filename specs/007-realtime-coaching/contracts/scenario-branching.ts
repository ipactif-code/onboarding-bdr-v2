/**
 * M4: Scenario Branching Contract
 *
 * Dynamic conversation paths with consequences based on BDR decisions.
 * Creates realistic training where actions have meaningful outcomes.
 */

import { v } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";
import type { EmotionalState } from "./whisper-engine";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Types of events that can trigger branch decisions
 */
export type BranchTriggerType =
  | "objection_handled"
  | "buying_signal_response"
  | "discovery_depth"
  | "value_proposition"
  | "closing_attempt";

/**
 * Possible branch outcomes
 */
export type BranchType = "positive" | "negative" | "neutral";

/**
 * Branch detection configuration
 */
export interface BranchDetectionConfig {
  triggerType: BranchTriggerType;
  description: string;
  positiveIndicators: string[];
  negativeIndicators: string[];
  neutralIndicators: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Branch detection configuration
 */
export const BRANCHING_CONFIG = {
  /** Maximum branch decisions per session (FR-012) */
  maxBranchesPerSession: 5,
  /** Maximum logging latency for branch decisions (SC-006) */
  maxLoggingLatencyMs: 100,
  /** Maximum What-If explorations per session (FR-020) */
  maxWhatIfExplorationsPerSession: 3,
} as const;

/**
 * Branch trigger configurations
 */
export const BRANCH_TRIGGERS: Record<BranchTriggerType, BranchDetectionConfig> = {
  objection_handled: {
    triggerType: "objection_handled",
    description: "How the BDR responded to a prospect objection",
    positiveIndicators: [
      "empathetic_reframe",
      "value_based_response",
      "confirmation_of_resolution",
      "next_step_proposed",
    ],
    negativeIndicators: [
      "defensive_response",
      "ignored_concern",
      "dismissive_language",
      "aggressive_counter",
    ],
    neutralIndicators: [
      "partial_address",
      "delayed_response",
      "topic_change",
    ],
  },
  buying_signal_response: {
    triggerType: "buying_signal_response",
    description: "How the BDR responded to a buying signal from prospect",
    positiveIndicators: [
      "acknowledged_interest",
      "proposed_next_step",
      "asked_qualifying_question",
      "trial_close",
    ],
    negativeIndicators: [
      "missed_signal",
      "continued_pitching",
      "ignored_interest",
      "changed_topic",
    ],
    neutralIndicators: [
      "acknowledged_but_continued",
      "delayed_follow_up",
    ],
  },
  discovery_depth: {
    triggerType: "discovery_depth",
    description: "Quality of discovery questions and follow-ups",
    positiveIndicators: [
      "implication_question_asked",
      "need_payoff_explored",
      "deeper_follow_up",
      "connected_to_business_impact",
    ],
    negativeIndicators: [
      "surface_level_only",
      "leading_questions",
      "premature_solution_pitching",
      "missed_obvious_follow_up",
    ],
    neutralIndicators: [
      "adequate_discovery",
      "standard_questions",
    ],
  },
  value_proposition: {
    triggerType: "value_proposition",
    description: "How effectively BDR articulated value",
    positiveIndicators: [
      "tailored_to_needs",
      "quantified_benefits",
      "addressed_specific_pain",
      "clear_differentiation",
    ],
    negativeIndicators: [
      "generic_pitch",
      "feature_dumping",
      "ignored_context",
      "mismatched_value",
    ],
    neutralIndicators: [
      "standard_value_prop",
      "partially_tailored",
    ],
  },
  closing_attempt: {
    triggerType: "closing_attempt",
    description: "Quality of closing or next step proposal",
    positiveIndicators: [
      "clear_next_step",
      "specific_date_time",
      "mutual_commitment",
      "summarized_value",
    ],
    negativeIndicators: [
      "weak_close",
      "no_commitment_asked",
      "vague_follow_up",
      "premature_close",
    ],
    neutralIndicators: [
      "delayed_close",
      "soft_suggestion",
    ],
  },
} as const;

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Prospect behavior shift resulting from branch decision
 */
export interface ProspectBehaviorShift {
  previousState: EmotionalState;
  newState: EmotionalState;
  openessChange: number; // -1 to +1 scale
}

/**
 * Branch decision record
 */
export interface BranchDecision {
  sessionId: Id<"trainingSessions">;
  userId: Id<"users">;
  timestamp: number;
  turnNumber: number;
  decisionPointId: string;
  triggerType: BranchTriggerType;
  transcriptBefore: string;
  bdrResponse: string;
  branchType: BranchType;
  branchOutcome: string;
  prospectBehaviorShift?: ProspectBehaviorShift;
  loggingLatencyMs: number;
}

/**
 * Input for branch detection
 */
export interface BranchDetectionInput {
  sessionId: Id<"trainingSessions">;
  userId: Id<"users">;
  turnNumber: number;
  transcriptContext: string; // Last 2-3 exchanges
  bdrResponse: string;
  detectedTrigger: BranchTriggerType;
  currentEmotionalState: EmotionalState;
  analysisResults: {
    responseQuality: number; // 0-100
    indicators: string[];
    sentiment: "positive" | "negative" | "neutral";
  };
}

/**
 * Result of branch detection
 */
export interface BranchDetectionResult {
  shouldCreateBranch: boolean;
  branchDecision?: Omit<BranchDecision, "loggingLatencyMs">;
  prospectResponse?: {
    emotionalShift: ProspectBehaviorShift;
    behaviorHint: string; // Hint for AI response generation
  };
  reason?: BranchSkipReason;
}

export type BranchSkipReason =
  | "max_branches_reached"
  | "no_significant_decision"
  | "duplicate_trigger";

/**
 * Branch summary for session review
 */
export interface BranchSummary {
  decisionPointId: string;
  turnNumber: number;
  triggerType: BranchTriggerType;
  branchType: BranchType;
  outcome: string;
  timestamp: number;
}

// =============================================================================
// VALIDATORS
// =============================================================================

export const branchTriggerTypeValidator = v.union(
  v.literal("objection_handled"),
  v.literal("buying_signal_response"),
  v.literal("discovery_depth"),
  v.literal("value_proposition"),
  v.literal("closing_attempt")
);

export const branchTypeValidator = v.union(
  v.literal("positive"),
  v.literal("negative"),
  v.literal("neutral")
);

export const prospectBehaviorShiftValidator = v.object({
  previousState: v.string(),
  newState: v.string(),
  openessChange: v.number(),
});

export const branchDecisionValidator = v.object({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  timestamp: v.number(),
  turnNumber: v.number(),
  decisionPointId: v.string(),
  triggerType: branchTriggerTypeValidator,
  transcriptBefore: v.string(),
  bdrResponse: v.string(),
  branchType: branchTypeValidator,
  branchOutcome: v.string(),
  prospectBehaviorShift: v.optional(prospectBehaviorShiftValidator),
  loggingLatencyMs: v.number(),
});

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Generate unique decision point ID
 */
export function generateDecisionPointId(
  triggerType: BranchTriggerType,
  turnNumber: number
): string {
  return `${triggerType}_turn${turnNumber}_${Date.now()}`;
}

/**
 * Determine branch type from analysis results
 */
export function determineBranchType(
  indicators: string[],
  triggerType: BranchTriggerType
): BranchType {
  const config = BRANCH_TRIGGERS[triggerType];

  const positiveCount = indicators.filter((i) =>
    config.positiveIndicators.includes(i)
  ).length;
  const negativeCount = indicators.filter((i) =>
    config.negativeIndicators.includes(i)
  ).length;

  if (positiveCount > negativeCount && positiveCount > 0) return "positive";
  if (negativeCount > positiveCount && negativeCount > 0) return "negative";
  return "neutral";
}

/**
 * Calculate emotional state shift based on branch type
 */
export function calculateEmotionalShift(
  currentState: EmotionalState,
  branchType: BranchType
): ProspectBehaviorShift {
  const stateTransitions: Record<
    BranchType,
    Record<EmotionalState, { newState: EmotionalState; openessChange: number }>
  > = {
    positive: {
      skeptical: { newState: "neutral", openessChange: 0.3 },
      neutral: { newState: "interested", openessChange: 0.4 },
      interested: { newState: "impressed", openessChange: 0.3 },
      impressed: { newState: "impressed", openessChange: 0.1 },
      defensive: { newState: "neutral", openessChange: 0.4 },
      frustrated: { newState: "defensive", openessChange: 0.2 },
    },
    negative: {
      skeptical: { newState: "defensive", openessChange: -0.3 },
      neutral: { newState: "skeptical", openessChange: -0.3 },
      interested: { newState: "neutral", openessChange: -0.4 },
      impressed: { newState: "interested", openessChange: -0.3 },
      defensive: { newState: "frustrated", openessChange: -0.4 },
      frustrated: { newState: "frustrated", openessChange: -0.2 },
    },
    neutral: {
      skeptical: { newState: "skeptical", openessChange: 0 },
      neutral: { newState: "neutral", openessChange: 0 },
      interested: { newState: "interested", openessChange: 0 },
      impressed: { newState: "impressed", openessChange: 0 },
      defensive: { newState: "defensive", openessChange: 0 },
      frustrated: { newState: "frustrated", openessChange: 0 },
    },
  };

  const transition = stateTransitions[branchType][currentState];
  return {
    previousState: currentState,
    newState: transition.newState,
    openessChange: transition.openessChange,
  };
}

/**
 * Generate outcome description based on branch type and trigger
 */
export function generateBranchOutcome(
  branchType: BranchType,
  triggerType: BranchTriggerType
): string {
  const outcomes: Record<BranchType, Record<BranchTriggerType, string>> = {
    positive: {
      objection_handled:
        "Prospect's concern was addressed effectively. They are more open to discussing value.",
      buying_signal_response:
        "Prospect's interest was acknowledged. They are ready to discuss next steps.",
      discovery_depth:
        "Deep discovery uncovered key pain points. Prospect sees you understand their situation.",
      value_proposition:
        "Value proposition resonated. Prospect can see clear benefits for their organization.",
      closing_attempt:
        "Strong close with clear next steps. Prospect is committed to moving forward.",
    },
    negative: {
      objection_handled:
        "Prospect's concern was not addressed. They are more guarded and skeptical.",
      buying_signal_response:
        "Buying signal was missed. Prospect's enthusiasm has cooled.",
      discovery_depth:
        "Surface-level discovery failed to uncover real needs. Prospect doubts your understanding.",
      value_proposition:
        "Generic pitch didn't resonate. Prospect doesn't see relevant value.",
      closing_attempt:
        "Weak close without commitment. Prospect is non-committal about next steps.",
    },
    neutral: {
      objection_handled:
        "Objection was partially addressed. Prospect remains neutral.",
      buying_signal_response:
        "Interest was noted but not fully explored. Conversation continues.",
      discovery_depth:
        "Adequate discovery but no breakthrough insights. Standard progression.",
      value_proposition:
        "Value proposition was heard but not tailored. Moderate interest.",
      closing_attempt:
        "Soft close without strong commitment. Follow-up needed.",
    },
  };

  return outcomes[branchType][triggerType];
}

/**
 * Generate behavior hint for AI response based on branch
 */
export function generateBehaviorHint(
  branchType: BranchType,
  newEmotionalState: EmotionalState
): string {
  const hints: Record<BranchType, string> = {
    positive: `The prospect is now ${newEmotionalState}. They should be more open, share more information, and show genuine interest in continuing the conversation. Consider revealing a new opportunity or being more forthcoming.`,
    negative: `The prospect is now ${newEmotionalState}. They should be more guarded, give shorter responses, and show less willingness to share information. Consider pulling back or raising additional concerns.`,
    neutral: `The prospect remains ${newEmotionalState}. Continue with default behavior for this emotional state without significant change in engagement level.`,
  };

  return hints[branchType];
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface ScenarioBranchingService {
  /**
   * Detect if current turn is a branch decision point
   */
  detectBranchPoint(
    input: BranchDetectionInput,
    currentBranchCount: number
  ): BranchDetectionResult;

  /**
   * Record a branch decision
   */
  recordBranchDecision(decision: BranchDecision): Promise<Id<"branchDecisions">>;

  /**
   * Get branch summary for session review
   */
  getSessionBranches(
    sessionId: Id<"trainingSessions">
  ): Promise<BranchSummary[]>;

  /**
   * Get key decision points for What-If replay selection (FR-017)
   */
  getKeyDecisionPoints(
    sessionId: Id<"trainingSessions">
  ): Promise<BranchSummary[]>;
}
