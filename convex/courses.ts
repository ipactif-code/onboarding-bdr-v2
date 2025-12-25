/**
 * Course Module - Main Entry Point
 *
 * Re-exports all course functionality from the modular structure.
 * This file exists for backwards compatibility with the Convex API
 * where frontend code uses `api.courses.functionName`.
 *
 * The implementation is split into:
 * - courses/listQueries.ts - List queries (listForUser, list)
 * - courses/detailQueries.ts - Detail queries (get, getWithProgress)
 * - courses/crudMutations.ts - CRUD mutations (create, update, setCoverImage, remove)
 * - courses/publishMutations.ts - Publish mutations (publish, unpublish, reorder)
 * - courses/tagMutations.ts - Tag mutations (addTag, removeTag)
 * - courses/assignmentMutations.ts - Assignment mutations (incrementViewCount, assign, unassign)
 */

// List queries
export { listForUser, list } from "./courses/listQueries";

// Detail queries
export { get, getWithProgress } from "./courses/detailQueries";

// CRUD mutations
export { create, update, setCoverImage, remove } from "./courses/crudMutations";

// Publish mutations
export { publish, unpublish, reorder } from "./courses/publishMutations";

// Tag mutations
export { addTag, removeTag } from "./courses/tagMutations";

// Assignment mutations
export { incrementViewCount, assign, unassign } from "./courses/assignmentMutations";
