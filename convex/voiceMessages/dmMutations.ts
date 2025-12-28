/**
 * Voice Messages - DM Mutations
 *
 * Mutations for sending voice messages to direct message conversations.
 */

import { v, ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { checkRateLimit } from "../lib/rateLimits";
import { validateAudioFile } from "../lib/transcription";
import { MAX_VOICE_DURATION_SECONDS, validateWaveformData } from "./types";

// Note: internal import removed - auto-transcription disabled for cost savings.
// Transcription is now on-demand via requestTranscription mutation.

// ============================================================================
// T108: Send Voice Message to Conversation (DM)
// ============================================================================

/**
 * Send a voice message to a DM conversation.
 *
 * T108: Implement sendVoiceToConversation mutation for DMs.
 *
 * Similar to sendVoiceToChannel but for direct message conversations.
 *
 * Security: storageId ownership not validated - Convex generates unguessable UUIDs.
 * Risk is LOW (cryptographically random). Files auto-delete after 24h if unused.
 * @see https://docs.convex.dev/file-storage/upload-files
 *
 * @param conversationId - The conversation to send the voice message to.
 * @param storageId - The Convex Storage ID of the uploaded audio file.
 * @param duration - The duration of the audio in seconds.
 * @param fileSize - The size of the audio file in bytes.
 * @param mimeType - The MIME type of the audio file.
 * @param waveformData - Array of amplitude samples for visualization.
 * @returns The ID of the created message.
 */
export const sendVoiceToConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    storageId: v.id("_storage"),
    duration: v.number(),
    fileSize: v.number(),
    mimeType: v.string(),
    waveformData: v.array(v.number()),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify user is a participant in the conversation
    const participation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (!participation) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You are not a participant in this conversation",
      });
    }

    if (participation.leftAt !== undefined) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You have left this conversation",
      });
    }

    // Check rate limit (20 voice messages per hour)
    const rateLimitResult = await checkRateLimit(ctx, user._id, "voice_message");
    if (!rateLimitResult.allowed) {
      const minutesRemaining = Math.ceil(
        (rateLimitResult.resetAt - Date.now()) / 60000
      );
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: `Voice message rate limit exceeded. Please wait ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}`,
        retryAfterMs: rateLimitResult.resetAt - Date.now(),
      });
    }

    // Validate audio file
    const validation = validateAudioFile(args.mimeType, args.fileSize);
    if (!validation.valid) {
      throw new ConvexError({
        code: "INVALID_AUDIO",
        message: validation.error ?? "Invalid audio file",
      });
    }

    // Validate duration
    if (args.duration <= 0) {
      throw new ConvexError({
        code: "INVALID_DURATION",
        message: "Voice message duration must be greater than 0",
      });
    }
    if (args.duration > MAX_VOICE_DURATION_SECONDS) {
      throw new ConvexError({
        code: "DURATION_EXCEEDED",
        message: `Voice message duration exceeds maximum of ${MAX_VOICE_DURATION_SECONDS} seconds`,
      });
    }

    // Validate waveform data
    const waveformValidation = validateWaveformData(args.waveformData);
    if (!waveformValidation.valid) {
      throw new ConvexError({ code: "INVALID_WAVEFORM", message: waveformValidation.error ?? "Invalid waveform data" });
    }

    // Verify conversation exists
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    }

    const now = Date.now();

    // Create the message with contentType: "voice"
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: user._id,
      content: "[Voice Message]", // Placeholder content
      contentType: "voice",
      createdAt: now,
      status: "sent",
    });

    // Create the voiceMessages record
    await ctx.db.insert("voiceMessages", {
      messageId,
      storageId: args.storageId,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      duration: args.duration,
      waveformData: args.waveformData,
      transcriptionStatus: "pending",
      transcriptionEdited: false,
    });

    // Update conversation timestamps
    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      lastMessageAt: now,
    });

    // Mark as read for sender
    await ctx.db.patch(participation._id, {
      lastReadAt: now,
    });

    // Note: Auto-transcription removed for cost savings.
    // Use requestTranscription mutation to transcribe on-demand.

    return messageId;
  },
});
