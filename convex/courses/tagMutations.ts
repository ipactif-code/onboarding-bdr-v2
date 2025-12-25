import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../lib/auth";

// ============================================================================
// Course Tag Mutations
// ============================================================================

/**
 * Add a tag to a course.
 * T077: Implement courses.addTag mutation
 */
export const addTag = mutation({
  args: {
    courseId: v.id("courses"),
    tagName: v.string(),
  },
  returns: v.id("tags"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Find or create tag
    let tag = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("name", args.tagName))
      .unique();

    if (!tag) {
      const tagId = await ctx.db.insert("tags", { name: args.tagName });
      tag = await ctx.db.get(tagId);
    }

    if (!tag) {
      throw new Error("Failed to create tag");
    }

    // Check if already exists
    const existing = await ctx.db
      .query("courseTags")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    if (existing.some((ct) => ct.tagId === tag!._id)) {
      return tag._id;
    }

    // Add course-tag association
    await ctx.db.insert("courseTags", {
      courseId: args.courseId,
      tagId: tag._id,
    });

    return tag._id;
  },
});

/**
 * Remove a tag from a course.
 * T077: Implement courses.removeTag mutation
 */
export const removeTag = mutation({
  args: {
    courseId: v.id("courses"),
    tagId: v.id("tags"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const courseTags = await ctx.db
      .query("courseTags")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    const toDelete = courseTags.find((ct) => ct.tagId === args.tagId);
    if (toDelete) {
      await ctx.db.delete(toDelete._id);
    }

    return null;
  },
});
