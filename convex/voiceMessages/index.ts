/**
 * Voice Messages Module - Barrel Export
 *
 * Re-exports all public APIs from the voice messages module.
 *
 * Client Usage:
 *   import { api } from "convex/_generated/api";
 *   api.voiceMessages.generateUploadUrl
 *   api.voiceMessages.sendVoiceToChannel
 *   api.voiceMessages.sendVoiceToConversation
 *   api.voiceMessages.getVoiceMessage
 *   api.voiceMessages.editTranscription
 *   api.voiceMessages.retryTranscription
 */

// ============================================================================
// Public Queries
// ============================================================================

export { getVoiceMessage } from "./queries";

// ============================================================================
// Public Mutations - Channel
// ============================================================================

export { generateUploadUrl, sendVoiceToChannel } from "./channelMutations";

// ============================================================================
// Public Mutations - DM
// ============================================================================

export { sendVoiceToConversation } from "./dmMutations";

// ============================================================================
// Public Mutations - Transcription
// ============================================================================

export { editTranscription, requestTranscription, retryTranscription } from "./transcriptionMutations";

// ============================================================================
// Internal Functions (for scheduler)
// Note: These are exported so the scheduler can reference them via:
//   internal.voiceMessages.transcriptionActions.processTranscription
// ============================================================================

// Internal exports are handled by their respective modules directly.
// The scheduler references them via the full path:
//   internal.voiceMessages.transcriptionActions.processTranscription
//   internal.voiceMessages.transcriptionActions.updateTranscriptionProcessing
//   internal.voiceMessages.transcriptionActions.saveTranscriptionSuccess
//   internal.voiceMessages.transcriptionActions.saveTranscriptionFailure
