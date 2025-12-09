import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth, requireAdmin } from "./lib/auth";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user has access to a lesson's course.
 */
async function checkLessonAccess(
  ctx: { db: { get: (id: Id<"sections"> | Id<"courses">) => Promise<Doc<"sections"> | Doc<"courses"> | null>; query: (table: string) => unknown }; auth: { getUserIdentity: () => Promise<{ subject: string } | null> } },
  lessonId: Id<"lessons">,
  user: Doc<"users">
): Promise<{ hasAccess: boolean; courseId: Id<"courses"> | null }> {
  const db = ctx.db as unknown as {
    get: (id: Id<"lessons">) => Promise<Doc<"lessons"> | null>;
    query: (table: string) => unknown;
  };

  const lesson = await db.get(lessonId);
  if (!lesson) {
    return { hasAccess: false, courseId: null };
  }

  const section = await ctx.db.get(lesson.sectionId);
  if (!section) {
    return { hasAccess: false, courseId: null };
  }

  const sectionDoc = section as Doc<"sections">;
  const course = await ctx.db.get(sectionDoc.courseId);
  if (!course) {
    return { hasAccess: false, courseId: null };
  }

  const courseDoc = course as Doc<"courses">;

  // Admins can access all
  if (user.role === "admin") {
    return { hasAccess: true, courseId: courseDoc._id };
  }

  // Only published courses for regular users
  if (courseDoc.status !== "published") {
    return { hasAccess: false, courseId: courseDoc._id };
  }

  // All teams visibility
  if (courseDoc.visibility === "all_teams") {
    return { hasAccess: true, courseId: courseDoc._id };
  }

  // Check specific assignments
  const assignmentsDb = ctx.db as unknown as {
    query: (table: "courseAssignments") => {
      withIndex: (
        name: string,
        fn: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
      ) => { collect: () => Promise<Doc<"courseAssignments">[]> };
    };
  };

  const assignments = await assignmentsDb
    .query("courseAssignments")
    .withIndex("by_course", (q) => q.eq("courseId", courseDoc._id))
    .collect();

  // Direct user assignment
  if (assignments.some((a) => a.userId === user._id)) {
    return { hasAccess: true, courseId: courseDoc._id };
  }

  // Team assignment
  const teamDb = ctx.db as unknown as {
    query: (table: "teamMembers") => {
      withIndex: (
        name: string,
        fn: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
      ) => { collect: () => Promise<Doc<"teamMembers">[]> };
    };
  };

  const userTeams = await teamDb
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();

  const userTeamIds = new Set(userTeams.map((t) => t.teamId.toString()));

  const hasTeamAccess = assignments.some(
    (a) => a.teamId && userTeamIds.has(a.teamId.toString())
  );

  return { hasAccess: hasTeamAccess, courseId: courseDoc._id };
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get lesson details including type-specific content.
 * T037: Implement lessons.get query
 */
export const get = query({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.union(
    v.object({
      _id: v.id("lessons"),
      sectionId: v.id("sections"),
      courseId: v.id("courses"),
      type: v.union(
        v.literal("text"),
        v.literal("embed"),
        v.literal("quiz"),
        v.literal("files")
      ),
      title: v.string(),
      description: v.optional(v.string()),
      estimatedDuration: v.optional(v.number()),
      content: v.optional(v.any()),
      displayOrder: v.number(),
      embedConfig: v.optional(
        v.object({
          url: v.string(),
          provider: v.union(
            v.literal("youtube"),
            v.literal("vimeo"),
            v.literal("loom"),
            v.literal("figma"),
            v.literal("other")
          ),
        })
      ),
      quizConfig: v.optional(
        v.object({
          passingScore: v.number(),
          allowRetry: v.boolean(),
          maxAttempts: v.optional(v.number()),
          showAnswers: v.boolean(),
          questions: v.array(
            v.object({
              _id: v.id("quizQuestions"),
              questionText: v.string(),
              options: v.array(
                v.object({
                  text: v.string(),
                  isCorrect: v.boolean(),
                })
              ),
              explanation: v.optional(v.string()),
              points: v.number(),
              displayOrder: v.number(),
            })
          ),
        })
      ),
      files: v.optional(
        v.array(
          v.object({
            _id: v.id("files"),
            fileName: v.string(),
            fileSize: v.number(),
            fileType: v.string(),
            downloadUrl: v.string(),
          })
        )
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      return null;
    }

    // Get section to find course
    const section = await ctx.db.get(lesson.sectionId);
    if (!section) {
      return null;
    }

    // Check access
    const { hasAccess, courseId } = await checkLessonAccess(
      ctx,
      args.lessonId,
      user
    );
    if (!hasAccess || !courseId) {
      return null;
    }

    // Build type-specific content
    let embedConfig: {
      url: string;
      provider: "youtube" | "vimeo" | "loom" | "figma" | "other";
    } | undefined;
    let quizConfig:
      | {
          passingScore: number;
          allowRetry: boolean;
          maxAttempts?: number;
          showAnswers: boolean;
          questions: {
            _id: Id<"quizQuestions">;
            questionText: string;
            options: { text: string; isCorrect: boolean }[];
            explanation?: string;
            points: number;
            displayOrder: number;
          }[];
        }
      | undefined;
    let files:
      | {
          _id: Id<"files">;
          fileName: string;
          fileSize: number;
          fileType: string;
          downloadUrl: string;
        }[]
      | undefined;

    if (lesson.type === "embed") {
      const embedConfigRecord = await ctx.db
        .query("embedConfigs")
        .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
        .unique();

      if (embedConfigRecord) {
        embedConfig = {
          url: embedConfigRecord.url,
          provider: embedConfigRecord.provider,
        };
      }
    }

    if (lesson.type === "quiz") {
      const quizConfigRecord = await ctx.db
        .query("quizConfigs")
        .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
        .unique();

      if (quizConfigRecord) {
        const questions = await ctx.db
          .query("quizQuestions")
          .withIndex("by_quiz_order", (q) =>
            q.eq("quizConfigId", quizConfigRecord._id)
          )
          .collect();

        // For non-admins, hide correct answers before quiz is taken
        const processedQuestions = questions
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((q) => ({
            _id: q._id,
            questionText: q.questionText,
            options:
              user.role === "admin"
                ? q.options
                : q.options.map((opt) => ({
                    text: opt.text,
                    isCorrect: false, // Hide correct answers for users
                  })),
            explanation: user.role === "admin" ? q.explanation : undefined,
            points: q.points,
            displayOrder: q.displayOrder,
          }));

        quizConfig = {
          passingScore: quizConfigRecord.passingScore,
          allowRetry: quizConfigRecord.allowRetry,
          maxAttempts: quizConfigRecord.maxAttempts,
          showAnswers: quizConfigRecord.showAnswers,
          questions: processedQuestions,
        };
      }
    }

    if (lesson.type === "files") {
      const fileRecords = await ctx.db
        .query("files")
        .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
        .collect();

      files = await Promise.all(
        fileRecords.map(async (file) => {
          const downloadUrl = await ctx.storage.getUrl(file.storageId);
          return {
            _id: file._id,
            fileName: file.fileName,
            fileSize: file.fileSize,
            fileType: file.fileType,
            downloadUrl: downloadUrl ?? "",
          };
        })
      );
    }

    return {
      _id: lesson._id,
      sectionId: lesson.sectionId,
      courseId,
      type: lesson.type,
      title: lesson.title,
      description: lesson.description,
      estimatedDuration: lesson.estimatedDuration,
      content: lesson.content,
      displayOrder: lesson.displayOrder,
      embedConfig,
      quizConfig,
      files,
    };
  },
});

/**
 * Get all lessons in a section.
 * T038: Implement lessons.listBySection query
 */
export const listBySection = query({
  args: {
    sectionId: v.id("sections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("lessons"),
      type: v.union(
        v.literal("text"),
        v.literal("embed"),
        v.literal("quiz"),
        v.literal("files")
      ),
      title: v.string(),
      estimatedDuration: v.optional(v.number()),
      displayOrder: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get section to find course
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      return [];
    }

    // Get course and check access
    const course = await ctx.db.get(section.courseId);
    if (!course) {
      return [];
    }

    // Check access based on user role and course visibility
    if (user.role !== "admin") {
      if (course.status !== "published") {
        return [];
      }

      if (course.visibility !== "all_teams") {
        // Check specific assignments
        const assignments = await ctx.db
          .query("courseAssignments")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();

        const hasDirectAccess = assignments.some((a) => a.userId === user._id);

        if (!hasDirectAccess) {
          const userTeams = await ctx.db
            .query("teamMembers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

          const userTeamIds = new Set(userTeams.map((t) => t.teamId.toString()));
          const hasTeamAccess = assignments.some(
            (a) => a.teamId && userTeamIds.has(a.teamId.toString())
          );

          if (!hasTeamAccess) {
            return [];
          }
        }
      }
    }

    // Get lessons
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_section_order", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    return lessons
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((lesson) => ({
        _id: lesson._id,
        type: lesson.type,
        title: lesson.title,
        estimatedDuration: lesson.estimatedDuration,
        displayOrder: lesson.displayOrder,
      }));
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Detect embed provider from URL.
 */
function detectEmbedProvider(
  url: string
): "youtube" | "vimeo" | "loom" | "figma" | "other" {
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
 * Delete a lesson.
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
      await ctx.storage.delete(file.storageId);
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
