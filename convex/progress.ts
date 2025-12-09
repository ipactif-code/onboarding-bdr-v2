import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth, requireSelfOrAdmin } from "./lib/auth";

// ============================================================================
// Helper Functions
// ============================================================================

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
 * Get user's progress on a specific lesson.
 * T039: Implement progress.getForLesson query
 */
export const getForLesson = query({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.union(
    v.object({
      _id: v.id("progress"),
      status: v.union(
        v.literal("not_started"),
        v.literal("in_progress"),
        v.literal("completed")
      ),
      completedAt: v.optional(v.number()),
      lastAccessedAt: v.number(),
      timeSpent: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Find progress record for current user and lesson
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", user._id).eq("lessonId", args.lessonId)
      )
      .unique();

    if (!progress) {
      return null;
    }

    return {
      _id: progress._id,
      status: progress.status,
      completedAt: progress.completedAt,
      lastAccessedAt: progress.lastAccessedAt,
      timeSpent: progress.timeSpent,
    };
  },
});

/**
 * Get user's progress across all lessons in a course.
 * T040: Implement progress.getForCourse query
 */
export const getForCourse = query({
  args: {
    courseId: v.id("courses"),
    userId: v.optional(v.id("users")),
  },
  returns: v.object({
    completedLessons: v.number(),
    totalLessons: v.number(),
    percentage: v.number(),
    lessonProgress: v.array(
      v.object({
        lessonId: v.id("lessons"),
        lessonTitle: v.string(),
        sectionTitle: v.string(),
        status: v.union(
          v.literal("not_started"),
          v.literal("in_progress"),
          v.literal("completed")
        ),
        completedAt: v.optional(v.number()),
        timeSpent: v.number(),
      })
    ),
    lastAccessedLesson: v.optional(
      v.object({
        lessonId: v.id("lessons"),
        title: v.string(),
        sectionTitle: v.string(),
        lastAccessedAt: v.number(),
      })
    ),
    totalTimeSpent: v.number(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx);
    const targetUserId = args.userId ?? currentUser._id;

    // Only admin can view other users' progress
    if (targetUserId !== currentUser._id) {
      await requireSelfOrAdmin(ctx, targetUserId);
    }

    // Get course
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      return {
        completedLessons: 0,
        totalLessons: 0,
        percentage: 0,
        lessonProgress: [],
        totalTimeSpent: 0,
      };
    }

    // Get all sections
    const sections = await ctx.db
      .query("sections")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    // Get all lessons for this course
    const allLessons: { lesson: Doc<"lessons">; sectionTitle: string }[] = [];
    for (const section of sections) {
      const lessons = await ctx.db
        .query("lessons")
        .withIndex("by_section", (q) => q.eq("sectionId", section._id))
        .collect();
      for (const lesson of lessons) {
        allLessons.push({ lesson, sectionTitle: section.title });
      }
    }

    // Get user's progress for all lessons
    const userProgress = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .collect();

    const progressMap = new Map(
      userProgress.map((p) => [p.lessonId.toString(), p])
    );

    let completedLessons = 0;
    let totalTimeSpent = 0;
    let lastAccessedLesson:
      | {
          lessonId: Id<"lessons">;
          title: string;
          sectionTitle: string;
          lastAccessedAt: number;
        }
      | undefined;

    const lessonProgress = allLessons.map(({ lesson, sectionTitle }) => {
      const progress = progressMap.get(lesson._id.toString());
      const status = progress?.status ?? "not_started";
      const timeSpent = progress?.timeSpent ?? 0;

      if (status === "completed") {
        completedLessons++;
      }

      totalTimeSpent += timeSpent;

      if (
        progress &&
        (!lastAccessedLesson ||
          progress.lastAccessedAt > lastAccessedLesson.lastAccessedAt)
      ) {
        lastAccessedLesson = {
          lessonId: lesson._id,
          title: lesson.title,
          sectionTitle,
          lastAccessedAt: progress.lastAccessedAt,
        };
      }

      return {
        lessonId: lesson._id,
        lessonTitle: lesson.title,
        sectionTitle,
        status,
        completedAt: progress?.completedAt,
        timeSpent,
      };
    });

    const totalLessons = allLessons.length;
    const percentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      completedLessons,
      totalLessons,
      percentage,
      lessonProgress,
      lastAccessedLesson,
      totalTimeSpent,
    };
  },
});

/**
 * Get "Continue where you left off" data for dashboard.
 * T041: Implement progress.getContinueWatching query
 */
