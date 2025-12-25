import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { checkCourseAccess } from "./helpers";

// ============================================================================
// Course View Count Mutation
// ============================================================================

/**
 * Increment course view count.
 * T036: Implement courses.incrementViewCount mutation
 */
export const incrementViewCount = mutation({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Check access
    const hasAccess = await checkCourseAccess(ctx, args.courseId, user);
    if (!hasAccess) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(args.courseId, {
      viewCount: course.viewCount + 1,
    });

    return null;
  },
});
