import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// Re-export queries for backward compatibility
export { getMessageReactions, getReactionUserNames } from "./reactionQueries";

// ============================================================================
// Emoji Validation
// ============================================================================

/**
 * Validates that a string is a valid Unicode emoji.
 *
 * Uses a basic check that covers common emoji:
 * - Single emoji characters and sequences
 * - Emoji with skin tone modifiers
 * - Emoji with ZWJ (Zero Width Joiner) sequences
 *
 * @param emoji - The string to validate
 * @returns true if the string is a valid emoji, false otherwise
 */
function isValidEmoji(emoji: string): boolean {
  // Must be between 1 and 20 characters (allows for complex emoji with modifiers/ZWJ)
  if (emoji.length === 0 || emoji.length > 20) {
    return false;
  }

  // Basic validation: check if string contains only emoji-like characters
  // This covers most common emoji including:
  // - Basic emoji (emoticons, symbols, etc.)
  // - Emoji with variation selectors (U+FE0F)
  // - Emoji with skin tone modifiers (U+1F3FB-1F3FF)
  // - ZWJ sequences (U+200D)
  // - Regional indicator symbols (U+1F1E6-1F1FF)

  // Check that string doesn't contain regular ASCII text characters
  const hasTextChars = /[a-zA-Z0-9\x00-\x1F\x7F]/.test(emoji);
  if (hasTextChars) {
    return false;
  }

  // Check for common emoji Unicode ranges using code points
  const codePoints = [...emoji];
  if (codePoints.length === 0) {
    return false;
  }

  // At least one character should be in an emoji range
  const hasEmojiChar = codePoints.some((char) => {
    const code = char.codePointAt(0);
    if (code === undefined) return false;

    // Common emoji ranges
    return (
      (code >= 0x1f300 && code <= 0x1f9ff) || // Miscellaneous Symbols and Pictographs, Emoticons, etc.
      (code >= 0x2600 && code <= 0x26ff) || // Miscellaneous Symbols
      (code >= 0x2700 && code <= 0x27bf) || // Dingbats
      (code >= 0x1f600 && code <= 0x1f64f) || // Emoticons
      (code >= 0x1f680 && code <= 0x1f6ff) || // Transport and Map Symbols
      (code >= 0x1f1e0 && code <= 0x1f1ff) || // Regional Indicator Symbols
      code === 0x200d || // Zero Width Joiner
      code === 0xfe0f || // Variation Selector-16
      (code >= 0x1f3fb && code <= 0x1f3ff) || // Skin Tone Modifiers
      (code >= 0x231a && code <= 0x23ff) || // Misc Technical
      (code >= 0x2b05 && code <= 0x2b55) || // Arrows and other symbols
      (code >= 0x1fa70 && code <= 0x1faff) // Symbols and Pictographs Extended-A
    );
  });

  return hasEmojiChar;
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Add a reaction to a message.
 *
 * If the user has already reacted with this emoji, returns the existing reaction ID.
 * Otherwise, creates a new reaction and increments the message's reactionCount.
 *
 * @param messageId - The message to react to
 * @param emoji - The Unicode emoji character to use as the reaction
 * @returns The reaction document ID
 */
export const addReaction = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  returns: v.id("reactions"),
  handler: async (ctx, args) => {

    const user = await requireAuth(ctx);

    // Validate emoji is a valid Unicode emoji
    const isValid = isValidEmoji(args.emoji);

    if (!isValid) {
      console.error("[addReaction] Invalid emoji rejected:", args.emoji, "codePoints:", [...args.emoji].map(c => c.codePointAt(0)?.toString(16)));
      throw new Error("Invalid emoji: Must be a valid Unicode emoji character");
    }

    // Verify message exists
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Check if message is deleted
    if (message.deletedAt) {
      throw new Error("Cannot react to a deleted message");
    }

    // Security: Verify user has access to the channel (if channel message)
    if (message.channelId) {
      const membership = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", message.channelId!).eq("userId", user._id)
        )
        .first();

      if (!membership || membership.leftAt || membership.isBanned) {
        throw new Error("Not authorized to react in this channel");
      }
    }

    // Security: Verify user is a participant in conversation (if DM message)
    if (message.conversationId) {
      const participant = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", user._id).eq("conversationId", message.conversationId!)
        )
        .first();

      if (!participant || participant.leftAt) {
        throw new Error("Not authorized to react in this conversation");
      }
    }

    // Check if user already reacted with this emoji (upsert behavior)
    const existingReaction = await ctx.db
      .query("reactions")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", args.messageId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("emoji"), args.emoji))
      .unique();

    if (existingReaction) {
      // User already reacted with this emoji - return existing reaction ID
      return existingReaction._id;
    }

    // Create new reaction
    const reactionId = await ctx.db.insert("reactions", {
      messageId: args.messageId,
      userId: user._id,
      emoji: args.emoji,
      createdAt: Date.now(),
    });

    // Increment message's reactionCount (denormalized counter)
    const currentCount = message.reactionCount ?? 0;
    await ctx.db.patch(args.messageId, {
      reactionCount: currentCount + 1,
    });

    return reactionId;
  },
});

/**
 * Remove a reaction from a message.
 *
 * Only the user who created the reaction can remove it.
 * Decrements the message's reactionCount when successful.
 *
 * @param messageId - The message to remove the reaction from
 * @param emoji - The emoji reaction to remove
 * @returns null on success
 */
export const removeReaction = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify message exists and user has access
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Security: Verify user has access to the channel (if channel message)
    if (message.channelId) {
      const membership = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", message.channelId!).eq("userId", user._id)
        )
        .first();

      if (!membership || membership.leftAt || membership.isBanned) {
        throw new Error("Not authorized to remove reaction from this channel");
      }
    }

    // Security: Verify user is a participant in conversation (if DM message)
    if (message.conversationId) {
      const participant = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", user._id).eq("conversationId", message.conversationId!)
        )
        .first();

      if (!participant || participant.leftAt) {
        throw new Error("Not authorized to remove reaction from this conversation");
      }
    }

    // Find the user's reaction with this emoji
    const reaction = await ctx.db
      .query("reactions")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", args.messageId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("emoji"), args.emoji))
      .unique();

    if (!reaction) {
      throw new Error("Reaction not found");
    }

    // Delete the reaction
    await ctx.db.delete(reaction._id);

    // Decrement message's reactionCount (message already verified above)
    const currentCount = message.reactionCount ?? 0;
    await ctx.db.patch(args.messageId, {
      reactionCount: Math.max(0, currentCount - 1),
    });

    return null;
  },
});
