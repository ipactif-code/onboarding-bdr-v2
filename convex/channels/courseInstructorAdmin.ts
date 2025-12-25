import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

// ============================================================================
// Course Instructor Admin Mutations
// ============================================================================
// These mutations manage instructor privileges in course channels.
// NO auth checks needed - internal only.
// ============================================================================

/**
 * Notify course instructors when a lesson-specific question is posted.
 *
 * T069: Creates mention entries for each instructor to notify them of
 * new questions in course channels.
 *
 * @param channelId - The ID of the course channel
 * @param courseId - The ID of the course
 * @param messageId - The ID of the message posted
 * @param senderId - The ID of the message sender
 * @returns null
 */
export const notifyInstructors = internalMutation({
  args: {
    channelId: v.id("channels"),
    courseId: v.id("courses"),
    messageId: v.id("messages"),
    senderId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find all instructors for this course channel
    // Instructors are identified by channelAdmins with reason: "course_instructor"
    const instructorAdmins = await ctx.db
      .query("channelAdmins")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    // Filter to only course instructors and exclude the sender
    const instructorUserIds = instructorAdmins
      .filter(
        (admin) =>
          admin.reason === "course_instructor" &&
          admin.userId !== args.senderId
      )
      .map((admin) => admin.userId);

    // Create mention entries for each instructor to notify them
    for (const instructorId of instructorUserIds) {
      // Check if instructor is still an active member of the channel
      const membership = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", args.channelId).eq("userId", instructorId)
        )
        .unique();

      // Only notify if the instructor is an active member (not left, not banned)
      if (membership && !membership.leftAt && !membership.isBanned) {
        await ctx.db.insert("mentions", {
          messageId: args.messageId,
          type: "user",
          mentionedUserId: instructorId,
          channelId: args.channelId,
          createdAt: now,
        });
      }
    }

    return null;
  },
});

/**
 * Grant channel admin rights to a course instructor.
 *
 * T064: Creates an entry in channelAdmins table with reason: "course_instructor"
 * and upgrades their channelMembers role to "admin" if they're a member.
 *
 * @param courseId - The ID of the course
 * @param userId - The ID of the instructor
 * @returns null
 */
export const grantCourseInstructorAdmin = internalMutation({
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
      throw new Error("Course channel not found");
    }

    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if admin access already exists
    const existingAdminAccess = await ctx.db
      .query("channelAdmins")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", channel._id).eq("userId", args.userId)
      )
      .unique();

    const now = Date.now();

    if (!existingAdminAccess) {
      // Grant admin access via channelAdmins table
      await ctx.db.insert("channelAdmins", {
        channelId: channel._id,
        userId: args.userId,
        grantedAt: now,
        grantedBy: channel.creatorId, // Use channel creator as granter
        reason: "course_instructor",
      });
    }

    // Check if user is a member and upgrade their role
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", channel._id).eq("userId", args.userId)
      )
      .unique();

    if (membership && !membership.leftAt && !membership.isBanned) {
      // Only upgrade if current role is lower than admin
      if (membership.role === "member" || membership.role === "moderator") {
        await ctx.db.patch(membership._id, {
          role: "admin",
        });
      }
    } else if (!membership) {
      // User is not a member yet - add them as admin
      await ctx.db.insert("channelMembers", {
        channelId: channel._id,
        userId: args.userId,
        role: "admin",
        joinedAt: now,
        notificationLevel: "all",
        isMuted: false,
        isBanned: false,
      });

      // Update member count
      await ctx.db.patch(channel._id, {
        memberCount: channel.memberCount + 1,
      });
    }

    return null;
  },
});
