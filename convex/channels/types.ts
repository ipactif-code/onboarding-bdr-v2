import { v } from "convex/values";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Channel with user membership information.
 */
export const channelWithMembershipValidator = v.object({
  _id: v.id("channels"),
  name: v.string(),
  description: v.optional(v.string()),
  topic: v.optional(v.string()),
  type: v.union(v.literal("public"), v.literal("private"), v.literal("course")),
  courseId: v.optional(v.id("courses")),
  creatorId: v.id("users"),
  createdAt: v.number(),
  isArchived: v.boolean(),
  memberCount: v.number(),
  lastMessageAt: v.optional(v.number()),
  // Membership info (null if not a member)
  membership: v.union(
    v.object({
      role: v.union(
        v.literal("owner"),
        v.literal("admin"),
        v.literal("moderator"),
        v.literal("member")
      ),
      joinedAt: v.number(),
      notificationLevel: v.union(
        v.literal("all"),
        v.literal("mentions"),
        v.literal("none")
      ),
      isMuted: v.boolean(),
      unreadCount: v.number(),
      lastReadAt: v.optional(v.number()),
      isFavorite: v.optional(v.boolean()),
    }),
    v.null()
  ),
});

/**
 * Member information validator for getMembers query.
 */
export const memberInfoValidator = v.object({
  _id: v.id("channelMembers"),
  userId: v.id("users"),
  userName: v.string(),
  userEmail: v.string(),
  userAvatarUrl: v.optional(v.string()),
  userStatus: v.union(
    v.literal("online"),
    v.literal("offline"),
    v.literal("away"),
    v.literal("dnd")
  ),
  role: v.union(
    v.literal("owner"),
    v.literal("admin"),
    v.literal("moderator"),
    v.literal("member")
  ),
  joinedAt: v.number(),
});
