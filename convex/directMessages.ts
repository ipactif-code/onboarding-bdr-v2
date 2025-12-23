/**
 * Direct Messages module - re-exports all DM functions.
 *
 * This module is split into:
 * - dm/conversationQueries.ts: findWithUser, getParticipants, getGroupDetails
 * - dm/searchQueries.ts: searchUsers
 * - dm/groupMutations.ts: createGroup, addParticipant
 * - dm/participantMutations.ts: leaveGroup, updateGroupName, hide
 * - dm/helpers.ts: Shared validators and constants
 */

// Conversation queries
export {
  findWithUser,
  getParticipants,
  getGroupDetails,
} from "./dm/conversationQueries";

// Search queries
export { searchUsers } from "./dm/searchQueries";

// Group mutations
export { createGroup, addParticipant } from "./dm/groupMutations";

// Participant mutations
export { leaveGroup, updateGroupName, hide, toggleFavorite } from "./dm/participantMutations";

// Helpers (for use by other modules)
export {
  MAX_GROUP_PARTICIPANTS,
  MIN_GROUP_PARTICIPANTS,
  MAX_GROUP_NAME_LENGTH,
  userStatusValidator,
  participantWithDetailsValidator,
  searchUserResultValidator,
  groupDetailsValidator,
} from "./dm/helpers";
