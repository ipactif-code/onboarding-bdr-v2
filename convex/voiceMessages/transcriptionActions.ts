/**
 * Voice Messages - Transcription Actions
 *
 * Internal actions and mutations for processing transcriptions.
 */

import { v } from "convex/values";
import { internalMutation, internalAction } from "../_generated/server";
import { transcribeAudio } from "../lib/transcription";
import { trackTranscriptionUsage } from "./helpers";
import { voiceMessageInfoValidator } from "./types";

// Type workaround: Use require() to avoid TS2589. See types.ts for explanation.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { internal } = require("../_generated/api") as { internal: any };

// ============================================================================
// Internal Mutations for Transcription Processing
// ============================================================================

/**
 * Internal mutation to update transcription status to processing.
 */
export const updateTranscriptionProcessing = internalMutation({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.union(voiceMessageInfoValidator, v.null()),
  handler: async (ctx, args) => {
    // Get the voice message record
    const voiceMessage = await ctx.db
      .query("voiceMessages")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (!voiceMessage) {
      console.error(`Voice message not found for message ${args.messageId}`);
      return null;
    }

    // Update status to processing
    await ctx.db.patch(voiceMessage._id, {
      transcriptionStatus: "processing",
    });

    return {
      voiceMessageId: voiceMessage._id,
      storageId: voiceMessage.storageId,
      mimeType: voiceMessage.mimeType,
      duration: voiceMessage.duration,
    };
  },
});

/**
 * Internal mutation to save successful transcription result.
 */
export const saveTranscriptionSuccess = internalMutation({
  args: {
    voiceMessageId: v.id("voiceMessages"),
    messageId: v.id("messages"),
    transcription: v.string(),
    userId: v.id("users"),
    durationSeconds: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Update voice message with transcription
    await ctx.db.patch(args.voiceMessageId, {
      transcription: args.transcription,
      transcriptionStatus: "completed",
      transcriptionCompletedAt: now,
    });

    // Update the message content with transcription preview
    const preview = args.transcription.length > 100
      ? args.transcription.substring(0, 100) + "..."
      : args.transcription;
    await ctx.db.patch(args.messageId, {
      content: `[Voice Message] ${preview}`,
    });

    // Track transcription usage for cost control
    await trackTranscriptionUsage(ctx, args.userId, args.durationSeconds);

    return null;
  },
});

/**
 * Internal mutation to save failed transcription result.
 */
export const saveTranscriptionFailure = internalMutation({
  args: {
    voiceMessageId: v.id("voiceMessages"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.voiceMessageId, {
      transcriptionStatus: "failed",
      transcriptionError: args.error,
    });

    return null;
  },
});

// ============================================================================
// T110: Process Transcription (Internal Action)
// ============================================================================

/**
 * Process voice message transcription using OpenAI Whisper.
 *
 * T110: Implement processTranscription internal action that calls Whisper API.
 *
 * This action:
 * 1. Gets the audio URL from Convex Storage
 * 2. Calls OpenAI Whisper API
 * 3. Updates the voiceMessages record with the result
 * 4. Tracks transcription usage for cost control
 */
export const processTranscription = internalAction({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Update status to processing and get voice message info
    const voiceMessageInfo = await ctx.runMutation(
      internal.voiceMessages.transcriptionActions.updateTranscriptionProcessing,
      { messageId: args.messageId }
    );

    if (!voiceMessageInfo) {
      return null;
    }

    const { voiceMessageId, storageId, mimeType, duration } = voiceMessageInfo;

    // Get the audio URL from Convex Storage
    const audioUrl = await ctx.storage.getUrl(storageId);
    if (!audioUrl) {
      await ctx.runMutation(internal.voiceMessages.transcriptionActions.saveTranscriptionFailure, {
        voiceMessageId,
        error: "Failed to get audio URL from storage",
      });
      return null;
    }

    // Call OpenAI Whisper API
    const result = await transcribeAudio(audioUrl, mimeType);

    if (result.success && result.text) {
      // Save successful transcription
      await ctx.runMutation(internal.voiceMessages.transcriptionActions.saveTranscriptionSuccess, {
        voiceMessageId,
        messageId: args.messageId,
        transcription: result.text,
        userId: args.userId,
        durationSeconds: result.duration ?? duration,
      });
    } else {
      // Save failure
      await ctx.runMutation(internal.voiceMessages.transcriptionActions.saveTranscriptionFailure, {
        voiceMessageId,
        error: result.error ?? "Unknown transcription error",
      });
    }

    return null;
  },
});
