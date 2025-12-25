/**
 * Messages module - re-exports all messaging functions.
 *
 * This module is split into:
 * - messages/channelQueries.ts: Channel message queries
 * - messages/channelMutations.ts: Channel message mutations
 * - messages/conversationQueries.ts: Conversation queries
 * - messages/conversationMutations.ts: Conversation mutations
 * - messages/search.ts: Message search functionality
 * - messages/helpers.ts: Shared utilities and validators
 */

// Channel messaging queries
export {
  listByChannel,
  getChannelMessage,
  getLessonDiscussion,
} from "./messages/channelQueries";

// Channel messaging mutations
export {
  sendToChannel,
  editChannelMessage,
  deleteChannelMessage,
  markChannelAsRead,
} from "./messages/channelMutations";

// Conversation queries
export {
  listConversations,
  getConversation,
  getUnreadCount,
} from "./messages/conversationQueries";

// Conversation mutations
export {
  getOrCreateDirect,
  send,
  sendDirect,
  broadcast,
  markRead,
} from "./messages/conversationMutations";

// Search
export { searchMessages } from "./messages/search";

// Helpers (for use by other modules)
export {
  MAX_MESSAGE_LENGTH,
  channelMessageWithSenderValidator,
  extractAndStoreMentions,
} from "./messages/helpers";
