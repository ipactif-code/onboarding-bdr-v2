import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// ============================================================================
// Course Helper Functions
// ============================================================================

/**
 * Check if user has access to a course based on visibility settings.
 */
export async function checkCourseAccess(
  ctx: QueryCtx | MutationCtx,
  courseId: Id<"courses">,
  user: Doc<"users">
): Promise<boolean> {
  const course = await ctx.db.get(courseId);
  if (!course) return false;

  // Admins can access all courses
  if (user.role === "admin") return true;

  // Only published courses for regular users
  if (course.status !== "published") return false;

  // All teams visibility
  if (course.visibility === "all_teams") return true;

  // Check specific team/user assignments
  const assignments = await ctx.db
    .query("courseAssignments")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();

  // Check direct user assignment
  if (assignments.some((a) => a.userId === user._id)) {
    return true;
  }

  // Check team assignment
  const userTeams = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();

  const userTeamIds = new Set(userTeams.map((t) => t.teamId.toString()));

  return assignments.some(
    (a) => a.teamId && userTeamIds.has(a.teamId.toString())
  );
}

/**
 * Get course cover image URL from storage.
 */
export async function getCoverImageUrl(
  ctx: QueryCtx | MutationCtx,
  coverImageId: Id<"_storage"> | undefined
): Promise<string | undefined> {
  if (!coverImageId) return undefined;
  const url = await ctx.storage.getUrl(coverImageId);
  return url ?? undefined;
}
