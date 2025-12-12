import { v } from "convex/values";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser, requireAuth, requireAdmin } from "./lib/auth";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user has access to a course based on visibility settings.
 */
async function checkCourseAccess(
  ctx: QueryCtx | MutationCtx,
  courseId: Id<"courses">,
  user: Doc<"users">
): Promise<boolean> {
  const course = await ctx.db.get(courseId);
  if (!course) return false;

  // Admins can access all courses
  if (user.role === "admin") return true;

  // Only published courses for regular users
  if (course.status !== "published") return false;

  // All teams visibility
  if (course.visibility === "all_teams") return true;

  // Check specific team/user assignments
  const assignments = await ctx.db
    .query("courseAssignments")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();

  // Check direct user assignment
  if (assignments.some((a) => a.userId === user._id)) {
    return true;
  }

  // Check team assignment
  const userTeams = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();

  const userTeamIds = new Set(userTeams.map((t) => t.teamId.toString()));

  return assignments.some(
    (a) => a.teamId && userTeamIds.has(a.teamId.toString())
  );
}

/**
 * Get course cover image URL from storage.
 */
async function getCoverImageUrl(
  ctx: QueryCtx | MutationCtx,
  coverImageId: Id<"_storage"> | undefined
): Promise<string | undefined> {
  if (!coverImageId) return undefined;
  const url = await ctx.storage.getUrl(coverImageId);
  return url ?? undefined;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * List courses assigned to the current user with progress.
 * T033: Implement courses.listForUser query
 */
export const listForUser = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("courses"),
      title: v.string(),
      description: v.optional(v.string()),
      coverImageUrl: v.optional(v.string()),
      displayOrder: v.number(),
      tags: v.array(
        v.object({
          _id: v.id("tags"),
          name: v.string(),
        })
      ),
      progress: v.object({
        completedLessons: v.number(),
        totalLessons: v.number(),
        percentage: v.number(),
        lastAccessedLessonId: v.optional(v.id("lessons")),
        lastAccessedAt: v.optional(v.number()),
      }),
    })
  ),
  handler: async (ctx, _args) => {
    const user = await requireAuth(ctx);

    // Get all published courses
    const allCourses = await ctx.db
      .query("courses")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();

    // Filter by access
    const accessibleCourses: Doc<"courses">[] = [];
    for (const course of allCourses) {
      const hasAccess = await checkCourseAccess(ctx, course._id, user);
      if (hasAccess) {
        accessibleCourses.push(course);
      }
    }

    // Sort by display order
    accessibleCourses.sort((a, b) => a.displayOrder - b.displayOrder);

    // Build response with progress for each course
    const result = await Promise.all(
      accessibleCourses.map(async (course) => {
        // Get cover image URL
        const coverImageUrl = await getCoverImageUrl(ctx, course.coverImageId);

        // Get tags
        const courseTags = await ctx.db
          .query("courseTags")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();

        const tags = await Promise.all(
          courseTags.map(async (ct) => {
            const tag = await ctx.db.get(ct.tagId);
            return tag ? { _id: tag._id, name: tag.name } : null;
          })
        );

        // Get all sections and lessons for this course
        const sections = await ctx.db
          .query("sections")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();

        let totalLessons = 0;
        const allLessonIds: Id<"lessons">[] = [];

        for (const section of sections) {
          const lessons = await ctx.db
            .query("lessons")
            .withIndex("by_section", (q) => q.eq("sectionId", section._id))
            .collect();
          totalLessons += lessons.length;
          allLessonIds.push(...lessons.map((l) => l._id));
        }

        // Get user progress for these lessons
        const userProgress = await ctx.db
          .query("progress")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

        const lessonProgressMap = new Map(
          userProgress.map((p) => [p.lessonId.toString(), p])
        );

        let completedLessons = 0;
        let lastAccessedLessonId: Id<"lessons"> | undefined;
        let lastAccessedAt: number | undefined;

        for (const lessonId of allLessonIds) {
          const progress = lessonProgressMap.get(lessonId.toString());
          if (progress) {
            if (progress.status === "completed") {
              completedLessons++;
            }
            if (!lastAccessedAt || progress.lastAccessedAt > lastAccessedAt) {
              lastAccessedAt = progress.lastAccessedAt;
              lastAccessedLessonId = lessonId;
            }
          }
        }

        const percentage =
          totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0;

        return {
          _id: course._id,
          title: course.title,
          description: course.description,
          coverImageUrl,
          displayOrder: course.displayOrder,
          tags: tags.filter((t): t is { _id: Id<"tags">; name: string } => t !== null),
          progress: {
            completedLessons,
            totalLessons,
            percentage,
            lastAccessedLessonId,
            lastAccessedAt,
          },
        };
      })
    );

    return result;
  },
});

