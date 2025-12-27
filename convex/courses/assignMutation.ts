import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";

// Type workaround: Use require() to avoid TS2589 deep type instantiation on 'internal'
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const { internal } = require("../_generated/api") as { internal: any };

// ============================================================================
// Course Assign Mutation
// ============================================================================

/**
 * Assign course to teams or users.
 * T078: Implement courses.assign mutation
 * T066: Adds users to course channel when assigned (if course is published).
 */
export const assign = mutation({
  args: {
    courseId: v.id("courses"),
    teamIds: v.optional(v.array(v.id("teams"))),
    userIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    const now = Date.now();

    // Collect all user IDs to add to the course channel
    const usersToAddToChannel: Id<"users">[] = [];

    // Assign to teams
    if (args.teamIds) {
      for (const teamId of args.teamIds) {
        // Check if already assigned
        const existing = await ctx.db
          .query("courseAssignments")
          .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
          .collect();

        if (!existing.some((a) => a.teamId === teamId)) {
          await ctx.db.insert("courseAssignments", {
            courseId: args.courseId,
            teamId,
            assignedAt: now,
          });

          // T066: Get all team members to add to the course channel
          const teamMembers = await ctx.db
            .query("teamMembers")
            .withIndex("by_team", (q) => q.eq("teamId", teamId))
            .collect();

          for (const member of teamMembers) {
            usersToAddToChannel.push(member.userId);
          }
        }
      }
    }

    // Assign to users
    if (args.userIds) {
      for (const userId of args.userIds) {
        // Check if already assigned
        const existing = await ctx.db
          .query("courseAssignments")
          .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
          .collect();

        if (!existing.some((a) => a.userId === userId)) {
          await ctx.db.insert("courseAssignments", {
            courseId: args.courseId,
            userId,
            assignedAt: now,
          });

          // T066: Add user directly to the course channel
          usersToAddToChannel.push(userId);
        }
      }
    }

    // T066: Add all assigned users to course channel (if course is published).
    // Only attempt to add to channel if course is published (channel exists).
    if (course.status === "published" && usersToAddToChannel.length > 0) {
      // Deduplicate user IDs
      const uniqueUserIds = [...new Set(usersToAddToChannel.map((id) => id.toString()))];

      for (const userIdStr of uniqueUserIds) {
        try {
          await ctx.runMutation(internal.channels.courseMutations.addCourseEnrollee, {
            courseId: args.courseId,
            userId: userIdStr as Id<"users">,
          });
        } catch {
          // Channel operations are secondary - silently continue.
          // The user can be added later via admin migration if needed.
        }
      }
    }

    return null;
  },
});
