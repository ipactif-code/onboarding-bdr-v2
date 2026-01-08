/**
 * M4: What-If Replay Contract
 *
 * Post-session exploration of alternative conversation paths at key decision points.
 * Enables BDRs to learn from mistakes without redoing the entire session.
 */

import { v } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";
import type { BranchType, BranchTriggerType } from "./scenario-branching";

// =============================================================================
// TYPES
// =============================================================================

/**
 * What-If exploration record
 */
export interface WhatIfExploration {
  sessionId: Id<"trainingSessions">;
  userId: Id<"users">;
  branchDecisionId: Id<"branchDecisions">;
  exploredAt: number;
  explorationNumber: number; // 1, 2, or 3
  alternativeResponse: string;
  aiAlternativeReply: string;
  aiAlternativeBranchType: BranchType;
  personaId: Id<"aiTrainerPersonas">;
  originalContext: string;
}

/**
 * Input for What-If exploration
 */
export interface WhatIfExplorationInput {
  sessionId: Id<"trainingSessions">;
  userId: Id<"users">;
  branchDecisionId: Id<"branchDecisions">;
  alternativeResponse: string;
}

/**
 * Context for generating What-If AI response
 */
export interface WhatIfGenerationContext {
  personaId: Id<"aiTrainerPersonas">;
  personaName: string;
  personaDescription: string;
  originalTranscript: string;
  decisionPointContext: string;
  originalBdrResponse: string;
  originalBranchType: BranchType;
  triggerType: BranchTriggerType;
  emotionalStateAtDecision: string;
}

/**
 * Result of What-If exploration
 */
export interface WhatIfExplorationResult {
  success: boolean;
  exploration?: WhatIfExploration;
  error?: WhatIfError;
}

export type WhatIfError =
  | "session_not_completed"
  | "max_explorations_reached"
  | "invalid_branch_decision"
  | "generation_failed"
  | "session_not_found";

/**
 * Decision point available for What-If exploration
 */
export interface WhatIfDecisionPoint {
  branchDecisionId: Id<"branchDecisions">;
  turnNumber: number;
  triggerType: BranchTriggerType;
  originalBranchType: BranchType;
  transcriptContext: string;
  bdrResponse: string;
  branchOutcome: string;
  alreadyExplored: boolean;
}

/**
 * What-If session state
 */
