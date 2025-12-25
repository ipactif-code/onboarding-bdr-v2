import { QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getCoverImageUrl } from "./helpers";
import { CourseListItem } from "./types";

// ============================================================================
// Query Helper Functions
// ============================================================================

/**
 * Build course list response with progress data.
 * Extracted to avoid duplication between admin and user paths.
 */
export async function buildCourseListResponse(
  ctx: QueryCtx,
  courses: Doc<"courses">[],
  user: Doc<"users">
): Promise<CourseListItem[]> {
  // Pre-fetch all data needed for all courses to avoid N+1 queries
  const courseIds = courses.map((c) => c._id);

  // Fetch all course tags, sections, and user progress in parallel
  const [allCourseTags, allTags, allSections, userProgress] = await Promise.all(
    [
      ctx.db.query("courseTags").collect(),
      ctx.db.query("tags").collect(),
      ctx.db.query("sections").collect(),
      ctx.db
        .query("progress")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
    ]
  );

  // Fetch all lessons for relevant sections
  const relevantSectionIds = new Set(
    allSections
      .filter((s) => courseIds.some((cId) => cId === s.courseId))
      .map((s) => s._id.toString())
  );

  const allLessons = await ctx.db.query("lessons").collect();
  const relevantLessons = allLessons.filter((l) =>
    relevantSectionIds.has(l.sectionId.toString())
  );

  // Build lookup maps
  const tagsById = new Map(allTags.map((t) => [t._id.toString(), t]));
  const courseTagsByCourse = new Map<string, typeof allCourseTags>();
  for (const ct of allCourseTags) {
    const key = ct.courseId.toString();
    if (!courseTagsByCourse.has(key)) {
      courseTagsByCourse.set(key, []);
    }
    courseTagsByCourse.get(key)!.push(ct);
  }

  const sectionsByCourse = new Map<string, typeof allSections>();
  for (const section of allSections) {
    const key = section.courseId.toString();
    if (!sectionsByCourse.has(key)) {
      sectionsByCourse.set(key, []);
    }
    sectionsByCourse.get(key)!.push(section);
  }

  const lessonsBySection = new Map<string, typeof relevantLessons>();
  for (const lesson of relevantLessons) {
    const key = lesson.sectionId.toString();
    if (!lessonsBySection.has(key)) {
      lessonsBySection.set(key, []);
    }
    lessonsBySection.get(key)!.push(lesson);
  }

  const progressByLesson = new Map(
    userProgress.map((p) => [p.lessonId.toString(), p])
  );

  // Build response for each course
  return Promise.all(
    courses.map(async (course) => {
      const coverImageUrl = await getCoverImageUrl(ctx, course.coverImageId);

      // Get tags from pre-fetched data
      const courseTags = courseTagsByCourse.get(course._id.toString()) ?? [];
      const tags = courseTags
        .map((ct) => {
          const tag = tagsById.get(ct.tagId.toString());
          return tag ? { _id: tag._id, name: tag.name } : null;
        })
        .filter((t): t is { _id: Id<"tags">; name: string } => t !== null);

      // Get sections and lessons from pre-fetched data
      const sections = sectionsByCourse.get(course._id.toString()) ?? [];
      let totalLessons = 0;
      const allLessonIds: Id<"lessons">[] = [];

      for (const section of sections) {
        const lessons = lessonsBySection.get(section._id.toString()) ?? [];
        totalLessons += lessons.length;
        allLessonIds.push(...lessons.map((l) => l._id));
      }

      // Calculate progress from pre-fetched data
      let completedLessons = 0;
      let lastAccessedLessonId: Id<"lessons"> | undefined;
      let lastAccessedAt: number | undefined;

      for (const lessonId of allLessonIds) {
        const progress = progressByLesson.get(lessonId.toString());
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
        tags,
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
}
