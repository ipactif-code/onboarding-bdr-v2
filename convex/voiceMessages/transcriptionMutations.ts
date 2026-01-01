/**
 * Voice Messages - Transcription Mutations
 *
 * Public mutations for editing and retrying transcriptions.
 */

import { v, ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { requireAuth, requireChannelMember } from "../lib/auth";
import { MAX_VOICE_DURATION_SECONDS } from "./types";

// Type workaround: Use require() to avoid TS2589. See types.ts for explanation.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { internal } = require("../_generated/api") as { internal: any };

/**
 * Edit the transcription of a voice message (T112).
 * Only the sender can edit. Original transcription is preserved.
 */
export const editTranscription = mutation({
  args: {
    messageId: v.id("messages"),
    transcription: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Message not found" });
    }
    if (message.senderId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the sender can edit the transcription" });
    }
    if (message.deletedAt) {
      throw new ConvexError({ code: "DELETED", message: "Cannot edit transcription of a deleted message" });
    }

    const voiceMessage = await ctx.db
      .query("voiceMessages")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (!voiceMessage) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Voice message data not found" });
    }
    if (voiceMessage.transcriptionStatus !== "completed") {
      throw new ConvexError({ code: "INVALID_STATE", message: "Cannot edit transcription that is not completed" });
    }

    const trimmedTranscription = args.transcription.trim();
    if (trimmedTranscription.length === 0) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Transcription cannot be empty" });
    }
    if (trimmedTranscription.length > 10000) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Transcription is too long (max 10000 characters)" });
    }

    // Save original transcription if this is the first edit
    const updates: {
      transcription: string;
      transcriptionEdited: boolean;
      originalTranscription?: string;
    } = {
      transcription: trimmedTranscription,
      transcriptionEdited: true,
    };

    if (!voiceMessage.transcriptionEdited && voiceMessage.transcription) {
      updates.originalTranscription = voiceMessage.transcription;
    }

    await ctx.db.patch(voiceMessage._id, updates);

    // Update message content preview
    const preview = trimmedTranscription.length > 100
      ? trimmedTranscription.substring(0, 100) + "..."
      : trimmedTranscription;
    await ctx.db.patch(args.messageId, {
      content: `[Voice Message] ${preview}`,
      isEdited: true,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Request transcription for a voice message (on-demand).
 * Any channel member or conversation participant can request transcription.
 * This enables cost savings by only transcribing when needed.
 */
export const requestTranscription = mutation({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Message not found" });
    }
    if (message.deletedAt) {
      throw new ConvexError({ code: "DELETED", message: "Cannot transcribe a deleted message" });
    }

    // Verify user is a member of the channel or conversation participant
    if (!message.channelId && !message.conversationId) {
      throw new ConvexError({ code: "INVALID_STATE", message: "Voice message must belong to a channel or conversation" });
    }

    let user: Doc<"users">;
    if (message.channelId) {
      // Channel message: verify channel membership
      user = await requireChannelMember(ctx, message.channelId);
    } else {
      // DM message: verify conversation participation
      const authenticatedUser = await requireAuth(ctx);
      const participation = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", authenticatedUser._id).eq("conversationId", message.conversationId!)
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
      user = authenticatedUser;
    }

    const voiceMessage = await ctx.db
      .query("voiceMessages")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (!voiceMessage) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Voice message not found" });
    }

    // Don't re-transcribe if already completed or in progress
    if (voiceMessage.transcriptionStatus === "completed") {
      return null; // Already done
    }
    if (voiceMessage.transcriptionStatus === "processing") {
      return null; // Already in progress
    }

    // Validate duration is within limits before transcribing
    if (voiceMessage.duration > MAX_VOICE_DURATION_SECONDS) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: `Voice message duration exceeds maximum (${MAX_VOICE_DURATION_SECONDS}s)`,
      });
    }
    if (voiceMessage.duration <= 0) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Voice message has invalid duration",
      });
    }

    // Set status to pending and schedule transcription
    await ctx.db.patch(voiceMessage._id, {
      transcriptionStatus: "pending",
      transcriptionError: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.voiceMessages.transcriptionActions.processTranscription, {
      messageId: args.messageId,
      userId: user._id,
    });

    return null;
  },
});

/**
 * Retry a failed transcription (T113).
 * Only the sender can retry. Resets state and schedules new processing.
 */
export const retryTranscription = mutation({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Message not found" });
    }
    if (message.senderId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the sender can retry transcription" });
    }
    if (message.deletedAt) {
      throw new ConvexError({ code: "DELETED", message: "Cannot retry transcription of a deleted message" });
    }

    const voiceMessage = await ctx.db
      .query("voiceMessages")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (!voiceMessage) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Voice message data not found" });
    }
    if (voiceMessage.transcriptionStatus !== "failed") {
      throw new ConvexError({ code: "INVALID_STATE", message: "Can only retry failed transcriptions" });
    }

    // Validate duration is within limits before retrying
    if (voiceMessage.duration > MAX_VOICE_DURATION_SECONDS) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: `Voice message duration exceeds maximum (${MAX_VOICE_DURATION_SECONDS}s)`,
      });
    }
    if (voiceMessage.duration <= 0) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Voice message has invalid duration",
      });
    }

    // Reset transcription state
    await ctx.db.patch(voiceMessage._id, {
      transcriptionStatus: "pending",
      transcriptionError: undefined,
    });

    // Schedule transcription processing
    await ctx.scheduler.runAfter(0, internal.voiceMessages.transcriptionActions.processTranscription, {
      messageId: args.messageId,
      userId: user._id,
    });

    return null;
  },
});
