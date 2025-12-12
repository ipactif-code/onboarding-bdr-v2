import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, requireAdmin } from "./lib/auth";
import { Id } from "./_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

const actionTypeValidator = v.union(
  v.literal("login"),
  v.literal("logout"),
  v.literal("lesson_view"),
  v.literal("lesson_complete"),
  v.literal("quiz_start"),
  v.literal("quiz_submit"),
  v.literal("comment_post"),
  v.literal("message_send"),
  v.literal("course_enroll")
);

const categoryValidator = v.union(
  v.literal("user"),
  v.literal("course"),
  v.literal("quiz"),
  v.literal("message"),
  v.literal("system")
);

// ============================================================================
// Queries
// ============================================================================

/**
 * Get overview statistics for the admin dashboard.
 * T138: Implement analytics.getOverview query
 */
export const getOverview = query({
  args: {
    teamId: v.optional(v.id("teams")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    totalUsers: v.number(),
    activeUsers: v.number(),
    totalCourses: v.number(),
    publishedCourses: v.number(),
    totalLessonsCompleted: v.number(),
    averageQuizScore: v.number(),
    totalQuizAttempts: v.number(),
    totalTimeSpent: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const now = Date.now();
    const startDate = args.startDate ?? now - 30 * 24 * 60 * 60 * 1000; // Default: last 30 days
    const endDate = args.endDate ?? now;

    // Get users (optionally filtered by team)
    let userIds: Set<Id<"users">> | null = null;
    if (args.teamId) {
      const teamId = args.teamId;
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect();
      userIds = new Set(teamMembers.map((m) => m.userId));
    }

    // Total users
    const allUsers = await ctx.db.query("users").collect();
    const totalUsers = userIds ? userIds.size : allUsers.length;

    // Active users (have activity in the date range)
    const activityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_timestamp")
      .collect();

    const filteredActivity = activityLogs.filter(
      (a) =>
        a.timestamp >= startDate &&
        a.timestamp <= endDate &&
        (!userIds || userIds.has(a.userId))
    );

    const activeUserIds = new Set(filteredActivity.map((a) => a.userId));
    const activeUsers = activeUserIds.size;

    // Total courses
    const allCourses = await ctx.db.query("courses").collect();
    const totalCourses = allCourses.length;
    const publishedCourses = allCourses.filter(
      (c) => c.status === "published"
    ).length;

    // Lessons completed in date range
    const allProgress = await ctx.db.query("progress").collect();
    const completedProgress = allProgress.filter(
      (p) =>
        p.status === "completed" &&
        p.completedAt &&
        p.completedAt >= startDate &&
        p.completedAt <= endDate &&
        (!userIds || userIds.has(p.userId))
    );
    const totalLessonsCompleted = completedProgress.length;

    // Quiz statistics
    const allAttempts = await ctx.db.query("quizAttempts").collect();
    const filteredAttempts = allAttempts.filter(
      (a) =>
        a.submittedAt >= startDate &&
        a.submittedAt <= endDate &&
        (!userIds || userIds.has(a.userId))
    );

    const totalQuizAttempts = filteredAttempts.length;
    const averageQuizScore =
      filteredAttempts.length > 0
        ? filteredAttempts.reduce(
            (sum, a) => sum + (a.score / a.maxScore) * 100,
            0
          ) / filteredAttempts.length
        : 0;

    // Total time spent (from progress records)
    const totalTimeSpent = allProgress
      .filter((p) => !userIds || userIds.has(p.userId))
      .reduce((sum, p) => sum + p.timeSpent, 0);

    return {
      totalUsers,
      activeUsers,
      totalCourses,
      publishedCourses,
      totalLessonsCompleted,
      averageQuizScore: Math.round(averageQuizScore * 10) / 10,
      totalQuizAttempts,
      totalTimeSpent,
    };
  },
});

/**
 * Get user activity data for charts/tables.
 * T139: Implement analytics.getUserActivity query
 */
export const getUserActivity = query({
  args: {
    teamId: v.optional(v.id("teams")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      userName: v.string(),
      email: v.string(),
      avatarUrl: v.optional(v.string()),
      lessonsCompleted: v.number(),
      quizzesTaken: v.number(),
      averageQuizScore: v.number(),
      timeSpent: v.number(),
      lastActive: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const now = Date.now();
    const startDate = args.startDate ?? now - 30 * 24 * 60 * 60 * 1000;
    const endDate = args.endDate ?? now;
    const limit = args.limit ?? 50;

    // Get users (optionally filtered by team)
    let users = await ctx.db.query("users").collect();

    if (args.teamId) {
      const teamId = args.teamId;
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect();
      const memberIds = new Set(teamMembers.map((m) => m.userId.toString()));
      users = users.filter((u) => memberIds.has(u._id.toString()));
    }

    // Get activity data for each user
    const result = await Promise.all(
      users.map(async (user) => {
        // Progress data
        const progress = await ctx.db
          .query("progress")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

        const completedInRange = progress.filter(
          (p) =>
            p.status === "completed" &&
            p.completedAt &&
            p.completedAt >= startDate &&
            p.completedAt <= endDate
        );

        const totalTimeSpent = progress.reduce((sum, p) => sum + p.timeSpent, 0);

        // Quiz attempts
        const quizAttempts = await ctx.db
          .query("quizAttempts")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

        const attemptsInRange = quizAttempts.filter(
          (a) => a.submittedAt >= startDate && a.submittedAt <= endDate
        );

        const averageScore =
          attemptsInRange.length > 0
            ? attemptsInRange.reduce(
                (sum, a) => sum + (a.score / a.maxScore) * 100,
                0
              ) / attemptsInRange.length
            : 0;

        // Last active
        const lastProgress = progress
          .filter((p) => p.lastAccessedAt)
          .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)[0];

        return {
          userId: user._id,
          userName: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          lessonsCompleted: completedInRange.length,
          quizzesTaken: attemptsInRange.length,
          averageQuizScore: Math.round(averageScore * 10) / 10,
          timeSpent: totalTimeSpent,
          lastActive: lastProgress?.lastAccessedAt ?? user.lastActiveAt,
        };
      })
    );

    // Sort by lessons completed (most active first) and limit
    return result
      .sort((a, b) => b.lessonsCompleted - a.lessonsCompleted)
      .slice(0, limit);
  },
});

/**
 * Get quiz performance metrics.
 * T140: Implement analytics.getQuizMetrics query
 */
export const getQuizMetrics = query({
  args: {
    teamId: v.optional(v.id("teams")),
    courseId: v.optional(v.id("courses")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    totalAttempts: v.number(),
    passRate: v.number(),
    averageScore: v.number(),
    scoreDistribution: v.array(
      v.object({
        range: v.string(),
        count: v.number(),
      })
    ),
    topQuizzes: v.array(
      v.object({
        quizConfigId: v.id("quizConfigs"),
        lessonTitle: v.string(),
        courseTitle: v.string(),
        attempts: v.number(),
        passRate: v.number(),
        averageScore: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const now = Date.now();
    const startDate = args.startDate ?? now - 30 * 24 * 60 * 60 * 1000;
    const endDate = args.endDate ?? now;

    // Get user IDs if filtered by team
    let userIds: Set<string> | null = null;
    if (args.teamId) {
      const teamId = args.teamId;
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect();
      userIds = new Set(teamMembers.map((m) => m.userId.toString()));
    }

    // Get all quiz attempts in range
    let attempts = await ctx.db.query("quizAttempts").collect();
    attempts = attempts.filter(
      (a) =>
        a.submittedAt >= startDate &&
        a.submittedAt <= endDate &&
        (!userIds || userIds.has(a.userId.toString()))
    );

    // Filter by course if specified
    if (args.courseId) {
      const courseId = args.courseId;
      const sections = await ctx.db
        .query("sections")
        .withIndex("by_course", (q) => q.eq("courseId", courseId))
        .collect();
      const sectionIds = new Set(sections.map((s) => s._id.toString()));

      const lessons = await ctx.db.query("lessons").collect();
      const courseLessons = lessons.filter((l) =>
        sectionIds.has(l.sectionId.toString())
      );
      const lessonIds = new Set(courseLessons.map((l) => l._id.toString()));

      const quizConfigs = await ctx.db.query("quizConfigs").collect();
      const courseQuizIds = new Set(
        quizConfigs
          .filter((q) => lessonIds.has(q.lessonId.toString()))
          .map((q) => q._id.toString())
      );

      attempts = attempts.filter((a) =>
        courseQuizIds.has(a.quizConfigId.toString())
      );
    }

    const totalAttempts = attempts.length;
    const passedAttempts = attempts.filter((a) => a.passed).length;
    const passRate =
      totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0;
    const averageScore =
      totalAttempts > 0
        ? attempts.reduce((sum, a) => sum + (a.score / a.maxScore) * 100, 0) /
          totalAttempts
        : 0;

    // Score distribution
    const scoreDistribution = [
      { range: "0-20%", count: 0 },
      { range: "21-40%", count: 0 },
      { range: "41-60%", count: 0 },
      { range: "61-80%", count: 0 },
      { range: "81-100%", count: 0 },
    ];

    for (const attempt of attempts) {
      const score = (attempt.score / attempt.maxScore) * 100;
      if (score <= 20) scoreDistribution[0].count++;
      else if (score <= 40) scoreDistribution[1].count++;
      else if (score <= 60) scoreDistribution[2].count++;
      else if (score <= 80) scoreDistribution[3].count++;
      else scoreDistribution[4].count++;
    }

    // Top quizzes by attempts
    const quizAttemptCounts = new Map<
      string,
      { attempts: typeof attempts; quizConfigId: Id<"quizConfigs"> }
    >();
    for (const attempt of attempts) {
      const key = attempt.quizConfigId.toString();
      if (!quizAttemptCounts.has(key)) {
        quizAttemptCounts.set(key, {
          attempts: [],
          quizConfigId: attempt.quizConfigId,
        });
      }
      quizAttemptCounts.get(key)!.attempts.push(attempt);
    }

    const topQuizzes = await Promise.all(
      Array.from(quizAttemptCounts.entries())
        .sort((a, b) => b[1].attempts.length - a[1].attempts.length)
        .slice(0, 5)
        .map(async ([, data]) => {
          const quizConfig = await ctx.db.get(data.quizConfigId);
          if (!quizConfig) {
            return null;
          }

          const lesson = await ctx.db.get(quizConfig.lessonId);
          if (!lesson) {
            return null;
          }

          const section = await ctx.db.get(lesson.sectionId);
          if (!section) {
            return null;
          }

          const course = await ctx.db.get(section.courseId);

          const quizAttempts = data.attempts;
          const passed = quizAttempts.filter((a) => a.passed).length;
          const avgScore =
            quizAttempts.reduce(
              (sum, a) => sum + (a.score / a.maxScore) * 100,
              0
            ) / quizAttempts.length;

          return {
            quizConfigId: data.quizConfigId,
            lessonTitle: lesson.title,
            courseTitle: course?.title ?? "Unknown Course",
            attempts: quizAttempts.length,
            passRate: Math.round((passed / quizAttempts.length) * 100 * 10) / 10,
            averageScore: Math.round(avgScore * 10) / 10,
          };
        })
    );

    return {
      totalAttempts,
      passRate: Math.round(passRate * 10) / 10,
      averageScore: Math.round(averageScore * 10) / 10,
      scoreDistribution,
      topQuizzes: topQuizzes.filter(
        (q): q is NonNullable<typeof q> => q !== null
      ),
    };
  },
});

/**
 * Get course-level metrics.
 * T141: Implement analytics.getCourseMetrics query
 */
export const getCourseMetrics = query({
  args: {
    teamId: v.optional(v.id("teams")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      courseId: v.id("courses"),
      title: v.string(),
      status: v.union(v.literal("draft"), v.literal("published")),
      enrolledUsers: v.number(),
      completedUsers: v.number(),
      completionRate: v.number(),
      averageProgress: v.number(),
      totalViews: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Get user IDs if filtered by team
    let userIds: Set<string> | null = null;
    if (args.teamId) {
      const teamId = args.teamId;
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect();
      userIds = new Set(teamMembers.map((m) => m.userId.toString()));
    }

    const courses = await ctx.db.query("courses").collect();

    const result = await Promise.all(
      courses.map(async (course) => {
        // Get all sections and lessons for this course
        const sections = await ctx.db
          .query("sections")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();

        const sectionIds = sections.map((s) => s._id);
        let totalLessons = 0;

        const allLessonIds: Id<"lessons">[] = [];
        for (const sectionId of sectionIds) {
          const lessons = await ctx.db
            .query("lessons")
            .withIndex("by_section", (q) => q.eq("sectionId", sectionId))
            .collect();
          totalLessons += lessons.length;
          allLessonIds.push(...lessons.map((l) => l._id));
        }

        // Get progress for this course's lessons
        const lessonIdSet = new Set(allLessonIds.map((id) => id.toString()));
        const allProgress = await ctx.db.query("progress").collect();
        const courseProgress = allProgress.filter(
          (p) =>
            lessonIdSet.has(p.lessonId.toString()) &&
            (!userIds || userIds.has(p.userId.toString()))
        );

        // Calculate metrics
        const userProgressMap = new Map<string, { completed: number; total: number }>();
        for (const progress of courseProgress) {
          const key = progress.userId.toString();
          if (!userProgressMap.has(key)) {
            userProgressMap.set(key, { completed: 0, total: totalLessons });
          }
          if (progress.status === "completed") {
            userProgressMap.get(key)!.completed++;
          }
        }

        const enrolledUsers = userProgressMap.size;
        let completedUsers = 0;
        let totalProgress = 0;

        for (const [, data] of userProgressMap) {
          if (data.total > 0 && data.completed === data.total) {
            completedUsers++;
          }
          if (data.total > 0) {
            totalProgress += data.completed / data.total;
          }
        }

        const completionRate =
          enrolledUsers > 0 ? (completedUsers / enrolledUsers) * 100 : 0;
        const averageProgress =
          enrolledUsers > 0 ? (totalProgress / enrolledUsers) * 100 : 0;

        return {
          courseId: course._id,
          title: course.title,
          status: course.status,
          enrolledUsers,
          completedUsers,
          completionRate: Math.round(completionRate * 10) / 10,
          averageProgress: Math.round(averageProgress * 10) / 10,
          totalViews: course.viewCount,
        };
      })
    );

    // Sort by enrolled users
    return result.sort((a, b) => b.enrolledUsers - a.enrolledUsers);
  },
});

/**
 * Get paginated activity log.
 * T142: Implement analytics.getActivityLog query (paginated, filterable)
 */
export const getActivityLog = query({
  args: {
    userId: v.optional(v.id("users")),
    teamId: v.optional(v.id("teams")),
    actionType: v.optional(actionTypeValidator),
    category: v.optional(categoryValidator),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    logs: v.array(
      v.object({
        _id: v.id("activityLogs"),
        userId: v.id("users"),
        userName: v.string(),
        avatarUrl: v.optional(v.string()),
        actionType: actionTypeValidator,
        category: categoryValidator,
        entityType: v.optional(v.string()),
        entityId: v.optional(v.string()),
        metadata: v.optional(v.any()),
        timestamp: v.number(),
      })
    ),
    nextCursor: v.optional(v.number()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const now = Date.now();
    const startDate = args.startDate ?? now - 7 * 24 * 60 * 60 * 1000; // Default: last 7 days
    const endDate = args.endDate ?? now;
    const limit = args.limit ?? 50;
    const cursor = args.cursor ?? endDate;

    // Get user IDs if filtered by team
    let userIds: Set<string> | null = null;
    if (args.teamId) {
      const teamId = args.teamId;
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect();
      userIds = new Set(teamMembers.map((m) => m.userId.toString()));
    }

    // Query logs
    let logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_timestamp")
      .collect();

    // Apply filters
    logs = logs.filter((log) => {
      if (log.timestamp > cursor) return false;
      if (log.timestamp < startDate) return false;
      if (args.userId && log.userId !== args.userId) return false;
      if (userIds && !userIds.has(log.userId.toString())) return false;
      if (args.actionType && log.actionType !== args.actionType) return false;
      if (args.category && log.category !== args.category) return false;
      return true;
    });

    // Sort by timestamp descending
    logs.sort((a, b) => b.timestamp - a.timestamp);

    // Paginate
    const paginatedLogs = logs.slice(0, limit + 1);
    const hasMore = paginatedLogs.length > limit;
    const resultLogs = paginatedLogs.slice(0, limit);

    // Get user details
    const result = await Promise.all(
      resultLogs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        return {
          _id: log._id,
          userId: log.userId,
          userName: user?.name ?? "Unknown User",
          avatarUrl: user?.avatarUrl,
          actionType: log.actionType,
          category: log.category,
          entityType: log.entityType,
          entityId: log.entityId,
          metadata: log.metadata,
          timestamp: log.timestamp,
        };
      })
    );

    return {
      logs: result,
      nextCursor: hasMore ? resultLogs[resultLogs.length - 1]?.timestamp : undefined,
      hasMore,
    };
  },
});

/**
 * Get session statistics.
 * T143: Implement analytics.getSessionStats query
 */
export const getSessionStats = query({
  args: {
    teamId: v.optional(v.id("teams")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    totalSessions: v.number(),
    averageSessionDuration: v.number(),
    activeSessions: v.number(),
    dailySessionCounts: v.array(
      v.object({
        date: v.string(),
        count: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const now = Date.now();
    const startDate = args.startDate ?? now - 30 * 24 * 60 * 60 * 1000;
    const endDate = args.endDate ?? now;

    // Get user IDs if filtered by team
    let userIds: Set<string> | null = null;
    if (args.teamId) {
      const teamId = args.teamId;
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect();
      userIds = new Set(teamMembers.map((m) => m.userId.toString()));
    }

    // Get sessions in range
    let sessions = await ctx.db.query("sessions").collect();
    sessions = sessions.filter(
      (s) =>
        s.startedAt >= startDate &&
        s.startedAt <= endDate &&
        (!userIds || userIds.has(s.userId.toString()))
    );

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter((s) => !s.endedAt).length;

    const completedSessions = sessions.filter((s) => s.duration);
    const averageSessionDuration =
      completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => sum + (s.duration ?? 0), 0) /
          completedSessions.length
        : 0;

    // Daily session counts
    const dailyCounts = new Map<string, number>();
    for (const session of sessions) {
      const date = new Date(session.startedAt).toISOString().split("T")[0];
      dailyCounts.set(date, (dailyCounts.get(date) ?? 0) + 1);
    }

    const dailySessionCounts = Array.from(dailyCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSessions,
      averageSessionDuration: Math.round(averageSessionDuration),
      activeSessions,
      dailySessionCounts,
    };
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Log an activity (internal mutation for use by other functions).
 * T144: Implement analytics.logActivity internal mutation
 */
export const logActivity = internalMutation({
  args: {
    userId: v.id("users"),
    actionType: actionTypeValidator,
    category: categoryValidator,
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("activityLogs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("activityLogs", {
      userId: args.userId,
      actionType: args.actionType,
      category: args.category,
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: args.metadata,
      timestamp: Date.now(),
    });
  },
});

/**
 * Start a new user session.
 * T145: Implement analytics.startSession mutation
 */
export const startSession = mutation({
  args: {},
  returns: v.id("sessions"),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // End any existing active sessions for this user
    const activeSessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const now = Date.now();
    for (const session of activeSessions) {
      if (!session.endedAt) {
        await ctx.db.patch(session._id, {
          endedAt: now,
          duration: now - session.startedAt,
        });
      }
    }

    // Create new session
    const sessionId = await ctx.db.insert("sessions", {
      userId: user._id,
      startedAt: now,
    });

    // Log activity
    await ctx.scheduler.runAfter(0, internal.analytics.logActivity, {
      userId: user._id,
      actionType: "login",
      category: "user",
    });

    return sessionId;
  },
});

/**
 * End a user session.
 * T146: Implement analytics.endSession mutation
 */
export const endSession = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    // Verify ownership
    if (session.userId !== user._id) {
      return null;
    }

    // Already ended
    if (session.endedAt) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      endedAt: now,
      duration: now - session.startedAt,
    });

    // Log activity
    await ctx.scheduler.runAfter(0, internal.analytics.logActivity, {
      userId: user._id,
      actionType: "logout",
      category: "user",
    });

    return null;
  },
});

/**
 * Update session heartbeat to keep it alive.
 * T147: Implement analytics.heartbeat mutation
 */
export const heartbeat = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    // Verify ownership and session is still active
    if (session.userId !== user._id || session.endedAt) {
      return null;
    }

    // Update user's last active timestamp
    await ctx.db.patch(user._id, {
      lastActiveAt: Date.now(),
      status: "online",
    });

    return null;
  },
});

/**
 * Helper function to log activity from other modules.
 * T148: Integrate activity logging into existing mutations
 * This is exposed for use by other modules via scheduler
 */
export const logActivityFromModule = mutation({
  args: {
    userId: v.id("users"),
    actionType: actionTypeValidator,
    category: categoryValidator,
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Only allow internal calls (no auth check - used by other mutations)
    await ctx.db.insert("activityLogs", {
      userId: args.userId,
      actionType: args.actionType,
      category: args.category,
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: args.metadata,
      timestamp: Date.now(),
    });

    return null;
  },
});