export const getContinueWatching = query({
  args: {},
  returns: v.optional(
    v.object({
      course: v.object({
        _id: v.id("courses"),
        title: v.string(),
        coverImageUrl: v.optional(v.string()),
      }),
      lesson: v.object({
        _id: v.id("lessons"),
        title: v.string(),
        sectionTitle: v.string(),
      }),
      progress: v.object({
        completedLessons: v.number(),
        totalLessons: v.number(),
        percentage: v.number(),
      }),
      lastAccessedAt: v.number(),
    })
  ),
  handler: async (ctx, _args) => {
    const user = await requireAuth(ctx);

    // Get all user progress ordered by last accessed
    const allProgress = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (allProgress.length === 0) {
      return undefined;
    }

    // Find the most recently accessed in-progress lesson
    const inProgressOrStarted = allProgress.filter(
      (p) => p.status === "in_progress"
    );

    // Sort by last accessed
    const sorted = (
      inProgressOrStarted.length > 0 ? inProgressOrStarted : allProgress
    ).sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

    const mostRecent = sorted[0];
    if (!mostRecent) {
      return undefined;
    }

    // Get the lesson
    const lesson = await ctx.db.get(mostRecent.lessonId);
    if (!lesson) {
      return undefined;
    }

    // Get the section
    const section = await ctx.db.get(lesson.sectionId);
    if (!section) {
      return undefined;
    }

    // Get the course
    const course = await ctx.db.get(section.courseId);
    if (!course) {
      return undefined;
    }

    // Only published courses
    if (course.status !== "published") {
      return undefined;
    }

    // Get cover image URL
    let coverImageUrl: string | undefined;
    if (course.coverImageId) {
      const url = await ctx.storage.getUrl(course.coverImageId);
      coverImageUrl = url ?? undefined;
    }

    // Calculate course progress
    const sections = await ctx.db
      .query("sections")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .collect();

    let totalLessons = 0;
    const lessonIds: Id<"lessons">[] = [];

    for (const s of sections) {
      const lessons = await ctx.db
        .query("lessons")
        .withIndex("by_section", (q) => q.eq("sectionId", s._id))
        .collect();
      totalLessons += lessons.length;
      lessonIds.push(...lessons.map((l) => l._id));
    }

    const progressMap = new Map(
      allProgress.map((p) => [p.lessonId.toString(), p])
    );

    let completedLessons = 0;
    for (const lessonId of lessonIds) {
      const progress = progressMap.get(lessonId.toString());
      if (progress?.status === "completed") {
        completedLessons++;
      }
    }

    const percentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      course: {
        _id: course._id,
        title: course.title,
        coverImageUrl,
      },
      lesson: {
        _id: lesson._id,
        title: lesson.title,
        sectionTitle: section.title,
      },
      progress: {
        completedLessons,
        totalLessons,
        percentage,
      },
      lastAccessedAt: mostRecent.lastAccessedAt,
    };
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Mark a lesson as in progress (called when user opens lesson).
 * T042: Implement progress.markStarted mutation
 */
export const markStarted = mutation({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.id("progress"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check access
    const hasAccess = await checkLessonAccess(ctx, args.lessonId, user);
    if (!hasAccess) {
      throw new Error("Access denied");
    }

    // Check if progress record already exists
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", user._id).eq("lessonId", args.lessonId)
      )
      .unique();

    const now = Date.now();

    if (existing) {
      // Update last accessed time
      await ctx.db.patch(existing._id, {
        lastAccessedAt: now,
        status:
          existing.status === "not_started" ? "in_progress" : existing.status,
      });
      return existing._id;
    }

    // Create new progress record
    return await ctx.db.insert("progress", {
      userId: user._id,
      lessonId: args.lessonId,
      status: "in_progress",
      lastAccessedAt: now,
      timeSpent: 0,
    });
  },
});

/**
 * Mark a lesson as completed.
 * T043: Implement progress.markCompleted mutation
 */
export const markCompleted = mutation({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check access
    const hasAccess = await checkLessonAccess(ctx, args.lessonId, user);
    if (!hasAccess) {
      throw new Error("Access denied");
    }

    const now = Date.now();

    // Check if progress record exists
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", user._id).eq("lessonId", args.lessonId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
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

    // Log activity for analytics
    const lesson = await ctx.db.get(args.lessonId);
    if (lesson) {
      const section = await ctx.db.get(lesson.sectionId);
      if (section) {
        await ctx.db.insert("activityLogs", {
          userId: user._id,
          actionType: "lesson_complete",
          category: "course",
          entityType: "lesson",
          entityId: args.lessonId,
          metadata: {
            lessonTitle: lesson.title,
            courseId: section.courseId,
          },
          timestamp: now,
        });
      }
    }

    return null;
  },
});

/**
 * Update time spent on a lesson (called periodically or on leave).
 * T044: Implement progress.updateTimeSpent mutation
 */
export const updateTimeSpent = mutation({
  args: {
    lessonId: v.id("lessons"),
    additionalSeconds: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate additional seconds
    if (args.additionalSeconds < 0 || args.additionalSeconds > 3600) {
      throw new Error("Invalid time increment (must be 0-3600 seconds)");
    }

    // Find existing progress
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", user._id).eq("lessonId", args.lessonId)
      )
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        timeSpent: existing.timeSpent + args.additionalSeconds,
        lastAccessedAt: now,
      });
    } else {
      // Create progress record if it doesn't exist
      await ctx.db.insert("progress", {
        userId: user._id,
        lessonId: args.lessonId,
        status: "in_progress",
        lastAccessedAt: now,
        timeSpent: args.additionalSeconds,
      });
    }

    return null;
  },
});
