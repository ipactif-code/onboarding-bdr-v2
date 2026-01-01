/**
 * Channel module exports.
 *
 * This module provides all channel-related functionality:
 * - Queries: list, get, getMembers, search, getChannelMembersWithPagination
 * - Mutations: create, update, archive, unarchive, join, leave, markAllAsRead, toggleFavorite
 * - Member management: addMembers, removeMember, updateMemberRole
 * - Moderation: muteMember, unmuteMember, banMember, unbanMember, restoreDeletedMessage
 * - Course channel internal mutations: createCourseChannel, addCourseEnrollee, removeCourseEnrollee, grantCourseInstructorAdmin
 * - Export: exportChannelHistory (action)
 */

// Types
export { channelWithMembershipValidator, memberInfoValidator } from "./types";

// Queries
export { list, get, getMembers, search } from "./queries";

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

// Moderation mutations (mute, ban, restore)
export {
  muteMember,
  unmuteMember,
  banMember,
  unbanMember,
  restoreDeletedMessage,
  getChannelMembersWithPagination,
} from "./moderation";

// Export action (FR-039)
export { exportChannelHistory } from "./exportHistory";
