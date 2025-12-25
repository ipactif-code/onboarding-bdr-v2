import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { buildCourseListResponse } from "./queryHelpers";
import { courseListItemValidator } from "./types";

// ============================================================================
// List For User Query
// ============================================================================

/**
 * List courses assigned to the current user with progress.
 * T033: Implement courses.listForUser query
 */
export const listForUser = query({
  args: {},
  returns: v.array(courseListItemValidator),
  handler: async (ctx, _args) => {
    const user = await requireAuth(ctx);

    // Admins can access all published courses
    if (user.role === "admin") {
      const allCourses = await ctx.db
        .query("courses")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .collect();

      // Sort and continue with allCourses as accessibleCourses
      const accessibleCourses = allCourses.sort(
        (a, b) => a.displayOrder - b.displayOrder
      );
      return buildCourseListResponse(ctx, accessibleCourses, user);
    }

    // For non-admins, pre-fetch all required data to avoid N+1 queries
    const [allCourses, userTeams, allAssignments] = await Promise.all([
      ctx.db
        .query("courses")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .collect(),
      ctx.db
        .query("teamMembers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db.query("courseAssignments").collect(),
    ]);

    // Build lookup structures for O(1) access checks
    const userTeamIds = new Set(userTeams.map((t) => t.teamId.toString()));
    const assignmentsByCourse = new Map<string, typeof allAssignments>();
    for (const assignment of allAssignments) {
      const key = assignment.courseId.toString();
      if (!assignmentsByCourse.has(key)) {
        assignmentsByCourse.set(key, []);
      }
      assignmentsByCourse.get(key)!.push(assignment);
    }

    // Filter courses by access in memory
    const accessibleCourses = allCourses.filter((course) => {
      // All teams visibility - everyone has access
      if (course.visibility === "all_teams") return true;

      const assignments = assignmentsByCourse.get(course._id.toString()) ?? [];

      // Check direct user assignment
      if (assignments.some((a) => a.userId === user._id)) return true;

      // Check team assignment
      return assignments.some(
        (a) => a.teamId && userTeamIds.has(a.teamId.toString())
      );
    });

    // Sort by display order
    accessibleCourses.sort((a, b) => a.displayOrder - b.displayOrder);

    return buildCourseListResponse(ctx, accessibleCourses, user);
  },
});
