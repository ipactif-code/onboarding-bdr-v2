import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { requireAuth } from "../lib/auth";
import { checkCourseAccess, getCoverImageUrl } from "./helpers";
import { sectionWithLessonsValidator, lessonStatusValidator } from "./types";

// ============================================================================
// Course Get With Progress Query
// ============================================================================

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
      sections: v.array(sectionWithLessonsValidator),
      publishedAt: v.optional(v.number()),
      _creationTime: v.number(),
      userProgress: v.object({
        completedLessons: v.number(),
        totalLessons: v.number(),
        percentage: v.number(),
        lessonStatuses: v.array(lessonStatusValidator),
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
