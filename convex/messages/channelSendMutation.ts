import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireChannelMember } from "../lib/auth";
import { checkRateLimit } from "../lib/rateLimits";
import { MAX_MESSAGE_LENGTH, extractAndStoreMentions } from "./helpers";

// Type workaround: Use dynamic import pattern to avoid TS2589 deep type instantiation
// The internalApi variable is typed as 'any' which breaks the deep type chain
// This is necessary because Convex's internal API generates very deep types
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
const internalApi: any = require("../_generated/api").internal;

// ============================================================================
// Channel Message Send Mutation
// ============================================================================

/**
 * Send a text message to a channel.
 *
 * FR-010: Rich text formatting support (content is stored as JSON string)
 * FR-044: Rate limit of 30 messages per minute per user
 * FR-046: 4000 character max message length
 * T161: Support for file attachments via attachmentIds (legacy Convex storage)
 * T-UploadThing: Support for attachments via UploadThing URLs
 *
 * T023: Create messages.sendToChannel mutation
 */
export const sendToChannel = mutation({
  args: {
    channelId: v.id("channels"),
    content: v.string(),
    parentId: v.optional(v.id("messages")),
    lessonId: v.optional(v.id("lessons")),
    // Legacy: attachment IDs from Convex storage
    attachmentIds: v.optional(v.array(v.id("messageAttachments"))),
    // New: attachment data from UploadThing
    attachments: v.optional(
      v.array(
        v.object({
          url: v.string(),
          name: v.string(),
          size: v.number(),
          type: v.string(),
        })
      )
    ),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    // Require channel membership
    const user = await requireChannelMember(ctx, args.channelId);

    // Check if user is muted in the channel
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    if (membership?.isMuted) {
      // Check if mute has expired
      if (membership.mutedUntil && membership.mutedUntil > Date.now()) {
        // Log detailed info for debugging (visible in Convex dashboard)
        console.error(`User ${user._id} muted until ${membership.mutedUntil}`);

        // Return user-friendly relative time
        const minutesRemaining = Math.ceil(
          (membership.mutedUntil - Date.now()) / 60000
        );
        throw new Error(
          `You are muted in this channel for ${minutesRemaining} more minute${minutesRemaining !== 1 ? "s" : ""}`
        );
      } else if (membership.mutedUntil === undefined) {
        throw new Error("You are muted in this channel");
      }
      // Mute has expired - clear it
      await ctx.db.patch(membership._id, {
        isMuted: false,
        mutedUntil: undefined,
      });
    }

    // Check rate limit (FR-044: 30 messages per minute)
    const rateLimitResult = await checkRateLimit(ctx, user._id, "text_message");
    if (!rateLimitResult.allowed) {
      // Log detailed info for debugging (visible in Convex dashboard)
      console.error(
        `Rate limit for user ${user._id}, resets at ${rateLimitResult.resetAt}`
      );

      // Return user-friendly relative time
      const secondsRemaining = Math.ceil(
        (rateLimitResult.resetAt - Date.now()) / 1000
      );
      throw new Error(
        `Rate limit exceeded. Please wait ${secondsRemaining} second${secondsRemaining !== 1 ? "s" : ""}`
      );
    }

    // Validate content length (FR-046: 4000 chars max)
    if (args.content.length === 0) {
      throw new Error("Message content cannot be empty");
    }
    if (args.content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(
        `Message content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`
      );
    }

    // Get the channel
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    if (channel.isArchived) {
      throw new Error("Cannot send messages to an archived channel");
    }

    // T008: Determine lessonId - inherit from parent if not explicitly provided
    let lessonId = args.lessonId;
    let parentMessage = null;

    // Validate parent message if provided (for threading)
    if (args.parentId) {
      parentMessage = await ctx.db.get(args.parentId);
      if (!parentMessage) {
        throw new Error("Parent message not found");
      }
      if (parentMessage.channelId !== args.channelId) {
        throw new Error("Parent message must be in the same channel");
      }
      if (parentMessage.deletedAt) {
        throw new Error("Cannot reply to a deleted message");
      }

      // T008: Inherit lessonId from parent if not explicitly provided
      if (lessonId === undefined && parentMessage.lessonId) {
        lessonId = parentMessage.lessonId;
      }
    }

    // Validate lesson if provided (either explicit or inherited)
    if (lessonId) {
      const lesson = await ctx.db.get(lessonId);
      if (!lesson) {
        throw new Error("Lesson not found");
      }
    }

    const now = Date.now();

    // Create the message
    const messageId = await ctx.db.insert("messages", {
      channelId: args.channelId,
      senderId: user._id,
      content: args.content,
      contentType: "text",
      parentId: args.parentId,
      lessonId,
      createdAt: now,
      status: "sent",
      reactionCount: 0,
      threadReplyCount: args.parentId ? undefined : 0,
    });

    // Update parent message thread count if this is a reply
    // T008: Reuse already-fetched parentMessage (if available)
    if (args.parentId && parentMessage) {
      await ctx.db.patch(args.parentId, {
        threadReplyCount: (parentMessage.threadReplyCount ?? 0) + 1,
        threadLastReplyAt: now,
      });
    }

    // Update channel's lastMessageAt
    await ctx.db.patch(args.channelId, {
      lastMessageAt: now,
    });

    // Extract and store mentions (pass user._id for @everyone admin check)
    await extractAndStoreMentions(ctx, messageId, args.content, args.channelId, user._id);

    // T161: Link attachments to the message if provided (legacy Convex storage)
    if (args.attachmentIds && args.attachmentIds.length > 0) {
      for (const attachmentId of args.attachmentIds) {
        const attachment = await ctx.db.get(attachmentId);
        if (!attachment) {
          throw new Error(`Attachment not found: ${attachmentId}`);
        }

        // Only link attachments that aren't already linked to a message
        // This prevents stealing attachments from other messages
        if (attachment.messageId) {
          throw new Error(
            `Attachment ${attachmentId} is already linked to a message`
          );
        }

        await ctx.db.patch(attachmentId, {
          messageId,
        });
      }
    }

    // T-UploadThing: Create attachments from UploadThing data
    if (args.attachments && args.attachments.length > 0) {
      for (const attachment of args.attachments) {
        await ctx.db.insert("messageAttachments", {
          messageId,
          downloadUrl: attachment.url, // Store UploadThing URL directly
          fileName: attachment.name,
          fileSize: attachment.size,
          fileType: attachment.type,
          uploadedAt: Date.now(),
          // storageId is NOT set - we're using external URL from UploadThing
        });
      }
    }

    // T069: Notify instructors for lesson-specific questions in course channels
    // Only trigger when:
    // 1. Channel type is "course"
    // 2. Message has a lessonId (lesson-specific question)
    // 3. Sender is not an instructor themselves
    if (channel.type === "course" && args.lessonId && channel.courseId) {
      // Check if sender is an instructor
      const senderIsInstructor = await ctx.db
        .query("channelAdmins")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", args.channelId).eq("userId", user._id)
        )
        .unique();

      // Only notify if sender is not a course instructor
      if (
        !senderIsInstructor ||
        senderIsInstructor.reason !== "course_instructor"
      ) {
        await ctx.scheduler.runAfter(
          0,
          internalApi.channels.courseMutations.notifyInstructors,
          {
            channelId: args.channelId,
            courseId: channel.courseId,
            messageId,
            senderId: user._id,
          }
        );
      }
    }

    return messageId;
  },
});
