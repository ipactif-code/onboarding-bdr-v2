/**
 * Channel Message Mutations - Re-exports
 *
 * Split into:
 * - channelSendMutation.ts - Send message to channel
 * - channelEditDeleteMutations.ts - Edit/delete messages
 * - channelReadMutations.ts - Read status management
 */

// Send mutation
export { sendToChannel } from "./channelSendMutation";

// Edit/delete mutations
export { editChannelMessage, deleteChannelMessage } from "./channelEditDeleteMutations";

// Read status mutations
export { markChannelAsRead } from "./channelReadMutations";
