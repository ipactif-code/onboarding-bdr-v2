import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

// ============================================================================
// Course Enrollment Sync Mutations
// ============================================================================
// These mutations sync channel membership when users are assigned/unassigned
// from courses. NO auth checks needed - internal only.
// ============================================================================

/**
 * Add a user to a course channel when they are enrolled in the course.
 *
 * T060: Finds the course channel by courseId and adds the user as a member.
 * Handles case where user was previously a member (rejoin).
 *
 * @param courseId - The ID of the course
 * @param userId - The ID of the user being enrolled
 * @returns null
 */
export const addCourseEnrollee = internalMutation({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find the course channel
    const channel = await ctx.db
      .query("channels")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .unique();

    if (!channel) {
      // No channel exists for this course yet - this may happen if
      // the course hasn't been published yet. Silently skip.
      return null;
    }

    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user already has a membership
    const existingMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", channel._id).eq("userId", args.userId)
      )
      .unique();

    const now = Date.now();

    if (existingMembership) {
      // User was previously a member
      if (existingMembership.isBanned) {
        // Don't re-add banned users automatically
        return null;
      }

      if (existingMembership.leftAt) {
        // Rejoin - clear leftAt and update joinedAt
        await ctx.db.patch(existingMembership._id, {
          leftAt: undefined,
          joinedAt: now,
        });

        // Update member count
        await ctx.db.patch(channel._id, {
          memberCount: channel.memberCount + 1,
        });
      }
      // If already an active member, do nothing
      return null;
    }

    // New membership
    await ctx.db.insert("channelMembers", {
      channelId: channel._id,
      userId: args.userId,
      role: "member",
      joinedAt: now,
      notificationLevel: "all",
      isMuted: false,
      isBanned: false,
    });

    // Update member count
    await ctx.db.patch(channel._id, {
      memberCount: channel.memberCount + 1,
    });

    return null;
  },
});

/**
 * Remove a user from a course channel when they are unassigned from the course.
 *
 * T061: Finds the course channel by courseId and soft-leaves the user
 * (sets leftAt timestamp).
 *
 * @param courseId - The ID of the course
 * @param userId - The ID of the user being removed
 * @returns null
 */
export const removeCourseEnrollee = internalMutation({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find the course channel
    const channel = await ctx.db
      .query("channels")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .unique();

    if (!channel) {
      // No channel exists for this course - nothing to do
      return null;
    }

    // Find user's membership
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", channel._id).eq("userId", args.userId)
      )
      .unique();

    if (!membership) {
      // User is not a member - nothing to do
      return null;
    }

    if (membership.leftAt) {
      // User already left - nothing to do
      return null;
    }

    // Don't allow course creator (owner) to be removed
    if (membership.role === "owner") {
      // Silently skip - owner cannot be removed from course channel
      return null;
    }

    // Soft leave - set leftAt timestamp
    await ctx.db.patch(membership._id, {
      leftAt: Date.now(),
    });

    // Update member count
    await ctx.db.patch(channel._id, {
      memberCount: Math.max(0, channel.memberCount - 1),
    });

    return null;
  },
});
