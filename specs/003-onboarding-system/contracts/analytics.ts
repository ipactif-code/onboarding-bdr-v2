/**
 * API Contracts: Onboarding Analytics
 *
 * Dashboard queries for tracking onboarding progress and metrics.
 */

import { v } from "convex/values";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get global onboarding statistics.
 *
 * Admins see all data. TLs see global stats (per FR-040).
 */
export const getGlobalStats = {
  args: {},
  returns: v.object({
    // Active tracks
    activeTrackCount: v.number(),
    completedTrackCount: v.number(),
    pausedTrackCount: v.number(),

    // Completion metrics
    averageCompletionRate: v.number(), // 0-100
    averageCompletionTime: v.optional(v.number()), // days, null if no completions

    // Trends (last 30 days)
    tracksAssignedLast30Days: v.number(),
    tracksCompletedLast30Days: v.number(),

    // Overdue
    overdueItemCount: v.number(),
    usersWithOverdueItems: v.number(),

    // Validation backlog
    pendingValidationCount: v.number(),
  }),
};

/**
 * Get statistics for a specific team.
 *
 * Requires TL role for the team or Admin.
 */
export const getTeamStats = {
  args: {
    teamId: v.id("teams"),
  },
  returns: v.object({
    // Team overview
    teamMemberCount: v.number(),
    membersWithActiveTrack: v.number(),

    // Track status
    activeTrackCount: v.number(),
    completedTrackCount: v.number(),
    pausedTrackCount: v.number(),

    // Completion metrics
    averageCompletionRate: v.number(),
    averageCompletionTime: v.optional(v.number()),

    // Health indicators
    overdueItemCount: v.number(),
    usersWithOverdueItems: v.number(),
    pendingValidationCount: v.number(),

    // Member breakdown
    members: v.array(
      v.object({
        user: v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        }),
        activeTrackCount: v.number(),
        latestTrackProgress: v.optional(v.number()),
        hasOverdueItems: v.boolean(),
      })
    ),
  }),
};

/**
 * Get template usage statistics.
 */
export const getTemplateStats = {
  args: {
    trackId: v.id("onboardingTracks"),
  },
  returns: v.object({
    // Usage
    totalAssignments: v.number(),
    activeAssignments: v.number(),
    completedAssignments: v.number(),

    // Completion metrics
    averageCompletionRate: v.number(),
    averageCompletionTime: v.optional(v.number()),

    // Item-level analysis
    items: v.array(
      v.object({
        _id: v.id("onboardingTrackItems"),
        title: v.string(),
        type: v.string(),
        completionRate: v.number(), // % of assigned users who completed
        averageCompletionTime: v.optional(v.number()), // days from start
        overdueCount: v.number(),
      })
    ),
  }),
};

/**
 * Get completion funnel data.
 *
 * Shows drop-off at each week of onboarding.
 */
export const getCompletionFunnel = {
  args: {
    trackId: v.optional(v.id("onboardingTracks")),
    teamId: v.optional(v.id("teams")),
  },
  returns: v.array(
    v.object({
      week: v.number(), // 1, 2, 3, etc.
      usersAtStart: v.number(),
      usersCompleted: v.number(),
      usersDropped: v.number(), // paused or not progressing
      averageProgress: v.number(),
    })
  ),
};

/**
 * Get onboarding timeline for Gantt-style visualization.
 */
export const getTimeline = {
  args: {
    teamId: v.optional(v.id("teams")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      user: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      tracks: v.array(
        v.object({
          _id: v.id("userOnboardings"),
          trackName: v.string(),
          startDate: v.number(),
          dueDate: v.number(),
          completedAt: v.optional(v.number()),
          progressPercentage: v.number(),
          status: v.union(
            v.literal("pending"),
            v.literal("in_progress"),
            v.literal("completed"),
            v.literal("paused")
          ),
          isOverdue: v.boolean(),
        })
      ),
    })
  ),
};
