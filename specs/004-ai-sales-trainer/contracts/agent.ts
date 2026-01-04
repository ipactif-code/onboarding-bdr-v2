/**
 * AI Sales Trainer - Agent Bridge Contracts
 *
 * Convex function signatures for Python agent ↔ Convex communication.
 * Agent authenticates via service token, not user JWT.
 */

import { v } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";

// =============================================================================
// TYPES
// =============================================================================

export interface AgentCheckpoint {
  difficultyLevel: number;
  emotionalState: string;
  conversationBuffer: Array<{ role: string; content: string }>;
  pendingWhispers: string[];
}

export interface TranscriptEntry {
  turnIndex: number;
  speaker: "bdr" | "ai";
  content: string;
  startedAt: number;
  endedAt: number;
  duration: number;
  sentiment?: { score: number; confidence: number };
  voiceMetrics?: {
    avgPitch: number;
    avgEnergy: number;
    speechRate: number;
    pauseCount: number;
  };
  isBranchPoint: boolean;
  branchType?: string;
}

// =============================================================================
// HTTP ACTIONS (Agent → Convex)
// =============================================================================

/**
 * Agent registers session start
 *
 * @auth Agent service token
 */
export const httpAgentSessionStarted = {
  method: "POST",
  path: "/api/training/agent/session-started",
  body: {
    sessionId: v.id("trainingSessions"),
    agentVersion: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    persona: v.object({
      name: v.string(),
      personality: v.string(),
      painPoints: v.array(v.string()),
      baseDifficulty: v.number(),
    }),
    scenario: v.object({
      openingContext: v.string(),
      objectives: v.array(v.object({
        id: v.string(),
        description: v.string(),
        weight: v.number(),
      })),
      keyMoments: v.array(v.object({
        momentType: v.string(),
        triggerConditions: v.array(v.string()),
      })),
    }),
  }),
};

/**
 * Agent stores transcript entry
 *
 * @auth Agent service token
 */
export const httpAgentAddTranscript = {
  method: "POST",
  path: "/api/training/agent/transcript",
  body: {
    sessionId: v.id("trainingSessions"),
    entry: v.object({
      turnIndex: v.number(),
      speaker: v.union(v.literal("bdr"), v.literal("ai")),
      content: v.string(),
      startedAt: v.number(),
      endedAt: v.number(),
      duration: v.number(),
      sentiment: v.optional(v.object({
        score: v.number(),
        confidence: v.number(),
      })),
      voiceMetrics: v.optional(v.object({
        avgPitch: v.number(),
        avgEnergy: v.number(),
        speechRate: v.number(),
        pauseCount: v.number(),
      })),
      isBranchPoint: v.boolean(),
      branchType: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    transcriptId: v.id("trainingTranscripts"),
  }),
};

/**
 * Agent triggers a whisper
 *
 * @auth Agent service token
 */
export const httpAgentTriggerWhisper = {
  method: "POST",
  path: "/api/training/agent/whisper",
  body: {
    sessionId: v.id("trainingSessions"),
    type: v.union(
      v.literal("technique_suggestion"),
      v.literal("warning"),
      v.literal("encouragement"),
      v.literal("question_prompt")
    ),
    message: v.string(),
    triggeredBy: v.string(),
    turnIndex: v.number(),
    ariaAnnouncement: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    whisperId: v.id("trainingWhispers"),
  }),
};

/**
 * Agent saves checkpoint
 *
 * @auth Agent service token
 */
export const httpAgentSaveCheckpoint = {
  method: "POST",
  path: "/api/training/agent/checkpoint",
  body: {
    sessionId: v.id("trainingSessions"),
    checkpoint: v.object({
      difficultyLevel: v.number(),
      emotionalState: v.string(),
      conversationBuffer: v.array(v.object({
        role: v.string(),
        content: v.string(),
      })),
      pendingWhispers: v.array(v.string()),
    }),
    lastTurnIndex: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    checkpointNumber: v.number(),
  }),
};

/**
 * Agent loads checkpoint for recovery
 *
 * @auth Agent service token
 */
export const httpAgentLoadCheckpoint = {
  method: "GET",
  path: "/api/training/agent/checkpoint/:sessionId",
  params: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.union(
    v.object({
      hasCheckpoint: v.literal(true),
      checkpoint: v.object({
        difficultyLevel: v.number(),
        emotionalState: v.string(),
        conversationBuffer: v.array(v.object({
          role: v.string(),
          content: v.string(),
        })),
        pendingWhispers: v.array(v.string()),
      }),
      lastTurnIndex: v.number(),
      checkpointNumber: v.number(),
      createdAt: v.number(),
    }),
    v.object({
      hasCheckpoint: v.literal(false),
    })
  ),
};

