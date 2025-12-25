import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { requireAuth } from "../lib/auth";
import { checkLessonAccess } from "./helpers";

// ============================================================================
// Shared Validators
// ============================================================================

const lessonTypeValidator = v.union(
  v.literal("text"),
  v.literal("embed"),
  v.literal("quiz"),
  v.literal("files")
);

const embedProviderValidator = v.union(
  v.literal("youtube"),
  v.literal("vimeo"),
  v.literal("loom"),
  v.literal("figma"),
  v.literal("other")
);

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
      type: lessonTypeValidator,
      title: v.string(),
      description: v.optional(v.string()),
      estimatedDuration: v.optional(v.number()),
      content: v.optional(v.any()),
      displayOrder: v.number(),
      embedConfig: v.optional(
        v.object({
          url: v.string(),
          provider: embedProviderValidator,
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
    let embedConfig:
      | { url: string; provider: "youtube" | "vimeo" | "loom" | "figma" | "other" }
      | undefined;
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
          // Handle both Convex Storage (storageId) and UploadThing (downloadUrl) files
          let url = file.downloadUrl;
          if (!url && file.storageId) {
            url = (await ctx.storage.getUrl(file.storageId)) ?? "";
          }
          return {
            _id: file._id,
            fileName: file.fileName,
            fileSize: file.fileSize,
            fileType: file.fileType,
            downloadUrl: url ?? "",
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
 * Get all lessons for a course (across all sections).
 * T005: Implement lessons.listByCourse query for frontend lesson selector.
 */
export const listByCourse = query({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.array(
    v.object({
      _id: v.id("lessons"),
      title: v.string(),
      sectionId: v.id("sections"),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check course access
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      return [];
    }

    // Check access based on user role and course visibility
    if (user.role !== "admin") {
      // Only published courses for regular users
      if (course.status !== "published") {
        return [];
      }

      // Check visibility
      if (course.visibility !== "all_teams") {
        // Check specific assignments
        const assignments = await ctx.db
          .query("courseAssignments")
          .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
          .collect();

        // Direct user assignment
        const hasDirectAccess = assignments.some((a) => a.userId === user._id);

        if (!hasDirectAccess) {
          // Team assignment
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

    // Get all sections for this course
    const sections = await ctx.db
      .query("sections")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    // Get lessons for all sections
    const lessons: Array<{
      _id: Id<"lessons">;
      title: string;
      sectionId: Id<"sections">;
    }> = [];

    for (const section of sections) {
      const sectionLessons = await ctx.db
        .query("lessons")
        .withIndex("by_section", (q) => q.eq("sectionId", section._id))
        .collect();

      for (const lesson of sectionLessons) {
        lessons.push({
          _id: lesson._id,
          title: lesson.title,
          sectionId: lesson.sectionId,
        });
      }
    }

    return lessons;
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
      type: lessonTypeValidator,
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
