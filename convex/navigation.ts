import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

// ============================================================================
// Navigation Queries
// ============================================================================

/**
 * Get minimal data needed for breadcrumb navigation.
 * Optimized to fetch only names, not full entities.
 *
 * Usage patterns:
 * - Course page: getBreadcrumbData({ courseId })
 * - Lesson page: getBreadcrumbData({ lessonId })
 * - Both IDs: getBreadcrumbData({ courseId, lessonId })
 *
 * @returns Course, section, and lesson titles for breadcrumb display
 */
export const getBreadcrumbData = query({
  args: {
    courseId: v.optional(v.id("courses")),
    lessonId: v.optional(v.id("lessons")),
  },
  returns: v.union(
    v.object({
      course: v.optional(
        v.object({
          _id: v.id("courses"),
          title: v.string(),
        })
      ),
      section: v.optional(
        v.object({
          _id: v.id("sections"),
          title: v.string(),
        })
      ),
      lesson: v.optional(
        v.object({
          _id: v.id("lessons"),
          title: v.string(),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // 1. AUTHORIZATION FIRST
    const user = await requireAuth(ctx);

    // Validate at least one ID provided
    if (!args.courseId && !args.lessonId) {
      return null;
    }

    let courseId: Id<"courses"> | undefined = args.courseId;
    let sectionId: Id<"sections"> | undefined;
    let lessonId: Id<"lessons"> | undefined = args.lessonId;

    // 2. If lessonId provided, resolve section and course from hierarchy
    if (lessonId) {
      const lesson = await ctx.db.get(lessonId);
      if (!lesson) {
        return null;
      }

      sectionId = lesson.sectionId;

      const section = await ctx.db.get(sectionId);
      if (!section) {
        return null;
      }

      // Override courseId from lesson's hierarchy
      courseId = section.courseId;
    }

    // 3. Get course and check access
    if (!courseId) {
      return null;
    }

    const course = await ctx.db.get(courseId);
    if (!course) {
      return null;
    }

    // 4. ACCESS CHECK - Don't reveal names if no access
    const hasAccess = await checkBreadcrumbAccess(ctx, course, user);
    if (!hasAccess) {
      return null;
    }

    // 5. Build minimal response
    const result: {
      course?: { _id: Id<"courses">; title: string };
      section?: { _id: Id<"sections">; title: string };
      lesson?: { _id: Id<"lessons">; title: string };
    } = {
      course: {
        _id: course._id,
        title: course.title,
      },
    };

    // Add section if we have it
    if (sectionId) {
      const section = await ctx.db.get(sectionId);
      if (section) {
        result.section = {
          _id: section._id,
          title: section.title,
        };
      }
    }

    // Add lesson if provided
    if (lessonId) {
      const lesson = await ctx.db.get(lessonId);
      if (lesson) {
        result.lesson = {
          _id: lesson._id,
          title: lesson.title,
        };
      }
    }

    return result;
  },
});

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Lightweight access check for breadcrumb.
 * Mirrors the logic in courses.ts but without full data fetch.
 */
async function checkBreadcrumbAccess(
  ctx: QueryCtx,
  course: Pick<Doc<"courses">, "_id" | "status" | "visibility">,
  user: Pick<Doc<"users">, "_id" | "role">
): Promise<boolean> {
  // Admins can see everything
  if (user.role === "admin") {
    return true;
  }

  // Non-admins can't see drafts
  if (course.status !== "published") {
    return false;
  }

  // All teams visibility = everyone has access
  if (course.visibility === "all_teams") {
    return true;
  }

  // Check specific assignments
  const assignments = await ctx.db
    .query("courseAssignments")
    .withIndex("by_course", (q) => q.eq("courseId", course._id))
    .collect();

  // Direct user assignment?
  const hasDirectAccess = assignments.some((a) => a.userId === user._id);
  if (hasDirectAccess) {
    return true;
  }

  // Team assignment?
  const userTeams = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();

  const userTeamIds = new Set(userTeams.map((t) => t.teamId.toString()));
  const hasTeamAccess = assignments.some(
    (a) => a.teamId && userTeamIds.has(a.teamId.toString())
  );

  return hasTeamAccess;
}
