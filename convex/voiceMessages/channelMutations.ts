/**
 * Voice Messages - Channel Mutations
 *
 * Mutations for sending voice messages to channels.
 */

import { v, ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAuth, requireChannelMember } from "../lib/auth";
import { checkRateLimit } from "../lib/rateLimits";
import { validateAudioFile } from "../lib/transcription";
import { MAX_VOICE_DURATION_SECONDS, validateWaveformData } from "./types";

// Note: internal import removed - auto-transcription disabled for cost savings.
// Transcription is now on-demand via requestTranscription mutation.

/**
 * Generate an upload URL for voice message audio files (T106).
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Send a voice message to a channel (T107).
 * Validates membership, rate limits, audio file, and schedules transcription.
 *
 * Security: storageId ownership not validated - Convex generates unguessable UUIDs.
 * Risk is LOW (cryptographically random). Files auto-delete after 24h if unused.
 * @see https://docs.convex.dev/file-storage/upload-files
 */
export const sendVoiceToChannel = mutation({
  args: {
    channelId: v.id("channels"),
    storageId: v.id("_storage"),
    duration: v.number(),
    fileSize: v.number(),
    mimeType: v.string(),
    waveformData: v.array(v.number()),
    parentId: v.optional(v.id("messages")),
    lessonId: v.optional(v.id("lessons")),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const user = await requireChannelMember(ctx, args.channelId);

    // Check if user is muted in the channel
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    if (membership?.isMuted) {
      if (membership.mutedUntil && membership.mutedUntil > Date.now()) {
        const minutesRemaining = Math.ceil((membership.mutedUntil - Date.now()) / 60000);
        throw new ConvexError({
          code: "MUTED",
          message: `You are muted in this channel for ${minutesRemaining} more minute${minutesRemaining !== 1 ? "s" : ""}`,
        });
      } else if (membership.mutedUntil === undefined) {
        throw new ConvexError({ code: "MUTED", message: "You are muted in this channel" });
      }
      await ctx.db.patch(membership._id, { isMuted: false, mutedUntil: undefined });
    }

    // Check rate limit (20 voice messages per hour)
    const rateLimitResult = await checkRateLimit(ctx, user._id, "voice_message");
    if (!rateLimitResult.allowed) {
      const minutesRemaining = Math.ceil((rateLimitResult.resetAt - Date.now()) / 60000);
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: `Voice message rate limit exceeded. Please wait ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}`,
        retryAfterMs: rateLimitResult.resetAt - Date.now(),
      });
    }

    // Validate audio file
    const validation = validateAudioFile(args.mimeType, args.fileSize);
    if (!validation.valid) {
      throw new ConvexError({ code: "INVALID_AUDIO", message: validation.error ?? "Invalid audio file" });
    }

    // Validate duration
    if (args.duration <= 0) {
      throw new ConvexError({ code: "INVALID_DURATION", message: "Voice message duration must be greater than 0" });
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

    // Get and validate the channel
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Channel not found" });
    }
    if (channel.isArchived) {
      throw new ConvexError({ code: "CHANNEL_ARCHIVED", message: "Cannot send messages to an archived channel" });
    }

    // Determine lessonId - inherit from parent if not explicitly provided
    let lessonId = args.lessonId;
    let parentMessage = null;

    if (args.parentId) {
      parentMessage = await ctx.db.get(args.parentId);
      if (!parentMessage) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Parent message not found" });
      }
      if (parentMessage.channelId !== args.channelId) {
        throw new ConvexError({ code: "INVALID_PARENT", message: "Parent message must be in the same channel" });
      }
      if (parentMessage.deletedAt) {
        throw new ConvexError({ code: "PARENT_DELETED", message: "Cannot reply to a deleted message" });
      }
      if (lessonId === undefined && parentMessage.lessonId) {
        lessonId = parentMessage.lessonId;
      }
    }

    if (lessonId) {
      const lesson = await ctx.db.get(lessonId);
      if (!lesson) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Lesson not found" });
      }
    }

    const now = Date.now();

    // Create the message with contentType: "voice"
    const messageId = await ctx.db.insert("messages", {
      channelId: args.channelId,
      senderId: user._id,
      content: "[Voice Message]",
      contentType: "voice",
      parentId: args.parentId,
      lessonId,
      createdAt: now,
      status: "sent",
      reactionCount: 0,
      threadReplyCount: args.parentId ? undefined : 0,
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

    // Update parent message thread count if this is a reply
    if (args.parentId && parentMessage) {
      await ctx.db.patch(args.parentId, {
        threadReplyCount: (parentMessage.threadReplyCount ?? 0) + 1,
        threadLastReplyAt: now,
      });
    }

    // Update channel's lastMessageAt
    await ctx.db.patch(args.channelId, { lastMessageAt: now });

    // Note: Auto-transcription removed for cost savings.
    // Use requestTranscription mutation to transcribe on-demand.

    return messageId;
  },
});
