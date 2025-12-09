import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get quiz config and validate lesson is a quiz type.
 */
async function getQuizConfig(
  ctx: { db: { get: (id: Id<"lessons">) => Promise<Doc<"lessons"> | null>; query: (table: string) => unknown } },
  lessonId: Id<"lessons">
): Promise<Doc<"quizConfigs"> | null> {
  const lesson = await ctx.db.get(lessonId);
  if (!lesson || lesson.type !== "quiz") {
    return null;
  }

  const db = ctx.db as unknown as {
    query: (table: "quizConfigs") => {
      withIndex: (
        name: string,
        fn: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
      ) => { unique: () => Promise<Doc<"quizConfigs"> | null> };
    };
  };

  return await db
    .query("quizConfigs")
    .withIndex("by_lesson", (q) => q.eq("lessonId", lessonId))
    .unique();
}

/**
 * Check if user has access to a lesson's course.
 */
async function checkLessonAccess(
  ctx: { db: { get: (id: Id<"lessons"> | Id<"sections"> | Id<"courses">) => Promise<Doc<"lessons"> | Doc<"sections"> | Doc<"courses"> | null>; query: (table: string) => unknown } },
  lessonId: Id<"lessons">,
  user: Doc<"users">
): Promise<boolean> {
  const lesson = await ctx.db.get(lessonId);
  if (!lesson) return false;

  const section = await ctx.db.get((lesson as Doc<"lessons">).sectionId);
  if (!section) return false;

  const course = await ctx.db.get((section as Doc<"sections">).courseId);
  if (!course) return false;

  const courseDoc = course as Doc<"courses">;

  // Admins can access all
  if (user.role === "admin") return true;

  // Only published courses for regular users
  if (courseDoc.status !== "published") return false;

  // All teams visibility
  if (courseDoc.visibility === "all_teams") return true;

  // Check specific assignments
  const db = ctx.db as unknown as {
    query: (table: "courseAssignments" | "teamMembers") => {
      withIndex: (
        name: string,
        fn: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
      ) => { collect: () => Promise<Doc<"courseAssignments">[] | Doc<"teamMembers">[]> };
    };
  };

  const assignments = (await db
    .query("courseAssignments")
    .withIndex("by_course", (q) => q.eq("courseId", courseDoc._id))
    .collect()) as Doc<"courseAssignments">[];

  // Direct user assignment
  if (assignments.some((a) => a.userId === user._id)) {
    return true;
  }

  // Team assignment
  const userTeams = (await db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect()) as Doc<"teamMembers">[];

  const userTeamIds = new Set(userTeams.map((t) => t.teamId.toString()));

  return assignments.some(
    (a) => a.teamId && userTeamIds.has(a.teamId.toString())
  );
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get quiz status for display (without revealing answers).
 * T045: Implement quizzes.getQuizStatus query
 */
export const getQuizStatus = query({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.object({
    attemptCount: v.number(),
    maxAttempts: v.optional(v.number()),
    bestScore: v.optional(v.number()),
    passed: v.boolean(),
    canAttempt: v.boolean(),
    passingScore: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get quiz config
    const quizConfig = await getQuizConfig(ctx, args.lessonId);
    if (!quizConfig) {
      return {
        attemptCount: 0,
        maxAttempts: undefined,
        bestScore: undefined,
        passed: false,
        canAttempt: false,
        passingScore: 0,
      };
    }

    // Get user's attempts for this quiz
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_user_quiz", (q) =>
        q.eq("userId", user._id).eq("quizConfigId", quizConfig._id)
      )
      .collect();

    const attemptCount = attempts.length;

    // Calculate best score
    let bestScore: number | undefined;
    let passed = false;

    if (attempts.length > 0) {
      bestScore = Math.max(
        ...attempts.map((a) =>
          a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0
        )
      );
      passed = attempts.some((a) => a.passed);
    }

    // Determine if user can attempt
    let canAttempt = true;

    if (passed && !quizConfig.allowRetry) {
      canAttempt = false;
    } else if (quizConfig.maxAttempts !== undefined) {
      canAttempt = attemptCount < quizConfig.maxAttempts;
    }

    return {
      attemptCount,
      maxAttempts: quizConfig.maxAttempts,
      bestScore,
      passed,
      canAttempt,
      passingScore: quizConfig.passingScore,
    };
  },
});

/**
 * Get the most recent attempt with answer details.
 * T046: Implement quizzes.getLatestAttempt query
 */
export const getLatestAttempt = query({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.optional(
    v.object({
      _id: v.id("quizAttempts"),
      attemptNumber: v.number(),
      score: v.number(),
      maxScore: v.number(),
      percentage: v.number(),
      passed: v.boolean(),
      submittedAt: v.number(),
      answers: v.array(
        v.object({
          questionId: v.id("quizQuestions"),
          questionText: v.string(),
          selectedOptions: v.array(v.number()),
          correctOptions: v.array(v.number()),
          isCorrect: v.boolean(),
          points: v.number(),
          earnedPoints: v.number(),
          explanation: v.optional(v.string()),
        })
      ),
      canRetry: v.boolean(),
      attemptsRemaining: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get quiz config
    const quizConfig = await getQuizConfig(ctx, args.lessonId);
    if (!quizConfig) {
      return undefined;
    }

    // Get user's attempts for this quiz
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_user_quiz", (q) =>
        q.eq("userId", user._id).eq("quizConfigId", quizConfig._id)
      )
      .collect();

    if (attempts.length === 0) {
      return undefined;
    }

    // Get the latest attempt
    const latestAttempt = attempts.sort(
      (a, b) => b.submittedAt - a.submittedAt
    )[0];

    // Get all questions for this quiz
    const questions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_quiz", (q) => q.eq("quizConfigId", quizConfig._id))
      .collect();

    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

    // Build answer details
    const answersData = latestAttempt.answers as Record<
      string,
      number[]
    >;
    const answers: {
      questionId: Id<"quizQuestions">;
      questionText: string;
      selectedOptions: number[];
      correctOptions: number[];
      isCorrect: boolean;
      points: number;
      earnedPoints: number;
      explanation?: string;
    }[] = [];

    for (const [questionIdStr, selectedOptions] of Object.entries(answersData)) {
      const question = questionMap.get(questionIdStr);
      if (!question) continue;

      const correctOptions = question.options
        .map((opt, idx) => (opt.isCorrect ? idx : -1))
        .filter((idx) => idx >= 0);

      const isCorrect =
        selectedOptions.length === correctOptions.length &&
        selectedOptions.every((idx) => correctOptions.includes(idx));

      const earnedPoints = isCorrect ? question.points : 0;

      answers.push({
        questionId: question._id,
        questionText: question.questionText,
        selectedOptions,
        correctOptions: quizConfig.showAnswers ? correctOptions : [],
        isCorrect,
        points: question.points,
        earnedPoints,
        explanation: quizConfig.showAnswers ? question.explanation : undefined,
      });
    }

    // Calculate if user can retry
    let canRetry = quizConfig.allowRetry;
    let attemptsRemaining: number | undefined;

    if (quizConfig.maxAttempts !== undefined) {
      attemptsRemaining = Math.max(0, quizConfig.maxAttempts - attempts.length);
      canRetry = canRetry && attemptsRemaining > 0;
    }

    const percentage =
      latestAttempt.maxScore > 0
        ? Math.round((latestAttempt.score / latestAttempt.maxScore) * 100)
        : 0;

    return {
      _id: latestAttempt._id,
      attemptNumber: latestAttempt.attemptNumber,
      score: latestAttempt.score,
      maxScore: latestAttempt.maxScore,
      percentage,
      passed: latestAttempt.passed,
      submittedAt: latestAttempt.submittedAt,
      answers,
      canRetry,
      attemptsRemaining,
    };
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Submit a quiz attempt.
 * T047: Implement quizzes.submit mutation
 */
export const submit = mutation({
  args: {
    lessonId: v.id("lessons"),
    answers: v.array(
      v.object({
        questionId: v.id("quizQuestions"),
        selectedOptions: v.array(v.number()),
      })
    ),
  },
  returns: v.object({
    attemptId: v.id("quizAttempts"),
    score: v.number(),
    maxScore: v.number(),
    percentage: v.number(),
    passed: v.boolean(),
    canRetry: v.boolean(),
    attemptsRemaining: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check access
    const hasAccess = await checkLessonAccess(ctx, args.lessonId, user);
    if (!hasAccess) {
      throw new Error("Access denied");
    }

    // Get quiz config
    const quizConfig = await getQuizConfig(ctx, args.lessonId);
    if (!quizConfig) {
      throw new Error("Quiz configuration not found");
    }

    // Get existing attempts
    const existingAttempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_user_quiz", (q) =>
        q.eq("userId", user._id).eq("quizConfigId", quizConfig._id)
      )
      .collect();

    const attemptCount = existingAttempts.length;

    // Check if user can attempt
    if (quizConfig.maxAttempts !== undefined && attemptCount >= quizConfig.maxAttempts) {
      throw new Error("Maximum attempts reached");
    }

    // Get all questions for this quiz
    const questions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_quiz", (q) => q.eq("quizConfigId", quizConfig._id))
      .collect();

    if (questions.length === 0) {
      throw new Error("Quiz has no questions");
    }

    // Validate all questions are answered
    const questionIds = new Set(questions.map((q) => q._id.toString()));
    const answeredIds = new Set(
      args.answers.map((a) => a.questionId.toString())
    );

    for (const qId of questionIds) {
      if (!answeredIds.has(qId)) {
        throw new Error("All questions must be answered");
      }
    }

    // Score the quiz
    let totalScore = 0;
    let maxScore = 0;
    const answersMap: Record<string, number[]> = {};

    for (const answer of args.answers) {
      const question = questions.find(
        (q) => q._id.toString() === answer.questionId.toString()
      );
      if (!question) continue;

      maxScore += question.points;

      const correctOptions = question.options
        .map((opt, idx) => (opt.isCorrect ? idx : -1))
        .filter((idx) => idx >= 0);

      const isCorrect =
        answer.selectedOptions.length === correctOptions.length &&
        answer.selectedOptions.every((idx) => correctOptions.includes(idx));

      if (isCorrect) {
        totalScore += question.points;
      }

      answersMap[answer.questionId.toString()] = answer.selectedOptions;
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const passed = percentage >= quizConfig.passingScore;
    const now = Date.now();

    // Create quiz attempt
    const attemptId = await ctx.db.insert("quizAttempts", {
      userId: user._id,
      quizConfigId: quizConfig._id,
      answers: answersMap,
      score: totalScore,
      maxScore,
      passed,
      attemptNumber: attemptCount + 1,
      submittedAt: now,
    });

    // If passed, mark lesson as completed
    if (passed) {
      const existingProgress = await ctx.db
        .query("progress")
        .withIndex("by_user_lesson", (q) =>
          q.eq("userId", user._id).eq("lessonId", args.lessonId)
        )
        .unique();

      if (existingProgress) {
        await ctx.db.patch(existingProgress._id, {
          status: "completed",
          completedAt: now,
          lastAccessedAt: now,
        });
      } else {
        await ctx.db.insert("progress", {
          userId: user._id,
          lessonId: args.lessonId,
          status: "completed",
          completedAt: now,
          lastAccessedAt: now,
          timeSpent: 0,
        });
      }
    }

    // Log activity
    const lesson = await ctx.db.get(args.lessonId);
    if (lesson) {
      const section = await ctx.db.get(lesson.sectionId);
      if (section) {
        await ctx.db.insert("activityLogs", {
          userId: user._id,
          actionType: "quiz_submit",
          category: "quiz",
          entityType: "lesson",
          entityId: args.lessonId,
          metadata: {
            lessonTitle: lesson.title,
            courseId: section.courseId,
            score: totalScore,
            maxScore,
            passed,
          },
          timestamp: now,
        });
      }
    }

    // Calculate retry info
    let canRetry = quizConfig.allowRetry;
    let attemptsRemaining: number | undefined;

    if (quizConfig.maxAttempts !== undefined) {
      attemptsRemaining = Math.max(0, quizConfig.maxAttempts - (attemptCount + 1));
      canRetry = canRetry && attemptsRemaining > 0;
    }

    return {
      attemptId,
      score: totalScore,
      maxScore,
      percentage,
      passed,
      canRetry,
      attemptsRemaining,
    };
  },
});
