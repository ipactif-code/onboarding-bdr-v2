/**
 * Voice Messages - Queries
 *
 * Query functions for retrieving voice message data.
 */

import { ConvexError } from "convex/values";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { isChannelMember } from "../lib/permissions";
import { voiceMessageDataValidator } from "./types";

// ============================================================================
// T111: Get Voice Message Query
// ============================================================================

/**
 * Get a voice message with audio URL and transcription status.
 *
 * T111: Implement getVoiceMessage query returning audio URL and transcription status.
 *
 * @param messageId - The ID of the message to get voice data for.
 * @returns The voice message data with audio URL, or null if not found.
 */
export const getVoiceMessage = query({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.union(voiceMessageDataValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get the voice message record
    const voiceMessage = await ctx.db
      .query("voiceMessages")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (!voiceMessage) {
      return null;
    }

    // Get the parent message to verify access
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }

    // Verify user has access to the message's channel or conversation
    if (message.channelId) {
      // Channel message: verify user is an active channel member
      const isMember = await isChannelMember(ctx, message.channelId, user._id);
      if (!isMember) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Not a channel member",
        });
      }
    } else if (message.conversationId) {
      // DM message: verify user is an active conversation participant
      const participation = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", user._id).eq("conversationId", message.conversationId!)
        )
        .unique();

      if (!participation || participation.leftAt !== undefined) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Not a conversation participant",
        });
      }
    } else {
      // Message has neither channelId nor conversationId - invalid state
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Invalid message: missing channel or conversation",
      });
    }

    // Get the audio URL from storage
    const audioUrl = await ctx.storage.getUrl(voiceMessage.storageId);

    return {
      _id: voiceMessage._id,
      messageId: voiceMessage.messageId,
      audioUrl,
      duration: voiceMessage.duration,
      waveformData: voiceMessage.waveformData,
      transcription: voiceMessage.transcription ?? null,
      transcriptionStatus: voiceMessage.transcriptionStatus,
      transcriptionError: voiceMessage.transcriptionError ?? null,
      transcriptionEdited: voiceMessage.transcriptionEdited,
    };
  },
});
