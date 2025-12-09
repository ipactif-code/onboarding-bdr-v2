import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdmin, requireAuth } from "./lib/auth";

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all sections for a course in display order.
 */
export const listByCourse = query({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.array(
    v.object({
      _id: v.id("sections"),
      title: v.string(),
      description: v.optional(v.string()),
      displayOrder: v.number(),
      lessonCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      return [];
    }

    const sections = await ctx.db
      .query("sections")
      .withIndex("by_course_order", (q) => q.eq("courseId", args.courseId))
      .collect();

    const result = await Promise.all(
      sections
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(async (section) => {
          const lessons = await ctx.db
            .query("lessons")
            .withIndex("by_section", (q) => q.eq("sectionId", section._id))
            .collect();

          return {
            _id: section._id,
            title: section.title,
            description: section.description,
            displayOrder: section.displayOrder,
            lessonCount: lessons.length,
          };
        })
    );

    return result;
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new section in a course.
 * T079: Implement sections.create mutation
 */
export const create = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("sections"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Validate title
    if (args.title.length < 3 || args.title.length > 200) {
      throw new Error("Title must be between 3 and 200 characters");
    }

    // Get next display order
    const existingSections = await ctx.db
      .query("sections")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    const maxOrder = existingSections.reduce(
      (max, s) => Math.max(max, s.displayOrder),
      0
    );

    return await ctx.db.insert("sections", {
      courseId: args.courseId,
      title: args.title,
      description: args.description,
      displayOrder: maxOrder + 1,
    });
  },
});

/**
 * Update section details.
 * T080: Implement sections.update mutation
 */
export const update = mutation({
  args: {
    sectionId: v.id("sections"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }

    const updates: { title?: string; description?: string } = {};

    if (args.title !== undefined) {
      if (args.title.length < 3 || args.title.length > 200) {
        throw new Error("Title must be between 3 and 200 characters");
      }
      updates.title = args.title;
    }

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.sectionId, updates);
    }

    return null;
  },
});

/**
 * Delete a section and all its lessons.
 * T081: Implement sections.remove mutation
 */
export const remove = mutation({
  args: {
    sectionId: v.id("sections"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }

    // Delete all lessons in this section
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    for (const lesson of lessons) {
      // Delete embed config
      const embedConfig = await ctx.db
        .query("embedConfigs")
        .withIndex("by_lesson", (q) => q.eq("lessonId", lesson._id))
        .unique();

      if (embedConfig) {
        await ctx.db.delete(embedConfig._id);
      }

      // Delete quiz config and questions
      const quizConfig = await ctx.db
        .query("quizConfigs")
        .withIndex("by_lesson", (q) => q.eq("lessonId", lesson._id))
        .unique();

      if (quizConfig) {
        const questions = await ctx.db
          .query("quizQuestions")
          .withIndex("by_quiz", (q) => q.eq("quizConfigId", quizConfig._id))
          .collect();

        for (const question of questions) {
          await ctx.db.delete(question._id);
        }

        // Delete quiz attempts
        const attempts = await ctx.db
          .query("quizAttempts")
          .withIndex("by_quiz", (q) => q.eq("quizConfigId", quizConfig._id))
          .collect();

        for (const attempt of attempts) {
          await ctx.db.delete(attempt._id);
        }

        await ctx.db.delete(quizConfig._id);
      }

      // Delete files
      const files = await ctx.db
        .query("files")
        .withIndex("by_lesson", (q) => q.eq("lessonId", lesson._id))
        .collect();

      for (const file of files) {
        await ctx.storage.delete(file.storageId);
        await ctx.db.delete(file._id);
      }

      // Delete progress records
      const progress = await ctx.db
        .query("progress")
        .withIndex("by_lesson", (q) => q.eq("lessonId", lesson._id))
        .collect();

      for (const p of progress) {
        await ctx.db.delete(p._id);
      }

      await ctx.db.delete(lesson._id);
    }

    await ctx.db.delete(args.sectionId);

    return null;
  },
});

/**
 * Reorder sections within a course.
 * T082: Implement sections.reorder mutation
 */
export const reorder = mutation({
  args: {
    courseId: v.id("courses"),
    sectionOrders: v.array(
      v.object({
        sectionId: v.id("sections"),
        displayOrder: v.number(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    for (const { sectionId, displayOrder } of args.sectionOrders) {
      const section = await ctx.db.get(sectionId);
      if (section && section.courseId === args.courseId) {
        await ctx.db.patch(sectionId, { displayOrder });
      }
    }

    return null;
  },
});
