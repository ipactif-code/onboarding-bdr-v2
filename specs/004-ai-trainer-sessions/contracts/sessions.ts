/**
 * API Contracts: Training Sessions
 *
 * Feature: 004-ai-trainer-sessions
 * These are TYPE DEFINITIONS only - not the actual implementation.
 * Implementation will be in convex/aiTrainer/*.ts
 */

import { v } from "convex/values";
import type { Id } from "convex/_generated/dataModel";

// =============================================================================
// TYPES
// =============================================================================

export type SessionStatus = "pending" | "active" | "completed" | "abandoned" | "expired";
export type SessionMode = "free" | "evaluation";
export type Language = "fr" | "en" | "it" | "de" | "es";
export type ScenarioIdentifier = "cold_call" | "discovery";
export type Difficulty = "easy" | "medium" | "hard" | "very_hard";

export interface TrainingSession {
  _id: Id<"trainingSessions">;
  userId: Id<"users">;
  organizationId: string;
  scenarioId: Id<"aiTrainerScenarios">;
  personaId: Id<"aiTrainerPersonas">;
  language: Language;
  mode: SessionMode;
  evaluationAssignmentId?: Id<"evaluationAssignments">;
  livekitRoomName?: string;
  livekitRoomCreatedAt?: number;
  status: SessionStatus;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  durationSeconds?: number;
  lastHeartbeatAt?: number;
  scenarioIdentifier: ScenarioIdentifier;
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get available scenarios for session setup
 * @returns List of scenarios with localized display info
 */
export const listScenarios = {
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("aiTrainerScenarios"),
      identifier: v.string(),
      nameKey: v.string(),
      descriptionKey: v.string(),
      expectedDurationMin: v.number(),
      expectedDurationMax: v.number(),
    })
  ),
};

/**
 * Get available personas for a given scenario
 * @param scenarioId - The scenario to filter personas by
 * @param language - Language for localized content
 * @returns List of personas compatible with scenario, with unlock status
 */
export const listPersonas = {
  args: {
    scenarioId: v.id("aiTrainerScenarios"),
    language: v.union(
      v.literal("fr"),
      v.literal("en"),
      v.literal("it"),
      v.literal("de"),
      v.literal("es")
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("aiTrainerPersonas"),
      identifier: v.string(),
      name: v.string(),
      roleTitle: v.string(),
      company: v.string(),
      difficulty: v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard"),
        v.literal("very_hard")
      ),
      isUnlocked: v.boolean(),
      requiredCompletedSessions: v.number(),
      userCompletedSessions: v.number(),
    })
  ),
};

/**
 * Get user's session history with pagination and filters
 * @param filters - Optional filters for scenario, language, date range
 * @param paginationOpts - Pagination options (cursor, limit)
 * @returns Paginated list of sessions
 */
export const listMySessions = {
  args: {
    filters: v.optional(
      v.object({
        scenarioIdentifier: v.optional(v.string()),
        language: v.optional(
          v.union(
            v.literal("fr"),
            v.literal("en"),
            v.literal("it"),
            v.literal("de"),
            v.literal("es")
          )
        ),
        mode: v.optional(v.union(v.literal("free"), v.literal("evaluation"))),
        dateFrom: v.optional(v.number()),
        dateTo: v.optional(v.number()),
      })
    ),
    paginationOpts: v.object({
      cursor: v.optional(v.string()),
      numItems: v.optional(v.number()), // Default 20
    }),
  },
  returns: v.object({
    sessions: v.array(
      v.object({
        _id: v.id("trainingSessions"),
        scenarioIdentifier: v.string(),
        personaName: v.string(),
        language: v.string(),
        mode: v.string(),
        status: v.string(),
        createdAt: v.number(),
        startedAt: v.optional(v.number()),
        endedAt: v.optional(v.number()),
        durationSeconds: v.optional(v.number()),
      })
    ),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
};

/**
 * Get a single session by ID
 * @param sessionId - The session to retrieve
 * @returns Full session details or null if not found/unauthorized
 */
export const getSession = {
  args: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("trainingSessions"),
      userId: v.id("users"),
      scenarioId: v.id("aiTrainerScenarios"),
      personaId: v.id("aiTrainerPersonas"),
      scenarioIdentifier: v.string(),
      scenarioName: v.string(),
      personaName: v.string(),
      personaRoleTitle: v.string(),
      language: v.string(),
      mode: v.string(),
      status: v.string(),
      livekitRoomName: v.optional(v.string()),
      createdAt: v.number(),
      startedAt: v.optional(v.number()),
      endedAt: v.optional(v.number()),
      durationSeconds: v.optional(v.number()),
      evaluationAssignmentId: v.optional(v.id("evaluationAssignments")),
    }),
    v.null()
  ),
};