/**
 * Agent reports session completion
 *
 * @auth Agent service token
 */
export const httpAgentSessionCompleted = {
  method: "POST",
  path: "/api/training/agent/session-completed",
  body: {
    sessionId: v.id("trainingSessions"),
    finalDifficultyLevel: v.number(),
    finalEmotionalState: v.string(),
    whisperCount: v.number(),
    branchPointCount: v.number(),
    totalTurns: v.number(),
    completionReason: v.union(
      v.literal("natural_end"),
      v.literal("user_ended"),
      v.literal("timeout"),
      v.literal("error")
    ),
  },
  returns: v.object({
    success: v.boolean(),
    willScore: v.boolean(),
  }),
};

/**
 * Agent reports error
 *
 * @auth Agent service token
 */
export const httpAgentReportError = {
  method: "POST",
  path: "/api/training/agent/error",
  body: {
    sessionId: v.id("trainingSessions"),
    errorType: v.string(),
    errorMessage: v.string(),
    errorStack: v.optional(v.string()),
    recoverable: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

// =============================================================================
// QUERIES (Agent → Convex via HTTP)
// =============================================================================

/**
 * Agent gets session configuration
 *
 * @auth Agent service token
 */
export const httpAgentGetSessionConfig = {
  method: "GET",
  path: "/api/training/agent/session/:sessionId/config",
  params: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.object({
    session: v.object({
      mode: v.union(v.literal("practice"), v.literal("evaluation")),
      language: v.string(),
      consentSnapshot: v.object({
        voiceRecording: v.boolean(),
        transcriptStorage: v.boolean(),
        performanceAnalysis: v.boolean(),
        aiCoaching: v.boolean(),
      }),
    }),
    user: v.object({
      id: v.string(),
      name: v.string(),
    }),
    persona: v.object({
      name: v.string(),
      role: v.string(),
      company: v.string(),
      industry: v.string(),
      personality: v.string(),
      communicationStyle: v.string(),
      painPoints: v.array(v.string()),
      baseDifficulty: v.number(),
      objectionTypes: v.array(v.string()),
      cartesiaVoiceId: v.string(),
      language: v.string(),
      culturalNotes: v.optional(v.string()),
    }),
    scenario: v.object({
      name: v.string(),
      type: v.string(),
      difficulty: v.number(),
      estimatedDuration: v.number(),
      objectives: v.array(v.object({
        id: v.string(),
        description: v.string(),
        weight: v.number(),
        methodology: v.optional(v.string()),
      })),
      openingContext: v.string(),
      successCriteria: v.array(v.string()),
      keyMoments: v.array(v.object({
        momentType: v.string(),
        description: v.string(),
        triggerConditions: v.array(v.string()),
      })),
    }),
  }),
};

/**
 * Agent gets transcript for current session
 *
 * @auth Agent service token
 */
export const httpAgentGetTranscript = {
  method: "GET",
  path: "/api/training/agent/session/:sessionId/transcript",
  params: {
    sessionId: v.id("trainingSessions"),
  },
  query: {
    fromTurn: v.optional(v.number()),
  },
  returns: v.object({
    entries: v.array(v.object({
      turnIndex: v.number(),
      speaker: v.union(v.literal("bdr"), v.literal("ai")),
      content: v.string(),
      timestamp: v.number(),
    })),
    totalTurns: v.number(),
  }),
};

// =============================================================================
// INTERNAL MUTATIONS (Called by HTTP handlers)
// =============================================================================

/**
 * Internal: Store agent checkpoint
 *
 * @internal
 */
export const internalStoreCheckpoint = {
  args: {
    sessionId: v.id("trainingSessions"),
    agentState: v.object({
      difficultyLevel: v.number(),
      emotionalState: v.string(),
      conversationBuffer: v.array(v.object({
        role: v.string(),
        content: v.string(),
      })),
      pendingWhispers: v.array(v.string()),
    }),
    lastTurnIndex: v.number(),
    lastTranscriptId: v.optional(v.id("trainingTranscripts")),
    checkpointNumber: v.number(),
  },
  returns: v.object({
    checkpointId: v.id("trainingCheckpoints"),
  }),
};

/**
 * Internal: Verify agent service token
 *
 * @internal
 */
export const internalVerifyAgentToken = {
  args: {
    token: v.string(),
  },
  returns: v.object({
    valid: v.boolean(),
    agentId: v.optional(v.string()),
  }),
};
