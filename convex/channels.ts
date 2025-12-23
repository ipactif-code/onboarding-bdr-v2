/**
 * Channels module - re-exports all channel functions.
 *
 * This module is split into:
 * - channels/queries.ts: Channel queries (list, get)
 * - channels/mutations.ts: Channel mutations (create, update, archive, etc.)
 */

// Queries
export { list, get, channelWithMembershipValidator } from "./channels/queries";

// Mutations
export {
  create,
  update,
  archive,
  unarchive,
  join,
  markAllAsRead,
  leave,
} from "./channels/mutations";
