import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

// ============================================================================
// Course Type Definitions and Validators
// ============================================================================

/**
 * Course progress information.
 */
export interface CourseProgress {
  completedLessons: number;
  totalLessons: number;
  percentage: number;
  lastAccessedLessonId: Id<"lessons"> | undefined;
  lastAccessedAt: number | undefined;
}

/**
 * Tag information.
 */
export interface TagInfo {
  _id: Id<"tags">;
  name: string;
}

/**
 * Course list item with progress.
 */
export interface CourseListItem {
  _id: Id<"courses">;
  title: string;
  description: string | undefined;
  coverImageUrl: string | undefined;
  displayOrder: number;
  tags: TagInfo[];
  progress: CourseProgress;
}

/**
 * Validator for course list item response.
 */
export const courseListItemValidator = v.object({
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
});

/**
 * Validator for admin course list item.
 */
export const adminCourseListItemValidator = v.object({
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
});

/**
 * Validator for lesson progress status.
 */
export const lessonStatusValidator = v.object({
  lessonId: v.id("lessons"),
  status: v.union(
    v.literal("not_started"),
    v.literal("in_progress"),
    v.literal("completed")
  ),
  completedAt: v.optional(v.number()),
});

/**
 * Validator for lesson information in course details.
 */
export const lessonInfoValidator = v.object({
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
});

/**
 * Validator for section with lessons.
 */
export const sectionWithLessonsValidator = v.object({
  _id: v.id("sections"),
  title: v.string(),
  description: v.optional(v.string()),
  displayOrder: v.number(),
  lessons: v.array(lessonInfoValidator),
});
