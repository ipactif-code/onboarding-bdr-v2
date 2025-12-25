import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../lib/auth";

// ============================================================================
// Course Remove Mutation
// ============================================================================

/**
 * Delete a course and all its content.
 * T075: Implement courses.remove mutation
 */
export const remove = mutation({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Delete cover image
    if (course.coverImageId) {
      await ctx.storage.delete(course.coverImageId);
    }

    // Delete course tags
    const courseTags = await ctx.db
      .query("courseTags")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    for (const ct of courseTags) {
      await ctx.db.delete(ct._id);
    }

    // Delete course assignments
    const assignments = await ctx.db
      .query("courseAssignments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    for (const a of assignments) {
      await ctx.db.delete(a._id);
    }

    // Delete sections, lessons, and related content
    const sections = await ctx.db
      .query("sections")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    for (const section of sections) {
      const lessons = await ctx.db
        .query("lessons")
        .withIndex("by_section", (q) => q.eq("sectionId", section._id))
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

          for (const q of questions) {
            await ctx.db.delete(q._id);
          }

          // Delete quiz attempts
          const attempts = await ctx.db
            .query("quizAttempts")
            .withIndex("by_quiz", (q) => q.eq("quizConfigId", quizConfig._id))
            .collect();

          for (const a of attempts) {
            await ctx.db.delete(a._id);
          }

          await ctx.db.delete(quizConfig._id);
        }

        // Delete files
        const files = await ctx.db
          .query("files")
          .withIndex("by_lesson", (q) => q.eq("lessonId", lesson._id))
          .collect();

        for (const file of files) {
          if (file.storageId) {
            await ctx.storage.delete(file.storageId);
          }
          await ctx.db.delete(file._id);
        }

        await ctx.db.delete(lesson._id);
      }

      await ctx.db.delete(section._id);
    }

    // Delete comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete the course
    await ctx.db.delete(args.courseId);

    return null;
  },
});
