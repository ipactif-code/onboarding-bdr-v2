import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// ============================================================================
// Access Control Helpers
// ============================================================================

/**
 * Check if user has access to a lesson's course.
 * Returns access status and the course ID if the lesson exists.
 */
export async function checkLessonAccess(
  ctx: QueryCtx | MutationCtx,
  lessonId: Id<"lessons">,
  user: Doc<"users">
): Promise<{ hasAccess: boolean; courseId: Id<"courses"> | null }> {
  const lesson = await ctx.db.get(lessonId);
  if (!lesson) {
    return { hasAccess: false, courseId: null };
  }

  const section = await ctx.db.get(lesson.sectionId);
  if (!section) {
    return { hasAccess: false, courseId: null };
  }

  const course = await ctx.db.get(section.courseId);
  if (!course) {
    return { hasAccess: false, courseId: null };
  }

  // Admins can access all
  if (user.role === "admin") {
    return { hasAccess: true, courseId: course._id };
  }

  // Only published courses for regular users
  if (course.status !== "published") {
    return { hasAccess: false, courseId: course._id };
  }

  // All teams visibility
  if (course.visibility === "all_teams") {
    return { hasAccess: true, courseId: course._id };
  }

  // Check specific assignments
  const assignments = await ctx.db
    .query("courseAssignments")
    .withIndex("by_course", (q) => q.eq("courseId", course._id))
    .collect();

  // Direct user assignment
  if (assignments.some((a) => a.userId === user._id)) {
    return { hasAccess: true, courseId: course._id };
  }

  // Team assignment
  const userTeams = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();

  const userTeamIds = new Set(userTeams.map((t) => t.teamId.toString()));

  const hasTeamAccess = assignments.some(
    (a) => a.teamId && userTeamIds.has(a.teamId.toString())
  );

  return { hasAccess: hasTeamAccess, courseId: course._id };
}

// ============================================================================
// Embed Provider Detection
// ============================================================================

/** Supported embed providers */
export type EmbedProvider = "youtube" | "vimeo" | "loom" | "figma" | "other";

/**
 * Detect embed provider from URL.
 * Supports YouTube, Vimeo, Loom, and Figma.
 */
export function detectEmbedProvider(url: string): EmbedProvider {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) {
    return "youtube";
  }
  if (urlLower.includes("vimeo.com")) {
    return "vimeo";
  }
  if (urlLower.includes("loom.com")) {
    return "loom";
  }
  if (urlLower.includes("figma.com")) {
    return "figma";
  }
  return "other";
}
