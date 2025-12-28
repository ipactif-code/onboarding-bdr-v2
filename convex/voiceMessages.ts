/**
 * Voice Messages Module - Barrel Export
 *
 * Re-exports all public APIs from the voice messages module.
 * This root-level file is required for Convex to register functions at:
 * - api.voiceMessages.generateUploadUrl
 * - api.voiceMessages.sendVoiceToChannel
 * - api.voiceMessages.sendVoiceToConversation
 * - api.voiceMessages.getVoiceMessage
 * - api.voiceMessages.editTranscription
 * - api.voiceMessages.retryTranscription
 * - api.voiceMessages.requestTranscription
 *
 * This module is split into:
 * - voiceMessages/queries.ts: Voice message queries
 * - voiceMessages/channelMutations.ts: Channel voice message mutations
 * - voiceMessages/dmMutations.ts: DM voice message mutations
 * - voiceMessages/transcriptionMutations.ts: Transcription editing mutations
 * - voiceMessages/transcriptionActions.ts: Internal transcription actions
 * - voiceMessages/helpers.ts: Shared utilities and validators
 * - voiceMessages/types.ts: Type definitions and validators
 */

// Public Queries
export { getVoiceMessage } from "./voiceMessages/queries";

// Public Mutations - Channel
export { generateUploadUrl, sendVoiceToChannel } from "./voiceMessages/channelMutations";

// Public Mutations - DM
export { sendVoiceToConversation } from "./voiceMessages/dmMutations";

// Public Mutations - Transcription
export { editTranscription, retryTranscription, requestTranscription } from "./voiceMessages/transcriptionMutations";
