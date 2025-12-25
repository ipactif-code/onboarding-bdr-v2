/**
 * Channel module exports.
 *
 * This module provides all channel-related functionality:
 * - Queries: list, get, getMembers
 * - Mutations: create, update, archive, unarchive, join, leave, markAllAsRead, toggleFavorite
 * - Member management: addMembers, removeMember, updateMemberRole
 * - Course channel internal mutations: createCourseChannel, addCourseEnrollee, removeCourseEnrollee, grantCourseInstructorAdmin
 */

// Types
export { channelWithMembershipValidator, memberInfoValidator } from "./types";

// Queries
export { list, get, getMembers } from "./queries";

// Channel CRUD mutations
export {
  create,
  update,
  archive,
  unarchive,
  join,
  leave,
  markAllAsRead,
  toggleFavorite,
} from "./mutations";

// Member management mutations
export { addMembers, removeMember, updateMemberRole } from "./memberManagement";

// Course channel internal mutations (called when courses are published/users assigned)
export {
  createCourseChannel,
  addCourseEnrollee,
  removeCourseEnrollee,
  grantCourseInstructorAdmin,
} from "./courseMutations";
