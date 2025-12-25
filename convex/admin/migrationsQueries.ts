import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// ============================================================================
// Migration Helper Internal Queries
// ============================================================================
// These internal queries support the migration actions.
// No auth checks needed - internal only.
// ============================================================================

/**
 * Get all published courses that don't have a channel.
 * A course doesn't have a channel if no channel exists with its courseId.
 *
 * @returns Array of courses that need channel creation
 */
export const getPublishedCoursesWithoutChannels = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("courses"),
      title: v.string(),
      creatorId: v.id("users"),
    })
  ),
  handler: async (ctx): Promise<
    Array<{
      _id: Id<"courses">;
      title: string;
      creatorId: Id<"users">;
    }>
  > => {
    // Get all published courses
    const publishedCourses = await ctx.db
      .query("courses")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();

    const coursesWithoutChannels: Array<{
      _id: Id<"courses">;
      title: string;
      creatorId: Id<"users">;
    }> = [];

    for (const course of publishedCourses) {
      // Check if a channel exists for this course
      const existingChannel = await ctx.db
        .query("channels")
        .withIndex("by_course", (q) => q.eq("courseId", course._id))
        .unique();

      if (!existingChannel) {
        coursesWithoutChannels.push({
          _id: course._id,
          title: course.title,
          creatorId: course.creatorId,
        });
      }
    }

    return coursesWithoutChannels;
  },
});

/**
 * Get all users enrolled in a course based on its visibility setting.
 * T012: Fix to handle visibility-based enrollment correctly.
 *
 * Visibility handling:
 * - "all_teams": Returns ALL active users in the system
 * - "specific_teams": Returns users from teams in courseAssignments (via teamId)
 * - "specific_users": Returns only directly assigned users (via userId in courseAssignments)
 *
 * For "specific_teams" and "specific_users", also includes any explicit user/team
 * assignments from courseAssignments.
 *
 * @param courseId - The course to get enrolled users for
 * @returns Array of unique user IDs enrolled in the course
 */
export const getCourseEnrolledUsers = internalQuery({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.array(v.id("users")),
  handler: async (ctx, args): Promise<Id<"users">[]> => {
    const userIds = new Set<string>();

    // Get the course to check visibility
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      return [];
    }

    // Handle visibility-based enrollment
    if (course.visibility === "all_teams") {
      // Add ALL users in the system (no status check since users table uses
      // "online"/"offline"/"away"/"dnd" for presence, not account status)
      const allUsers = await ctx.db.query("users").collect();
      for (const user of allUsers) {
        userIds.add(user._id);
      }
      return Array.from(userIds) as Id<"users">[];
    }

    // For "specific_teams" and "specific_users", get users from courseAssignments
    const assignments = await ctx.db
      .query("courseAssignments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    for (const assignment of assignments) {
      if (assignment.userId) {
        // Direct user assignment
        userIds.add(assignment.userId);
      }

      if (assignment.teamId) {
        // Team assignment - get all team members
        const teamMembers = await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", assignment.teamId!))
          .collect();

        for (const member of teamMembers) {
          userIds.add(member.userId);
        }
      }
    }

    return Array.from(userIds) as Id<"users">[];
  },
});