/**
 * Get user's active session if any
 * @returns Active session or null
 */
export const getActiveSession = {
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("trainingSessions"),
      scenarioIdentifier: v.string(),
      personaName: v.string(),
      language: v.string(),
      mode: v.string(),
      livekitRoomName: v.optional(v.string()),
      startedAt: v.optional(v.number()),
    }),
    v.null()
  ),
};

/**
 * Get count of user's completed sessions by difficulty
 * Used for persona unlock checks
 */
export const getCompletedSessionStats = {
  args: {},
  returns: v.object({
    total: v.number(),
    byDifficulty: v.object({
      easy: v.number(),
      medium: v.number(),
      hard: v.number(),
      very_hard: v.number(),
    }),
  }),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Create a new training session (free mode)
 * @param scenarioId - Selected scenario
 * @param personaId - Selected persona
 * @param language - Session language
 * @returns New session ID
 * @throws If org concurrent limit reached, persona locked, or invalid selection
 */
export const createSession = {
  args: {
    scenarioId: v.id("aiTrainerScenarios"),
    personaId: v.id("aiTrainerPersonas"),
    language: v.union(
      v.literal("fr"),
      v.literal("en"),
      v.literal("it"),
      v.literal("de"),
      v.literal("es")
    ),
  },
  returns: v.object({
    sessionId: v.id("trainingSessions"),
  }),
};

/**
 * Start a session (transition from pending to active)
 * Called when LiveKit room connection is established
 * @param sessionId - The session to start
 * @throws If session not in pending state or not owned by user
 */
export const startSession = {
  args: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

/**
 * End a session (transition from active to completed)
 * @param sessionId - The session to end
 * @throws If session not active or not owned by user
 */
export const endSession = {
  args: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.object({
    success: v.boolean(),
    durationSeconds: v.number(),
  }),
};

/**
 * Send heartbeat to keep session alive
 * @param sessionId - The session to heartbeat
 */
export const heartbeat = {
  args: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

// =============================================================================
// ACTIONS (External API calls)
// =============================================================================

/**
 * Create LiveKit room for a session
 * Called after session creation
 * @param sessionId - The session to create room for
 * @returns Room name and connection info
 */
export const createLivekitRoom = {
  args: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.object({
    roomName: v.string(),
    serverUrl: v.string(),
  }),
};

/**
 * Generate LiveKit access token for user
 * @param sessionId - The session to join
 * @returns JWT token for LiveKit connection
 */
export const generateLivekitToken = {
  args: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.object({
    token: v.string(),
    roomName: v.string(),
    serverUrl: v.string(),
  }),
};

// =============================================================================
// INTERNAL MUTATIONS (Called by cron jobs)
// =============================================================================

/**
 * Mark stale sessions as abandoned
 * Called every minute by cron
 * Threshold: 2 minutes since last heartbeat
 */
export const checkStaleSessions = {
  args: {},
  returns: v.object({
    abandonedCount: v.number(),
  }),
};

/**
 * Mark expired sessions (timeout reached)
 * Called every minute by cron
 * Cold Call: 60 min, Discovery: 90 min
 */
export const checkExpiredSessions = {
  args: {},
  returns: v.object({
    expiredCount: v.number(),
  }),
};
