/**
 * API Contracts: Audit Logs
 *
 * Compliance audit trail for key onboarding actions.
 */

import { v } from "convex/values";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Query audit logs with filters.
 *
 * Admin only.
 */
export const list = {
  args: {
    // Filters
    actorId: v.optional(v.id("users")),
    targetUserId: v.optional(v.id("users")),
    action: v.optional(
      v.union(
        v.literal("validation_approved"),
        v.literal("validation_rejected"),
        v.literal("role_changed"),
        v.literal("track_assigned"),
        v.literal("track_paused"),
        v.literal("track_resumed"),
        v.literal("template_created"),
        v.literal("template_modified"),
        v.literal("template_archived")
      )
    ),
    entityType: v.optional(
      v.union(
        v.literal("userOnboarding"),
        v.literal("userOnboardingItem"),
        v.literal("onboardingTrack"),
        v.literal("teamMember")
      )
    ),
    entityId: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    // Pagination
    limit: v.optional(v.number()), // default: 50
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    logs: v.array(
      v.object({
        _id: v.id("auditLogs"),
        action: v.union(
          v.literal("validation_approved"),
          v.literal("validation_rejected"),
          v.literal("role_changed"),
          v.literal("track_assigned"),
          v.literal("track_paused"),
          v.literal("track_resumed"),
          v.literal("template_created"),
          v.literal("template_modified"),
          v.literal("template_archived")
        ),
        actor: v.object({
          _id: v.id("users"),
          name: v.string(),
          email: v.string(),
        }),
        targetUser: v.optional(
          v.object({
            _id: v.id("users"),
            name: v.string(),
            email: v.string(),
          })
        ),
        entityType: v.union(
          v.literal("userOnboarding"),
          v.literal("userOnboardingItem"),
          v.literal("onboardingTrack"),
          v.literal("teamMember")
        ),
        entityId: v.string(),
        entityName: v.optional(v.string()), // resolved entity name for display
        metadata: v.optional(v.any()),
        createdAt: v.number(),
      })
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
  }),
};

/**
 * Get audit history for a specific entity.
 */
export const getForEntity = {
  args: {
    entityType: v.union(
      v.literal("userOnboarding"),
      v.literal("userOnboardingItem"),
      v.literal("onboardingTrack"),
      v.literal("teamMember")
    ),
    entityId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("auditLogs"),
      action: v.union(
        v.literal("validation_approved"),
        v.literal("validation_rejected"),
        v.literal("role_changed"),
        v.literal("track_assigned"),
        v.literal("track_paused"),
        v.literal("track_resumed"),
        v.literal("template_created"),
        v.literal("template_modified"),
        v.literal("template_archived")
      ),
      actor: v.object({
        _id: v.id("users"),
        name: v.string(),
      }),
      metadata: v.optional(v.any()),
      createdAt: v.number(),
    })
  ),
};

// ============================================================================
// INTERNAL MUTATIONS
// ============================================================================

/**
 * Log an audit event.
 *
 * Internal function called by other mutations.
 */
export const log = {
  args: {
    action: v.union(
      v.literal("validation_approved"),
      v.literal("validation_rejected"),
      v.literal("role_changed"),
      v.literal("track_assigned"),
      v.literal("track_paused"),
      v.literal("track_resumed"),
      v.literal("template_created"),
      v.literal("template_modified"),
      v.literal("template_archived")
    ),
    actorId: v.id("users"),
    targetUserId: v.optional(v.id("users")),
    entityType: v.union(
      v.literal("userOnboarding"),
      v.literal("userOnboardingItem"),
      v.literal("onboardingTrack"),
      v.literal("teamMember")
    ),
    entityId: v.string(),
    metadata: v.optional(v.any()),
  },
  returns: v.id("auditLogs"),
};
