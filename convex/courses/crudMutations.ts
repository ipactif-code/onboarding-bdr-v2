/**
 * Course CRUD Mutations - Re-exports
 *
 * Split into:
 * - createUpdateMutations.ts - Create, update, setCoverImage
 * - removeMutation.ts - Remove course
 */

export { create, update, setCoverImage } from "./createUpdateMutations";
export { remove } from "./removeMutation";
