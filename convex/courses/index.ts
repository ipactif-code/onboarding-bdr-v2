/**
 * Course module exports.
 *
 * This module provides all course-related functionality:
 * - Queries: listForUser, list, get, getWithProgress
 * - CRUD Mutations: create, update, setCoverImage, remove
 * - Publish Mutations: publish, unpublish, reorder
 * - Tag Mutations: addTag, removeTag
 * - Assignment Mutations: incrementViewCount, assign, unassign
 */

// Types and validators
export {
  courseListItemValidator,
  adminCourseListItemValidator,
  lessonStatusValidator,
  lessonInfoValidator,
  sectionWithLessonsValidator,
} from "./types";
export type {
  CourseProgress,
  TagInfo,
  CourseListItem,
} from "./types";

// Helper functions (for internal use)
export { checkCourseAccess, getCoverImageUrl } from "./helpers";
export { buildCourseListResponse } from "./queryHelpers";

// List queries
export { listForUser, list } from "./listQueries";

// Detail queries
export { get, getWithProgress } from "./detailQueries";

// CRUD mutations
export { create, update, setCoverImage, remove } from "./crudMutations";

// Publish mutations
export { publish, unpublish, reorder } from "./publishMutations";

// Tag mutations
export { addTag, removeTag } from "./tagMutations";

// Assignment mutations
export { incrementViewCount, assign, unassign } from "./assignmentMutations";
