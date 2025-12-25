import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";

// ============================================================================
// Course Unassign Mutation
// ============================================================================

/**
 * Remove course assignment.
 * T078: Implement courses.unassign mutation
 * T067: Removes users from course channel when unassigned.
 */
export const unassign = mutation({
  args: {
    courseId: v.id("courses"),
    teamId: v.optional(v.id("teams")),
    userId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Collect all user IDs to remove from the course channel
    const usersToRemoveFromChannel: Id<"users">[] = [];

    const assignments = await ctx.db
      .query("courseAssignments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    for (const assignment of assignments) {
      if (args.teamId && assignment.teamId === args.teamId) {
        await ctx.db.delete(assignment._id);

        // T067: Get all team members to remove from the course channel
        // Use a local variable to satisfy TypeScript's type narrowing
        const teamIdToRemove = args.teamId;
        const teamMembers = await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", teamIdToRemove))
          .collect();

        for (const member of teamMembers) {
          usersToRemoveFromChannel.push(member.userId);
        }
      }
      if (args.userId && assignment.userId === args.userId) {
        await ctx.db.delete(assignment._id);

        // T067: Add user directly to removal list
        usersToRemoveFromChannel.push(args.userId);
      }
    }

    // T067: Remove all unassigned users from course channel.
    // Only attempt if course is published (channel may exist).
    if (course.status === "published" && usersToRemoveFromChannel.length > 0) {
      // Deduplicate user IDs
      const uniqueUserIds = [...new Set(usersToRemoveFromChannel.map((id) => id.toString()))];

      for (const userIdStr of uniqueUserIds) {
        try {
          await ctx.runMutation(internal.channels.courseMutations.removeCourseEnrollee, {
            courseId: args.courseId,
            userId: userIdStr as Id<"users">,
          });
        } catch {
          // Channel operations are secondary - silently continue.
          // The user can be removed later via admin migration if needed.
        }
      }
    }

    return null;
  },
});
