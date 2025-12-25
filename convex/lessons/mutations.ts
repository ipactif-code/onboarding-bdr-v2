import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { detectEmbedProvider } from "./helpers";

// ============================================================================
// Lesson CRUD Mutations
// ============================================================================

/**
 * Create a new lesson in a section.
 * T083: Implement lessons.create mutation
 */
export const create = mutation({
  args: {
    sectionId: v.id("sections"),
    type: v.union(
      v.literal("text"),
      v.literal("embed"),
      v.literal("quiz"),
      v.literal("files")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    estimatedDuration: v.optional(v.number()),
  },
  returns: v.id("lessons"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }

    // Validate title
    if (args.title.length < 3 || args.title.length > 200) {
      throw new Error("Title must be between 3 and 200 characters");
    }

    // Validate estimatedDuration
    if (args.estimatedDuration !== undefined && args.estimatedDuration <= 0) {
      throw new Error("Estimated duration must be a positive number");
    }

    // Get next display order
    const existingLessons = await ctx.db
      .query("lessons")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    const maxOrder = existingLessons.reduce(
      (max, l) => Math.max(max, l.displayOrder),
      0
    );

    const lessonId = await ctx.db.insert("lessons", {
      sectionId: args.sectionId,
      type: args.type,
      title: args.title,
      description: args.description,
      estimatedDuration: args.estimatedDuration,
      displayOrder: maxOrder + 1,
    });

    // Create default quiz config for quiz lessons
    if (args.type === "quiz") {
      await ctx.db.insert("quizConfigs", {
        lessonId,
        passingScore: 70,
        allowRetry: true,
        maxAttempts: undefined,
        showAnswers: true,
      });
    }

    return lessonId;
  },
});

/**
 * Update lesson basic info.
 * T084: Implement lessons.update mutation
 */
export const update = mutation({
  args: {
    lessonId: v.id("lessons"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    estimatedDuration: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new Error("Lesson not found");
    }

    const updates: {
      title?: string;
      description?: string;
      estimatedDuration?: number;
    } = {};

    if (args.title !== undefined) {
      if (args.title.length < 3 || args.title.length > 200) {
        throw new Error("Title must be between 3 and 200 characters");
      }
      updates.title = args.title;
    }

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (args.estimatedDuration !== undefined) {
      if (args.estimatedDuration <= 0) {
        throw new Error("Estimated duration must be a positive number");
      }
      updates.estimatedDuration = args.estimatedDuration;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.lessonId, updates);
    }

    return null;
  },
});

/**
 * Update Plate.js rich text content.
 * T085: Implement lessons.updateContent mutation
 */
export const updateContent = mutation({
  args: {
    lessonId: v.id("lessons"),
    content: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new Error("Lesson not found");
    }

    await ctx.db.patch(args.lessonId, {
      content: args.content,
    });

    return null;
  },
});

/**
 * Delete a lesson and all related data.
 * T086: Implement lessons.remove mutation
 */
export const remove = mutation({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new Error("Lesson not found");
    }

    // Delete embed config
    const embedConfig = await ctx.db
      .query("embedConfigs")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .unique();

    if (embedConfig) {
      await ctx.db.delete(embedConfig._id);
    }

    // Delete quiz config and questions
    const quizConfig = await ctx.db
      .query("quizConfigs")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
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
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .collect();

    for (const file of files) {
      if (file.storageId) {
        await ctx.storage.delete(file.storageId);
      }
      await ctx.db.delete(file._id);
    }

    // Delete progress records
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .collect();

    for (const p of progress) {
      await ctx.db.delete(p._id);
    }

    await ctx.db.delete(args.lessonId);

    return null;
  },
});

/**
 * Reorder lessons within a section.
 * T087: Implement lessons.reorder mutation
 */
export const reorder = mutation({
  args: {
    sectionId: v.id("sections"),
    lessonOrders: v.array(
      v.object({
        lessonId: v.id("lessons"),
        displayOrder: v.number(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }

    for (const { lessonId, displayOrder } of args.lessonOrders) {
      const lesson = await ctx.db.get(lessonId);
      if (lesson && lesson.sectionId === args.sectionId) {
        await ctx.db.patch(lessonId, { displayOrder });
      }
    }

    return null;
  },
});

/**
 * Set embed URL for an embed lesson.
 * T088: Implement lessons.setEmbed mutation
 */
export const setEmbed = mutation({
  args: {
    lessonId: v.id("lessons"),
    url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new Error("Lesson not found");
    }

    if (lesson.type !== "embed") {
      throw new Error("Lesson is not an embed type");
    }

    const provider = detectEmbedProvider(args.url);

    // Check if embed config exists
    const existing = await ctx.db
      .query("embedConfigs")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        url: args.url,
        provider,
      });
    } else {
      await ctx.db.insert("embedConfigs", {
        lessonId: args.lessonId,
        url: args.url,
        provider,
      });
    }

    return null;
  },
});
