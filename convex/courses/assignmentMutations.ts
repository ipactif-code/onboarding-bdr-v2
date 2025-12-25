/**
 * Course Assignment Mutations - Re-exports
 *
 * Split into:
 * - viewCountMutation.ts - Increment view count
 * - assignMutation.ts - Assign course to teams/users
 * - unassignMutation.ts - Remove course assignment
 */

export { incrementViewCount } from "./viewCountMutation";
export { assign } from "./assignMutation";
export { unassign } from "./unassignMutation";
