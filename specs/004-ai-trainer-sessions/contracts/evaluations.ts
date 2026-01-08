/**
 * API Contracts: Evaluation Assignments
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

export type EvaluationStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "locked"
  | "closed";

export interface EvaluationAssignment {
  _id: Id<"evaluationAssignments">;
  assignedBy: Id<"users">;
  assignedTo: Id<"users">;
  teamId: Id<"teams">;
  scenarioId: Id<"aiTrainerScenarios">;
  personaId: Id<"aiTrainerPersonas">;
  language: "fr" | "en" | "it" | "de" | "es";
  deadline?: number;
  status: EvaluationStatus;
  attemptsUsed: number;
  maxAttempts: number;
  audioConsentGiven: boolean;
  audioConsentAt?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  lockedAt?: number;
}

// =============================================================================
// QUERIES (BDR - Assignee)
// =============================================================================

/**
 * Get my pending and in-progress evaluations
 * @returns List of active evaluation assignments for current user
 */
export const listMyEvaluations = {
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("evaluationAssignments"),
      scenarioIdentifier: v.string(),
      scenarioName: v.string(),
      personaName: v.string(),
      personaRoleTitle: v.string(),
      language: v.string(),
      deadline: v.optional(v.number()),
      status: v.string(),
      attemptsUsed: v.number(),
      maxAttempts: v.number(),
      audioConsentGiven: v.boolean(),
      assignedByName: v.string(),
      createdAt: v.number(),
      canStartAttempt: v.boolean(),
      cooldownEndsAt: v.optional(v.number()),
    })
  ),
};

/**
 * Get a single evaluation assignment details
 * @param assignmentId - The assignment to retrieve
 * @returns Full assignment details or null
 */
export const getEvaluation = {
  args: {
    assignmentId: v.id("evaluationAssignments"),
  },
  returns: v.union(
    v.object({
      _id: v.id("evaluationAssignments"),
      scenarioId: v.id("aiTrainerScenarios"),
      personaId: v.id("aiTrainerPersonas"),
      scenarioIdentifier: v.string(),
      scenarioName: v.string(),
      personaName: v.string(),
      personaRoleTitle: v.string(),
      personaCompany: v.string(),
      language: v.string(),
      deadline: v.optional(v.number()),
      status: v.string(),
      attemptsUsed: v.number(),
      maxAttempts: v.number(),
      audioConsentGiven: v.boolean(),
      assignedByName: v.string(),
      teamName: v.string(),
      createdAt: v.number(),
      canStartAttempt: v.boolean(),
      cooldownEndsAt: v.optional(v.number()),
      attempts: v.array(
        v.object({
          sessionId: v.id("trainingSessions"),
          status: v.string(),
          startedAt: v.optional(v.number()),
          endedAt: v.optional(v.number()),
          durationSeconds: v.optional(v.number()),
        })
      ),
    }),
    v.null()
  ),
};

// =============================================================================
// QUERIES (Team Lead - Assigner)
// =============================================================================

/**
 * Get BDRs available for evaluation assignment
 * Only returns members of teams led by current user
 */
export const listAssignableBdrs = {
  args: {
    teamId: v.optional(v.id("teams")), // Filter by specific team
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.string(),
      email: v.string(),
      teamId: v.id("teams"),
      teamName: v.string(),
      pendingEvaluations: v.number(),
    })
  ),
};

/**
 * Get teams led by current user
 */
export const listMyTeams = {
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      name: v.string(),
      memberCount: v.number(),
    })
  ),
};

/**
 * Get evaluations assigned by current user (Team Lead view)
 */
export const listAssignedEvaluations = {
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("locked"),
        v.literal("closed")
      )
    ),
    teamId: v.optional(v.id("teams")),
  },
  returns: v.array(
    v.object({
      _id: v.id("evaluationAssignments"),
      assignedToName: v.string(),
      assignedToEmail: v.string(),
      teamName: v.string(),
      scenarioIdentifier: v.string(),
      personaName: v.string(),
      language: v.string(),
      deadline: v.optional(v.number()),
      status: v.string(),
      attemptsUsed: v.number(),
      maxAttempts: v.number(),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
    })
  ),
};

/**
 * Get session history for a team member (Team Lead view)
 * Read-only access per FR-051
 */
export const listTeamMemberSessions = {
  args: {
    userId: v.id("users"),
    paginationOpts: v.object({
      cursor: v.optional(v.string()),
      numItems: v.optional(v.number()),
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

// =============================================================================
// MUTATIONS (BDR - Assignee)
// =============================================================================

/**
 * Give audio recording consent for an evaluation
 * Required before starting first attempt (FR-019)
 * @param assignmentId - The assignment to consent to
 */
export const giveAudioConsent = {
  args: {
    assignmentId: v.id("evaluationAssignments"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

/**
 * Start an evaluation attempt
 * Creates a session in evaluation mode
 * @param assignmentId - The assignment to attempt
 * @returns New session ID
 * @throws If attempts exhausted, cooldown active, consent not given, or deadline passed
 */
export const startEvaluationAttempt = {
  args: {
    assignmentId: v.id("evaluationAssignments"),
  },
  returns: v.object({
    sessionId: v.id("trainingSessions"),
  }),
};

// =============================================================================
// MUTATIONS (Team Lead - Assigner)
// =============================================================================

/**
 * Create a new evaluation assignment
 * @param assignedTo - BDR to assign to
 * @param teamId - Team context
 * @param scenarioId - Scenario to evaluate
 * @param personaId - Persona to use
 * @param language - Session language
 * @param deadline - Optional deadline timestamp
 * @throws If not Team Lead of team, BDR not in team
 */
export const createEvaluationAssignment = {
  args: {
    assignedTo: v.id("users"),
    teamId: v.id("teams"),
    scenarioId: v.id("aiTrainerScenarios"),
    personaId: v.id("aiTrainerPersonas"),
    language: v.union(
      v.literal("fr"),
      v.literal("en"),
      v.literal("it"),
      v.literal("de"),
      v.literal("es")
    ),
    deadline: v.optional(v.number()),
  },
  returns: v.object({
    assignmentId: v.id("evaluationAssignments"),
  }),
};

/**
 * Extend deadline on a locked evaluation
 * @param assignmentId - The locked assignment
 * @param newDeadline - New deadline timestamp
 * @throws If not assigner, assignment not locked
 */
export const extendDeadline = {
  args: {
    assignmentId: v.id("evaluationAssignments"),
    newDeadline: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

/**
 * Close a locked evaluation (mark as incomplete)
 * @param assignmentId - The locked assignment to close
 * @throws If not assigner, assignment not locked
 */
export const closeEvaluation = {
  args: {
    assignmentId: v.id("evaluationAssignments"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

// =============================================================================
// INTERNAL MUTATIONS (Called by cron jobs)
// =============================================================================

/**
 * Lock evaluations past deadline
 * Called daily by cron
 */
export const lockExpiredEvaluations = {
  args: {},
  returns: v.object({
    lockedCount: v.number(),
  }),
};

/**
 * Send deadline approaching notifications
 * Called daily - 24h before deadline
 */
export const sendDeadlineReminders = {
  args: {},
  returns: v.object({
    notificationsSent: v.number(),
  }),
};