/**
 * Get course details with sections and lessons.
 * T034: Implement courses.get query
 */
export const get = query({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.union(
    v.object({
      _id: v.id("courses"),
      title: v.string(),
      description: v.optional(v.string()),
      coverImageUrl: v.optional(v.string()),
      creator: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      status: v.union(v.literal("draft"), v.literal("published")),
      visibility: v.union(
        v.literal("all_teams"),
        v.literal("specific_teams"),
        v.literal("specific_users")
      ),
      displayOrder: v.number(),
      viewCount: v.number(),
      tags: v.array(
        v.object({
          _id: v.id("tags"),
          name: v.string(),
        })
      ),
      assignedTeamIds: v.array(v.id("teams")),
      assignedTeams: v.array(
        v.object({
          _id: v.id("teams"),
          name: v.string(),
        })
      ),
      sections: v.array(
        v.object({
          _id: v.id("sections"),
          title: v.string(),
          description: v.optional(v.string()),
          displayOrder: v.number(),
          lessons: v.array(
            v.object({
              _id: v.id("lessons"),
              title: v.string(),
              type: v.union(
                v.literal("text"),
                v.literal("embed"),
                v.literal("quiz"),
                v.literal("files")
              ),
              estimatedDuration: v.optional(v.number()),
              displayOrder: v.number(),
            })
          ),
        })
      ),
      publishedAt: v.optional(v.number()),
      _creationTime: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      return null;
    }

    // Check access
    const hasAccess = await checkCourseAccess(ctx, args.courseId, user);
    if (!hasAccess) {
      return null;
    }

    // Get creator
    const creator = await ctx.db.get(course.creatorId);
    if (!creator) {
      return null;
    }

    // Get cover image URL
    const coverImageUrl = await getCoverImageUrl(ctx, course.coverImageId);

    // Get tags
    const courseTags = await ctx.db
      .query("courseTags")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .collect();

    const tags = await Promise.all(
      courseTags.map(async (ct) => {
        const tag = await ctx.db.get(ct.tagId);
        return tag ? { _id: tag._id, name: tag.name } : null;
      })
    );

    // Get assigned teams
    const assignments = await ctx.db
      .query("courseAssignments")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .collect();

    const assignedTeamIds = assignments
      .filter((a) => a.teamId)
      .map((a) => a.teamId as Id<"teams">);

    const assignedTeams = await Promise.all(
      assignedTeamIds.map(async (teamId) => {
        const team = await ctx.db.get(teamId);
        return team ? { _id: team._id, name: team.name } : null;
      })
    );

    // Get sections with lessons
    const sections = await ctx.db
      .query("sections")
      .withIndex("by_course_order", (q) => q.eq("courseId", course._id))
      .collect();

    const sectionsWithLessons = await Promise.all(
      sections
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(async (section) => {
          const lessons = await ctx.db
            .query("lessons")
            .withIndex("by_section_order", (q) => q.eq("sectionId", section._id))
            .collect();

          return {
            _id: section._id,
            title: section.title,
            description: section.description,
            displayOrder: section.displayOrder,
            lessons: lessons
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((lesson) => ({
                _id: lesson._id,
                title: lesson.title,
                type: lesson.type,
                estimatedDuration: lesson.estimatedDuration,
                displayOrder: lesson.displayOrder,
              })),
          };
        })
    );

    return {
      _id: course._id,
      title: course.title,
      description: course.description,
      coverImageUrl,
      creator: {
        _id: creator._id,
        name: creator.name,
        avatarUrl: creator.avatarUrl,
      },
      status: course.status,
      visibility: course.visibility,
      displayOrder: course.displayOrder,
      viewCount: course.viewCount,
      tags: tags.filter((t): t is { _id: Id<"tags">; name: string } => t !== null),
      assignedTeamIds,
      assignedTeams: assignedTeams.filter((t): t is { _id: Id<"teams">; name: string } => t !== null),
      sections: sectionsWithLessons,
      publishedAt: course.publishedAt,
      _creationTime: course._creationTime,
    };
  },
});

/**
 * Get course with user progress for each lesson.
 * T035: Implement courses.getWithProgress query
 */
export const getWithProgress = query({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.union(
    v.object({
      _id: v.id("courses"),
      title: v.string(),
      description: v.optional(v.string()),
      coverImageUrl: v.optional(v.string()),
      creator: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      status: v.union(v.literal("draft"), v.literal("published")),
      visibility: v.union(
        v.literal("all_teams"),
        v.literal("specific_teams"),
        v.literal("specific_users")
      ),
      displayOrder: v.number(),
      viewCount: v.number(),
      tags: v.array(
        v.object({
          _id: v.id("tags"),
          name: v.string(),
        })
      ),
      sections: v.array(
        v.object({
          _id: v.id("sections"),
          title: v.string(),
          description: v.optional(v.string()),
          displayOrder: v.number(),
          lessons: v.array(
            v.object({
              _id: v.id("lessons"),
              title: v.string(),
              type: v.union(
                v.literal("text"),
                v.literal("embed"),
                v.literal("quiz"),
                v.literal("files")
              ),
              estimatedDuration: v.optional(v.number()),
              displayOrder: v.number(),
            })
          ),
        })
      ),
      publishedAt: v.optional(v.number()),
      _creationTime: v.number(),
      userProgress: v.object({
        completedLessons: v.number(),
        totalLessons: v.number(),
        percentage: v.number(),
        lessonStatuses: v.array(
          v.object({
            lessonId: v.id("lessons"),
            status: v.union(
              v.literal("not_started"),
              v.literal("in_progress"),
              v.literal("completed")
            ),
            completedAt: v.optional(v.number()),
          })
        ),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      return null;
    }

    // Check access
    const hasAccess = await checkCourseAccess(ctx, args.courseId, user);
    if (!hasAccess) {
      return null;
    }

    // Get creator
    const creator = await ctx.db.get(course.creatorId);
    if (!creator) {
      return null;
    }

    // Get cover image URL
    const coverImageUrl = await getCoverImageUrl(ctx, course.coverImageId);

    // Get tags
    const courseTags = await ctx.db
      .query("courseTags")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .collect();

    const tags = await Promise.all(
      courseTags.map(async (ct) => {
        const tag = await ctx.db.get(ct.tagId);
        return tag ? { _id: tag._id, name: tag.name } : null;
      })
    );

    // Get sections with lessons
    const sections = await ctx.db
      .query("sections")
      .withIndex("by_course_order", (q) => q.eq("courseId", course._id))
      .collect();

    // Get user progress for all lessons
    const userProgressRecords = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const progressMap = new Map(
      userProgressRecords.map((p) => [p.lessonId.toString(), p])
    );

    let totalLessons = 0;
    let completedLessons = 0;
    const lessonStatuses: {
      lessonId: Id<"lessons">;
      status: "not_started" | "in_progress" | "completed";
      completedAt?: number;
    }[] = [];

    const sectionsWithLessons = await Promise.all(
      sections
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(async (section) => {
          const lessons = await ctx.db
            .query("lessons")
            .withIndex("by_section_order", (q) => q.eq("sectionId", section._id))
            .collect();

          for (const lesson of lessons) {
            totalLessons++;
            const progress = progressMap.get(lesson._id.toString());
            const status = progress?.status ?? "not_started";

            if (status === "completed") {
              completedLessons++;
            }

            lessonStatuses.push({
              lessonId: lesson._id,
              status,
              completedAt: progress?.completedAt,
            });
          }

          return {
            _id: section._id,
            title: section.title,
            description: section.description,
            displayOrder: section.displayOrder,
            lessons: lessons
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((lesson) => ({
                _id: lesson._id,
                title: lesson.title,
                type: lesson.type,
                estimatedDuration: lesson.estimatedDuration,
                displayOrder: lesson.displayOrder,
              })),
          };
        })
    );

    const percentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      _id: course._id,
      title: course.title,
      description: course.description,
      coverImageUrl,
      creator: {
        _id: creator._id,
        name: creator.name,
        avatarUrl: creator.avatarUrl,
      },
      status: course.status,
      visibility: course.visibility,
      displayOrder: course.displayOrder,
      viewCount: course.viewCount,
      tags: tags.filter((t): t is { _id: Id<"tags">; name: string } => t !== null),
      sections: sectionsWithLessons,
      publishedAt: course.publishedAt,
      _creationTime: course._creationTime,
      userProgress: {
        completedLessons,
        totalLessons,
        percentage,
        lessonStatuses,
      },
    };
  },
});

/**
 * List all courses (admin view with drafts).
 * For US2 - admin course management.
 */
export const list = query({
  args: {
    status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
    tagId: v.optional(v.id("tags")),
    search: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("courses"),
      title: v.string(),
      description: v.optional(v.string()),
      coverImageUrl: v.optional(v.string()),
      status: v.union(v.literal("draft"), v.literal("published")),
      visibility: v.union(
        v.literal("all_teams"),
        v.literal("specific_teams"),
        v.literal("specific_users")
      ),
      displayOrder: v.number(),
      viewCount: v.number(),
      sectionCount: v.number(),
      lessonCount: v.number(),
      tags: v.array(
        v.object({
          _id: v.id("tags"),
          name: v.string(),
        })
      ),
      publishedAt: v.optional(v.number()),
      _creationTime: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const isAdmin = user?.role === "admin";

    let courses: Doc<"courses">[];

    if (args.status) {
      courses = await ctx.db
        .query("courses")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      courses = await ctx.db.query("courses").collect();
    }

    // Non-admins only see published courses they have access to
    if (!isAdmin) {
      courses = courses.filter((c) => c.status === "published");
      if (user) {
        const accessible: Doc<"courses">[] = [];
        for (const course of courses) {
          const hasAccess = await checkCourseAccess(ctx, course._id, user);
          if (hasAccess) {
            accessible.push(course);
          }
        }
        courses = accessible;
      }
    }

    // Filter by tag
    if (args.tagId) {
      const courseTagRecords = await ctx.db
        .query("courseTags")
        .withIndex("by_tag", (q) => q.eq("tagId", args.tagId!))
        .collect();
      const courseIdsWithTag = new Set(
        courseTagRecords.map((ct) => ct.courseId.toString())
      );
      courses = courses.filter((c) => courseIdsWithTag.has(c._id.toString()));
    }

    // Search
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      courses = courses.filter(
        (c) =>
          c.title.toLowerCase().includes(searchLower) ||
          c.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by display order
    courses.sort((a, b) => a.displayOrder - b.displayOrder);

    // Build response
    const result = await Promise.all(
      courses.map(async (course) => {
        const coverImageUrl = await getCoverImageUrl(ctx, course.coverImageId);

        // Get tags
        const courseTags = await ctx.db
          .query("courseTags")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();

        const tags = await Promise.all(
          courseTags.map(async (ct) => {
            const tag = await ctx.db.get(ct.tagId);
            return tag ? { _id: tag._id, name: tag.name } : null;
          })
        );

        // Get section and lesson counts
        const sections = await ctx.db
          .query("sections")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();

        let lessonCount = 0;
        for (const section of sections) {
          const lessons = await ctx.db
            .query("lessons")
            .withIndex("by_section", (q) => q.eq("sectionId", section._id))
            .collect();
          lessonCount += lessons.length;
        }

        return {
          _id: course._id,
          title: course.title,
          description: course.description,
          coverImageUrl,
          status: course.status,
          visibility: course.visibility,
          displayOrder: course.displayOrder,
          viewCount: course.viewCount,
          sectionCount: sections.length,
          lessonCount,
          tags: tags.filter(
            (t): t is { _id: Id<"tags">; name: string } => t !== null
          ),
          publishedAt: course.publishedAt,
          _creationTime: course._creationTime,
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
 * Increment course view count.
 * T036: Implement courses.incrementViewCount mutation
 */
export const incrementViewCount = mutation({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Check access
    const hasAccess = await checkCourseAccess(ctx, args.courseId, user);
    if (!hasAccess) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(args.courseId, {
      viewCount: course.viewCount + 1,
    });

    return null;
  },
});

/**
 * Create a new draft course.
 * T070: Implement courses.create mutation
 */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("courses"),
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    // Validate title
    if (args.title.length < 3 || args.title.length > 200) {
      throw new Error("Title must be between 3 and 200 characters");
    }

    // Validate description
    if (args.description && args.description.length > 2000) {
      throw new Error("Description must be at most 2000 characters");
    }

    // Get next display order
    const allCourses = await ctx.db.query("courses").collect();
    const maxOrder = allCourses.reduce(
      (max, c) => Math.max(max, c.displayOrder),
      0
    );

    return await ctx.db.insert("courses", {
      title: args.title,
      description: args.description,
      creatorId: user._id,
      status: "draft",
      visibility: "all_teams",
      displayOrder: maxOrder + 1,
      viewCount: 0,
    });
  },
});

/**
 * Update course details.
 * T071: Implement courses.update mutation
 */
export const update = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(
      v.union(
        v.literal("all_teams"),
        v.literal("specific_teams"),
        v.literal("specific_users")
      )
    ),
    displayOrder: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    const updates: Partial<Doc<"courses">> = {};

    if (args.title !== undefined) {
      if (args.title.length < 3 || args.title.length > 200) {
        throw new Error("Title must be between 3 and 200 characters");
      }
      updates.title = args.title;
    }

    if (args.description !== undefined) {
      if (args.description.length > 2000) {
        throw new Error("Description must be at most 2000 characters");
      }
      updates.description = args.description;
    }

    if (args.visibility !== undefined) {
      updates.visibility = args.visibility;
    }

    if (args.displayOrder !== undefined) {
      updates.displayOrder = args.displayOrder;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.courseId, updates);
    }

    return null;
  },
});

/**
 * Set course cover image.
 * T072: Implement courses.setCoverImage mutation
 */
export const setCoverImage = mutation({
  args: {
    courseId: v.id("courses"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Delete old cover image if exists
    if (course.coverImageId) {
      await ctx.storage.delete(course.coverImageId);
    }

    await ctx.db.patch(args.courseId, {
      coverImageId: args.storageId,
    });

    return null;
  },
});

/**
 * Publish a draft course.
 * T073: Implement courses.publish mutation
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

/**
 * Add a tag to a course.
 * T077: Implement courses.addTag mutation
 */
export const addTag = mutation({
  args: {
    courseId: v.id("courses"),
    tagName: v.string(),
  },
  returns: v.id("tags"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Find or create tag
    let tag = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("name", args.tagName))
      .unique();

    if (!tag) {
      const tagId = await ctx.db.insert("tags", { name: args.tagName });
      tag = await ctx.db.get(tagId);
    }

    if (!tag) {
      throw new Error("Failed to create tag");
    }

    // Check if already exists
    const existing = await ctx.db
      .query("courseTags")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    if (existing.some((ct) => ct.tagId === tag!._id)) {
      return tag._id;
    }

    // Add course-tag association
    await ctx.db.insert("courseTags", {
      courseId: args.courseId,
      tagId: tag._id,
    });

    return tag._id;
  },
});

/**
 * Remove a tag from a course.
 * T077: Implement courses.removeTag mutation
 */
export const removeTag = mutation({
  args: {
    courseId: v.id("courses"),
    tagId: v.id("tags"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const courseTags = await ctx.db
      .query("courseTags")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    const toDelete = courseTags.find((ct) => ct.tagId === args.tagId);
    if (toDelete) {
      await ctx.db.delete(toDelete._id);
    }

    return null;
  },
});

/**
 * Assign course to teams or users.
 * T078: Implement courses.assign mutation
 */
export const assign = mutation({
  args: {
    courseId: v.id("courses"),
    teamIds: v.optional(v.array(v.id("teams"))),
    userIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    const now = Date.now();

    // Assign to teams
    if (args.teamIds) {
      for (const teamId of args.teamIds) {
        // Check if already assigned
        const existing = await ctx.db
          .query("courseAssignments")
          .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
          .collect();

        if (!existing.some((a) => a.teamId === teamId)) {
          await ctx.db.insert("courseAssignments", {
            courseId: args.courseId,
            teamId,
            assignedAt: now,
          });
        }
      }
    }

    // Assign to users
    if (args.userIds) {
      for (const userId of args.userIds) {
        // Check if already assigned
        const existing = await ctx.db
          .query("courseAssignments")
          .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
          .collect();

        if (!existing.some((a) => a.userId === userId)) {
          await ctx.db.insert("courseAssignments", {
            courseId: args.courseId,
            userId,
            assignedAt: now,
          });
        }
      }
    }

    return null;
  },
});

/**
 * Remove course assignment.
 * T078: Implement courses.unassign mutation
 */
export const unassign = mutation({
  args: {
    courseId: v.id("courses"),
    teamId: v.optional(v.id("teams")),
    userId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const assignments = await ctx.db
      .query("courseAssignments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    for (const assignment of assignments) {
      if (args.teamId && assignment.teamId === args.teamId) {
        await ctx.db.delete(assignment._id);
      }
      if (args.userId && assignment.userId === args.userId) {
        await ctx.db.delete(assignment._id);
      }
    }

    return null;
  },
});
