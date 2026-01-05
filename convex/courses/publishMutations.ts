import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../lib/auth";

// Type workaround: Use dynamic import pattern to avoid TS2589 deep type instantiation
// The internalApi variable is typed as 'any' which breaks the deep type chain
// This is necessary because Convex's internal API generates very deep types
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
const internalApi: any = require("../_generated/api").internal;

// ============================================================================
// Course Publish Mutations
// ============================================================================

/**
 * Publish a draft course.
 * T073: Implement courses.publish mutation
 * T065: Creates a course channel when publishing and grants admin rights to creator.
 */
export const publish = mutation({
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

    if (course.status === "published") {
      throw new Error("Course is already published");
    }

    // Validate: must have at least one section
    const sections = await ctx.db
      .query("sections")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    if (sections.length === 0) {
      throw new Error("Course must have at least one section before publishing");
    }

    // Validate: each section must have at least one lesson
    for (const section of sections) {
      const lessons = await ctx.db
        .query("lessons")
        .withIndex("by_section", (q) => q.eq("sectionId", section._id))
        .collect();

      if (lessons.length === 0) {
        throw new Error(
          `Section "${section.title}" must have at least one lesson before publishing`
        );
      }

      // Validate quiz lessons have valid questions
      for (const lesson of lessons) {
        if (lesson.type === "quiz") {
          const quizConfig = await ctx.db
            .query("quizConfigs")
            .withIndex("by_lesson", (q) => q.eq("lessonId", lesson._id))
            .unique();

          if (!quizConfig) {
            throw new Error(
              `Quiz lesson "${lesson.title}" must have quiz configuration`
            );
          }

          const questions = await ctx.db
            .query("quizQuestions")
            .withIndex("by_quiz", (q) => q.eq("quizConfigId", quizConfig._id))
            .collect();

          if (questions.length === 0) {
            throw new Error(
              `Quiz lesson "${lesson.title}" must have at least one question`
            );
          }

          for (const question of questions) {
            const hasCorrect = question.options.some((opt) => opt.isCorrect);
            if (!hasCorrect) {
              throw new Error(
                `Question "${question.questionText}" must have at least one correct answer`
              );
            }
          }
        }
      }
    }

    await ctx.db.patch(args.courseId, {
      status: "published",
      publishedAt: Date.now(),
    });

    // T065: Create course channel for messaging.
    // Channel creation should not fail the publish operation - log and continue if it fails.
    try {
      await ctx.runMutation(internalApi.channels.courseMutations.createCourseChannel, {
        courseId: args.courseId,
        creatorId: course.creatorId,
      });

      // Grant the course creator admin rights on the channel
      await ctx.runMutation(internalApi.channels.courseMutations.grantCourseInstructorAdmin, {
        courseId: args.courseId,
        userId: course.creatorId,
      });
    } catch {
      // Channel creation is secondary to publishing - silently continue.
      // The channel can be created later via admin migration if needed.
    }

    return null;
  },
});

/**
 * Unpublish a course (revert to draft).
 * T074: Implement courses.unpublish mutation
 */
export const unpublish = mutation({
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

    if (course.status === "draft") {
      throw new Error("Course is already a draft");
    }

    await ctx.db.patch(args.courseId, {
      status: "draft",
    });

    return null;
  },
});

/**
 * Reorder courses.
 * T076: Implement courses.reorder mutation
 */
export const reorder = mutation({
  args: {
    courseOrders: v.array(
      v.object({
        courseId: v.id("courses"),
        displayOrder: v.number(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    for (const { courseId, displayOrder } of args.courseOrders) {
      const course = await ctx.db.get(courseId);
      if (course) {
        await ctx.db.patch(courseId, { displayOrder });
      }
    }

    return null;
  },
});
