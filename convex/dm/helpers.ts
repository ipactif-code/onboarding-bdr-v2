import { v } from "convex/values";

// ============================================================================
// Direct Messages & Group DM Helpers
// Shared validators and constants for DM module
// ============================================================================

/**
 * Maximum number of participants allowed in a group DM.
 * FR-008: Group DM size limited to 2-8 participants total.
 */
export const MAX_GROUP_PARTICIPANTS = 8;

/**
 * Minimum number of other participants required for a group DM.
 * (Excluding the creator)
 */
export const MIN_GROUP_PARTICIPANTS = 2;

/**
 * Maximum length for group names.
 */
export const MAX_GROUP_NAME_LENGTH = 100;

/**
 * User status literal validator - shared across queries.
 */
export const userStatusValidator = v.union(
  v.literal("online"),
  v.literal("offline"),
  v.literal("away"),
  v.literal("dnd")
);

/**
 * Participant with user details validator - used by getParticipants query.
 */
export const participantWithDetailsValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  email: v.string(),
  avatarUrl: v.optional(v.string()),
  status: userStatusValidator,
  joinedAt: v.number(),
  isCurrentUser: v.boolean(),
});

/**
 * Search result user validator - used by searchUsers query.
 */
export const searchUserResultValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  email: v.string(),
  avatarUrl: v.optional(v.string()),
  status: userStatusValidator,
});

/**
 * Group details validator - used by getGroupDetails query.
 */
export const groupDetailsValidator = v.object({
  _id: v.id("conversations"),
  type: v.literal("group"),
  name: v.optional(v.string()),
  createdAt: v.optional(v.number()),
  participantCount: v.number(),
  isActive: v.optional(v.boolean()),
});
