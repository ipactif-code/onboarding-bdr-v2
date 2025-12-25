import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../lib/auth";

// ============================================================================
// Quiz Configuration Mutations
// ============================================================================

/**
 * Update quiz settings.
 * T089: Implement lessons.updateQuizConfig mutation
 */
export const updateQuizConfig = mutation({
  args: {
    lessonId: v.id("lessons"),
    passingScore: v.optional(v.number()),
    allowRetry: v.optional(v.boolean()),
    maxAttempts: v.optional(v.union(v.number(), v.null())),
    showAnswers: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new Error("Lesson not found");
    }

    if (lesson.type !== "quiz") {
      throw new Error("Lesson is not a quiz type");
    }

    // Validate passing score
    if (
      args.passingScore !== undefined &&
      (args.passingScore < 1 || args.passingScore > 100)
    ) {
      throw new Error("Passing score must be between 1 and 100");
    }

    // Validate max attempts
    if (
      args.maxAttempts !== undefined &&
      args.maxAttempts !== null &&
      (args.maxAttempts < 1 || args.maxAttempts > 10)
    ) {
      throw new Error("Max attempts must be between 1 and 10");
    }

    const quizConfig = await ctx.db
      .query("quizConfigs")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .unique();

    if (!quizConfig) {
      // Create quiz config if it doesn't exist
      await ctx.db.insert("quizConfigs", {
        lessonId: args.lessonId,
        passingScore: args.passingScore ?? 70,
        allowRetry: args.allowRetry ?? true,
        maxAttempts: args.maxAttempts === null ? undefined : args.maxAttempts,
        showAnswers: args.showAnswers ?? true,
      });
    } else {
      const updates: {
        passingScore?: number;
        allowRetry?: boolean;
        maxAttempts?: number | undefined;
        showAnswers?: boolean;
      } = {};

      if (args.passingScore !== undefined) {
        updates.passingScore = args.passingScore;
      }
      if (args.allowRetry !== undefined) {
        updates.allowRetry = args.allowRetry;
      }
      if (args.maxAttempts !== undefined) {
        updates.maxAttempts =
          args.maxAttempts === null ? undefined : args.maxAttempts;
      }
      if (args.showAnswers !== undefined) {
        updates.showAnswers = args.showAnswers;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(quizConfig._id, updates);
      }
    }

    return null;
  },
});

// ============================================================================
// Quiz Question Mutations
// ============================================================================

/**
 * Add a question to a quiz.
 * T090: Implement lessons.addQuestion mutation
 */
export const addQuestion = mutation({
  args: {
    lessonId: v.id("lessons"),
    questionText: v.string(),
    options: v.array(
      v.object({
        text: v.string(),
        isCorrect: v.boolean(),
      })
    ),
    explanation: v.optional(v.string()),
    points: v.number(),
  },
  returns: v.id("quizQuestions"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new Error("Lesson not found");
    }

    if (lesson.type !== "quiz") {
      throw new Error("Lesson is not a quiz type");
    }

    // Validate options
    if (args.options.length < 2 || args.options.length > 6) {
      throw new Error("Question must have between 2 and 6 options");
    }

    if (!args.options.some((opt) => opt.isCorrect)) {
      throw new Error("At least one option must be correct");
    }

    if (args.points <= 0) {
      throw new Error("Points must be positive");
    }

    const quizConfig = await ctx.db
      .query("quizConfigs")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .unique();

    if (!quizConfig) {
      throw new Error("Quiz configuration not found");
    }

    // Get next display order
    const existingQuestions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_quiz", (q) => q.eq("quizConfigId", quizConfig._id))
      .collect();

    const maxOrder = existingQuestions.reduce(
      (max, q) => Math.max(max, q.displayOrder),
      0
    );

    return await ctx.db.insert("quizQuestions", {
      quizConfigId: quizConfig._id,
      questionText: args.questionText,
      options: args.options,
      explanation: args.explanation,
      points: args.points,
      displayOrder: maxOrder + 1,
    });
  },
});

/**
 * Update an existing question.
 * T091: Implement lessons.updateQuestion mutation
 */
export const updateQuestion = mutation({
  args: {
    questionId: v.id("quizQuestions"),
    questionText: v.optional(v.string()),
    options: v.optional(
      v.array(
        v.object({
          text: v.string(),
          isCorrect: v.boolean(),
        })
      )
    ),
    explanation: v.optional(v.string()),
    points: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    const updates: {
      questionText?: string;
      options?: { text: string; isCorrect: boolean }[];
      explanation?: string;
      points?: number;
    } = {};

    if (args.questionText !== undefined) {
      updates.questionText = args.questionText;
    }

    if (args.options !== undefined) {
      if (args.options.length < 2 || args.options.length > 6) {
        throw new Error("Question must have between 2 and 6 options");
      }
      if (!args.options.some((opt) => opt.isCorrect)) {
        throw new Error("At least one option must be correct");
      }
      updates.options = args.options;
    }

    if (args.explanation !== undefined) {
      updates.explanation = args.explanation;
    }

    if (args.points !== undefined) {
      if (args.points <= 0) {
        throw new Error("Points must be positive");
      }
      updates.points = args.points;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.questionId, updates);
    }

    return null;
  },
});

/**
 * Delete a question from a quiz.
 * T092: Implement lessons.removeQuestion mutation
 */
export const removeQuestion = mutation({
  args: {
    questionId: v.id("quizQuestions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    await ctx.db.delete(args.questionId);

    return null;
  },
});

/**
 * Reorder questions within a quiz.
 * T093: Implement lessons.reorderQuestions mutation
 */
export const reorderQuestions = mutation({
  args: {
    lessonId: v.id("lessons"),
    questionOrders: v.array(
      v.object({
        questionId: v.id("quizQuestions"),
        displayOrder: v.number(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new Error("Lesson not found");
    }

    if (lesson.type !== "quiz") {
      throw new Error("Lesson is not a quiz type");
    }

    const quizConfig = await ctx.db
      .query("quizConfigs")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .unique();

    if (!quizConfig) {
      throw new Error("Quiz configuration not found");
    }

    for (const { questionId, displayOrder } of args.questionOrders) {
      const question = await ctx.db.get(questionId);
      if (question && question.quizConfigId === quizConfig._id) {
        await ctx.db.patch(questionId, { displayOrder });
      }
    }

    return null;
  },
});
