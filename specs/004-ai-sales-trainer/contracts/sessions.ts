/**
 * AI Sales Trainer - Session Management Contracts
 *
 * Convex function signatures for session lifecycle management.
 * All functions follow constitution Article XI patterns.
 */

import { v } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";

// =============================================================================
// TYPES
// =============================================================================

export type SessionMode = "practice" | "evaluation";

export type SessionStatus =
  | "pending"
  | "connecting"
  | "active"
  | "paused"
  | "completed"
  | "abandoned"
  | "error";

export interface ConsentSnapshot {
  voiceRecording: boolean;
  transcriptStorage: boolean;
  performanceAnalysis: boolean;
  aiCoaching: boolean;
  consentVersion: string;
}

export interface SessionConfig {
  personaId: Id<"trainingPersonas">;
  scenarioId: Id<"trainingScenarios">;
  mode: SessionMode;
  evaluationId?: Id<"trainingEvaluations">;
  language: string;
}

export interface SessionResponse {
  sessionId: Id<"trainingSessions">;
  livekitRoomName: string;
  livekitToken: string;
  persona: {
    name: string;
    role: string;
    company: string;
    avatarId: string;
  };
  scenario: {
    name: string;
    objectives: Array<{ id: string; description: string }>;
  };
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get a single session by ID
 *
 * @auth Required - Must own session or be manager of session owner
 */
export const getSession = {
  args: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("trainingSessions"),
      userId: v.id("users"),
      personaId: v.id("trainingPersonas"),
      scenarioId: v.id("trainingScenarios"),
      mode: v.union(v.literal("practice"), v.literal("evaluation")),
      status: v.union(
        v.literal("pending"),
        v.literal("connecting"),
        v.literal("active"),
        v.literal("paused"),
        v.literal("completed"),
        v.literal("abandoned"),
        v.literal("error")
      ),
      startedAt: v.optional(v.number()),
      endedAt: v.optional(v.number()),
      duration: v.optional(v.number()),
      language: v.string(),
      createdAt: v.number(),
      // Joined data
      persona: v.object({
        name: v.string(),
        role: v.string(),
        company: v.string(),
      }),
      scenario: v.object({
        name: v.string(),
        type: v.string(),
      }),
      score: v.optional(v.object({
        overallScore: v.number(),
        passed: v.boolean(),
      })),
    }),
    v.null()
  ),
};

/**
 * List sessions for the current user
 *
 * @auth Required
 */
export const listMySessions = {
  args: {
    mode: v.optional(v.union(v.literal("practice"), v.literal("evaluation"))),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("completed"),
        v.literal("abandoned")
      )
    ),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    sessions: v.array(
      v.object({
        _id: v.id("trainingSessions"),
        mode: v.union(v.literal("practice"), v.literal("evaluation")),
        status: v.string(),
        personaName: v.string(),
        scenarioName: v.string(),
        score: v.optional(v.number()),
        duration: v.optional(v.number()),
        createdAt: v.number(),
      })
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
  }),
};

/**
 * Get session statistics for dashboard
 *
 * @auth Required
 */
export const getMySessionStats = {
  args: {},
  returns: v.object({
    totalSessions: v.number(),
    completedSessions: v.number(),
    averageScore: v.optional(v.number()),
    sessionsThisWeek: v.number(),
    practiceVsEvaluation: v.object({
      practice: v.number(),
      evaluation: v.number(),
    }),
    scoreProgression: v.array(
      v.object({
        date: v.string(),
        score: v.number(),
      })
    ),
  }),
};

/**
 * Get active session if one exists (for reconnection)
 *
 * @auth Required
 */
export const getActiveSession = {
  args: {},
  returns: v.union(
    v.object({
      sessionId: v.id("trainingSessions"),
      livekitRoomName: v.string(),
      status: v.string(),
      startedAt: v.number(),
    }),
    v.null()
  ),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Start a new training session
 *
 * Validates consent, creates session, generates LiveKit token.
 *
 * @auth Required
 * @consent voiceRecording required; transcriptStorage required for evaluations
 */
export const startSession = {
  args: {
    personaId: v.id("trainingPersonas"),
    scenarioId: v.id("trainingScenarios"),
    mode: v.union(v.literal("practice"), v.literal("evaluation")),
    evaluationId: v.optional(v.id("trainingEvaluations")),
    language: v.string(),
  },
  returns: v.object({
    sessionId: v.id("trainingSessions"),
    livekitRoomName: v.string(),
    livekitToken: v.string(),
    persona: v.object({
      name: v.string(),
      role: v.string(),
      company: v.string(),
      cartesiaVoiceId: v.string(),
      simliAvatarId: v.string(),
    }),
    scenario: v.object({
      name: v.string(),
      objectives: v.array(
        v.object({
          id: v.string(),
          description: v.string(),
          weight: v.number(),
        })
      ),
      openingContext: v.string(),
    }),
  }),
};

/**
 * Update session status
 *
 * @auth Required - Must own session
 */
export const updateSessionStatus = {
  args: {
    sessionId: v.id("trainingSessions"),
    status: v.union(
      v.literal("connecting"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("abandoned"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

/**
 * End a session (normal completion or abandonment)
 *
 * @auth Required - Must own session
 */
export const endSession = {
  args: {
    sessionId: v.id("trainingSessions"),
    reason: v.union(v.literal("completed"), v.literal("abandoned")),
  },
  returns: v.object({
    success: v.boolean(),
    duration: v.number(),
    willScore: v.boolean(), // Whether scoring will be triggered
  }),
};

/**
 * Pause a practice session
 *
 * @auth Required - Must own session, practice mode only
 */
export const pauseSession = {
  args: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

/**
 * Resume a paused practice session
 *
 * @auth Required - Must own session
 */
export const resumeSession = {
  args: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.object({
    success: v.boolean(),
    livekitToken: v.string(), // Fresh token for reconnection
  }),
};

// =============================================================================
// INTERNAL MUTATIONS (for agent bridge)
// =============================================================================

/**
 * Update session with final metrics (called by agent on completion)
 *
 * @internal Agent service token required
 */
export const internalUpdateSessionMetrics = {
  args: {
    sessionId: v.id("trainingSessions"),
    finalDifficultyLevel: v.number(),
    finalEmotionalState: v.string(),
    whisperCount: v.number(),
    branchPointCount: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};