export interface WhatIfSessionState {
  sessionId: Id<"trainingSessions">;
  isAvailable: boolean; // Only true for completed sessions
  explorationsUsed: number;
  explorationsRemaining: number;
  decisionPoints: WhatIfDecisionPoint[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const WHAT_IF_CONFIG = {
  /** Maximum explorations per session (FR-020) */
  maxExplorationsPerSession: 3,
  /** Temperature for AI response generation (consistency) */
  aiTemperature: 0.3,
  /** Maximum context length for generation */
  maxContextLength: 4000,
} as const;

// =============================================================================
// VALIDATORS
// =============================================================================

export const whatIfExplorationValidator = v.object({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  branchDecisionId: v.id("branchDecisions"),
  exploredAt: v.number(),
  explorationNumber: v.number(),
  alternativeResponse: v.string(),
  aiAlternativeReply: v.string(),
  aiAlternativeBranchType: v.union(
    v.literal("positive"),
    v.literal("negative"),
    v.literal("neutral")
  ),
  personaId: v.id("aiTrainerPersonas"),
  originalContext: v.string(),
});

export const whatIfExplorationInputValidator = v.object({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  branchDecisionId: v.id("branchDecisions"),
  alternativeResponse: v.string(),
});

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Check if What-If is available for a session
 */
export function isWhatIfAvailable(
  sessionStatus: string,
  explorationsUsed: number
): { available: boolean; reason?: string } {
  if (sessionStatus !== "completed") {
    return {
      available: false,
      reason: "What-If replay is only available for completed sessions.",
    };
  }

  if (explorationsUsed >= WHAT_IF_CONFIG.maxExplorationsPerSession) {
    return {
      available: false,
      reason: `Maximum ${WHAT_IF_CONFIG.maxExplorationsPerSession} explorations reached for this session.`,
    };
  }

  return { available: true };
}

/**
 * Build prompt for AI alternative response generation
 */
export function buildWhatIfPrompt(context: WhatIfGenerationContext): string {
  return `You are ${context.personaName}, a prospect in a sales training simulation.

PERSONA BACKGROUND:
${context.personaDescription}

CONVERSATION CONTEXT:
${context.decisionPointContext}

ORIGINAL BDR RESPONSE (resulted in ${context.originalBranchType} branch):
"${context.originalBdrResponse}"

ALTERNATIVE BDR RESPONSE:
[User will provide this]

INSTRUCTIONS:
1. Respond AS the prospect (${context.personaName}) to the ALTERNATIVE response
2. Your response should be CONSISTENT with your persona's personality and background
3. Consider whether this alternative response would lead to a more positive, negative, or neutral outcome
4. Keep your response natural and conversational (2-4 sentences typically)
5. Your emotional state at this point is: ${context.emotionalStateAtDecision}

Important: This is a "what if" scenario. Respond authentically as the persona would, based on the alternative approach.`;
}

/**
 * Analyze AI response to determine alternative branch type
 */
export function analyzeAlternativeBranchType(
  aiResponse: string,
  triggerType: BranchTriggerType
): BranchType {
  // Positive indicators
  const positiveSignals = [
    "that makes sense",
    "interesting",
    "tell me more",
    "I appreciate",
    "good point",
    "you're right",
    "I hadn't thought of",
    "let's discuss",
    "I'm interested",
    "sounds promising",
    "good question",
    "fair point",
  ];

  // Negative indicators
  const negativeSignals = [
    "I don't think",
    "not interested",
    "not a good fit",
    "waste of time",
    "already have",
    "too expensive",
    "doesn't address",
    "not convinced",
    "don't see how",
    "concerns me",
    "have to go",
    "not right now",
  ];

  const lowerResponse = aiResponse.toLowerCase();

  const positiveCount = positiveSignals.filter((s) =>
    lowerResponse.includes(s)
  ).length;
  const negativeCount = negativeSignals.filter((s) =>
    lowerResponse.includes(s)
  ).length;

  // Also check response length and question marks (engagement indicators)
  const isEngaged = aiResponse.length > 100 || aiResponse.includes("?");

  if (positiveCount > negativeCount && (positiveCount > 0 || isEngaged)) {
    return "positive";
  }
  if (negativeCount > positiveCount && negativeCount > 0) {
    return "negative";
  }
  return "neutral";
}

/**
 * Format What-If result for display
 */
export function formatWhatIfResult(
  exploration: WhatIfExploration,
  originalOutcome: string
): {
  alternativeResponse: string;
  aiReply: string;
  originalBranchType: BranchType;
  alternativeBranchType: BranchType;
  improved: boolean;
  feedback: string;
} {
  const branchRank: Record<BranchType, number> = {
    positive: 3,
    neutral: 2,
    negative: 1,
  };

  // We need the original branch type from the context
  // For now, assume it's passed in or fetched separately
  const originalBranchType: BranchType = "neutral"; // Placeholder

  const improved =
    branchRank[exploration.aiAlternativeBranchType] > branchRank[originalBranchType];

  let feedback: string;
  if (improved) {
    feedback =
      "This alternative approach would have led to a more positive outcome with the prospect.";
  } else if (
    branchRank[exploration.aiAlternativeBranchType] <
    branchRank[originalBranchType]
  ) {
    feedback =
      "This alternative approach might have led to a less favorable outcome.";
  } else {
    feedback =
      "This alternative would have resulted in a similar outcome to your original response.";
  }

  return {
    alternativeResponse: exploration.alternativeResponse,
    aiReply: exploration.aiAlternativeReply,
    originalBranchType,
    alternativeBranchType: exploration.aiAlternativeBranchType,
    improved,
    feedback,
  };
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface WhatIfReplayService {
  /**
   * Get What-If state for a session
   */
  getSessionWhatIfState(
    sessionId: Id<"trainingSessions">,
    userId: Id<"users">
  ): Promise<WhatIfSessionState>;

  /**
   * Create a What-If exploration
   */
  exploreWhatIf(input: WhatIfExplorationInput): Promise<WhatIfExplorationResult>;

  /**
   * Get all What-If explorations for a session
   */
  getSessionExplorations(
    sessionId: Id<"trainingSessions">
  ): Promise<WhatIfExploration[]>;

  /**
   * Generate AI alternative response
   * Uses Claude with persona context for consistency (SC-004)
   */
  generateAlternativeResponse(
    context: WhatIfGenerationContext,
    alternativeInput: string
  ): Promise<{ reply: string; branchType: BranchType }>;
}
