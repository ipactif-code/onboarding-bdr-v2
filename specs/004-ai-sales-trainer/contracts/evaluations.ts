/**
 * AI Sales Trainer - Evaluation Assignment Contracts
 *
 * Convex function signatures for manager-assigned evaluations.
 * Managers can only assign evaluations to their direct reports.
 */

import { v } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";

// =============================================================================
// TYPES
// =============================================================================

export type EvaluationStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "expired";

export interface EvaluationAssignment {
  assigneeId: Id<"users">;
  personaId: Id<"trainingPersonas">;
  scenarioId: Id<"trainingScenarios">;
  dueBy: number;
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get pending evaluations assigned to current user
 *
 * @auth Required
 */
export const getMyPendingEvaluations = {
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("trainingEvaluations"),
      personaId: v.id("trainingPersonas"),
      personaName: v.string(),
      personaRole: v.string(),
      scenarioId: v.id("trainingScenarios"),
      scenarioName: v.string(),
      scenarioType: v.string(),
      assignedBy: v.object({
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      dueBy: v.number(),
      daysRemaining: v.number(),
      createdAt: v.number(),
    })
  ),
};

/**
 * Get completed evaluations for current user
 *
 * @auth Required
 */
export const getMyCompletedEvaluations = {
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("trainingEvaluations"),
      personaName: v.string(),
      scenarioName: v.string(),
      score: v.number(),
      passed: v.boolean(),
      completedAt: v.number(),
      managerReviewed: v.boolean(),
      managerComments: v.optional(v.string()),
    })
  ),
};

/**
 * Get evaluations assigned by current manager
 *
 * @auth Required - Manager role
 */
export const getAssignedEvaluations = {
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("expired")
      )
    ),
    assigneeId: v.optional(v.id("users")),
  },
  returns: v.array(
    v.object({
      _id: v.id("trainingEvaluations"),
      assignee: v.object({
        _id: v.id("users"),
        name: v.string(),
        email: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      personaName: v.string(),
      scenarioName: v.string(),
      status: v.string(),
      dueBy: v.number(),
      score: v.optional(v.number()),
      passed: v.optional(v.boolean()),
      completedAt: v.optional(v.number()),
      managerReviewedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
  ),
};

/**
 * Get team members that manager can assign evaluations to
 *
 * @auth Required - Manager role
 */
export const getAssignableTeamMembers = {
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      avatarUrl: v.optional(v.string()),
      pendingEvaluations: v.number(),
      completedEvaluations: v.number(),
      averageScore: v.optional(v.number()),
    })
  ),
};

/**
 * Get single evaluation details (for review)
 *
 * @auth Required - Must be assignee or assigning manager
 */
export const getEvaluation = {
  args: {
    evaluationId: v.id("trainingEvaluations"),
  },
  returns: v.union(
    v.object({
      _id: v.id("trainingEvaluations"),
      assignee: v.object({
        _id: v.id("users"),
        name: v.string(),
        email: v.string(),
      }),
      assignedBy: v.object({
        _id: v.id("users"),
        name: v.string(),
      }),
      persona: v.object({
        _id: v.id("trainingPersonas"),
        name: v.string(),
        role: v.string(),
        company: v.string(),
      }),
      scenario: v.object({
        _id: v.id("trainingScenarios"),
        name: v.string(),
        type: v.string(),
        objectives: v.array(
          v.object({
            id: v.string(),
            description: v.string(),
          })
        ),
      }),
      status: v.string(),
      dueBy: v.number(),
      session: v.optional(
        v.object({
          _id: v.id("trainingSessions"),
          duration: v.number(),
          completedAt: v.number(),
        })
      ),
      score: v.optional(
        v.object({
          overallScore: v.number(),
          passed: v.boolean(),
          categoryScores: v.any(),
          strengths: v.array(v.string()),
          improvements: v.array(v.string()),
        })
      ),
      managerReviewedAt: v.optional(v.number()),
      managerComments: v.optional(v.string()),
      createdAt: v.number(),
    }),
    v.null()
  ),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Assign an evaluation to a team member
 *
 * @auth Required - Manager role, must manage the assignee
 */
export const assignEvaluation = {
  args: {
    assigneeId: v.id("users"),
    personaId: v.id("trainingPersonas"),
    scenarioId: v.id("trainingScenarios"),
    dueBy: v.number(), // Timestamp
  },
  returns: v.object({
    evaluationId: v.id("trainingEvaluations"),
    notificationSent: v.boolean(),
  }),
};

/**
 * Bulk assign evaluations to multiple team members
 *
 * @auth Required - Manager role
 */
export const bulkAssignEvaluations = {
  args: {
    assignments: v.array(
      v.object({
        assigneeId: v.id("users"),
        personaId: v.id("trainingPersonas"),
        scenarioId: v.id("trainingScenarios"),
        dueBy: v.number(),
      })
    ),
  },
  returns: v.object({
    created: v.number(),
    failed: v.number(),
    errors: v.array(
      v.object({
        assigneeId: v.id("users"),
        error: v.string(),
      })
    ),
  }),
};

/**
 * Cancel a pending evaluation
 *
 * @auth Required - Manager who assigned it
 */
export const cancelEvaluation = {
  args: {
    evaluationId: v.id("trainingEvaluations"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

/**
 * Extend evaluation deadline
 *
 * @auth Required - Manager who assigned it
 */
export const extendDeadline = {
  args: {
    evaluationId: v.id("trainingEvaluations"),
    newDueBy: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    notificationSent: v.boolean(),
  }),
};

/**
 * Add manager review comments to completed evaluation
 *
 * @auth Required - Manager who assigned it
 */
export const addManagerReview = {
  args: {
    evaluationId: v.id("trainingEvaluations"),
    comments: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

/**
 * Send reminder for pending evaluation
 *
 * @auth Required - Manager who assigned it
 */
export const sendReminder = {
  args: {
    evaluationId: v.id("trainingEvaluations"),
  },
  returns: v.object({
    success: v.boolean(),
    reminderSentAt: v.number(),
  }),
};

// =============================================================================
// INTERNAL MUTATIONS
// =============================================================================

/**
 * Mark evaluation as in_progress when session starts
 *
 * @internal Called by startSession mutation
 */
export const internalMarkInProgress = {
  args: {
    evaluationId: v.id("trainingEvaluations"),
    sessionId: v.id("trainingSessions"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

/**
 * Complete evaluation when session ends
 *
 * @internal Called by scoring action
 */
export const internalCompleteEvaluation = {
  args: {
    evaluationId: v.id("trainingEvaluations"),
    sessionId: v.id("trainingSessions"),
    score: v.number(),
    passed: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

/**
 * Mark overdue evaluations as expired (cron job)
 *
 * @internal Called by cron
 */
export const internalExpireOverdueEvaluations = {
  args: {},
  returns: v.object({
    expired: v.number(),
  }),
};
