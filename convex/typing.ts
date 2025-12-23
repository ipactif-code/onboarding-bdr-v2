import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// ============================================================================
// Typing Indicators
// Ephemeral typing state for conversations (DMs and group chats)
// ============================================================================

/** Typing indicator expiry time in milliseconds (3 seconds) */
const TYPING_EXPIRY_MS = 3000;

/** Minimum interval between typing updates in milliseconds (1 second) */
const MIN_UPDATE_INTERVAL_MS = 1000;

/**
 * Set typing indicator for current user in a conversation.
 * T048: FR-009a - Upserts into typingIndicators table with 3-second expiry.
 *
 * @remarks
 * This mutation should be called periodically while the user is typing
 * (e.g., every 2 seconds) to keep the indicator active.
 */
export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
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
      throw new Error(
        "Forbidden: You must be a participant to set typing indicator"
      );
    }

    // Check if user has left the conversation
    if (participation.leftAt) {
      throw new Error(
        "Forbidden: Cannot set typing indicator in a conversation you have left"
      );
    }

    const now = Date.now();
    const expiresAt = now + TYPING_EXPIRY_MS;

    // Check for existing typing indicator (upsert)
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id)
      )
      .unique();

    if (existing) {
      // Rate limiting: Calculate time since last update
      const lastUpdateTime = existing.expiresAt - TYPING_EXPIRY_MS;
      const timeSinceLastUpdate = now - lastUpdateTime;

      if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL_MS) {
        // Silently ignore - rate limited to prevent DoS
        return null;
      }

      // Update expiry time
      await ctx.db.patch(existing._id, { expiresAt });
    } else {
      // Create new typing indicator
      await ctx.db.insert("typingIndicators", {
        conversationId: args.conversationId,
        userId: user._id,
        expiresAt,
      });
    }

    return null;
  },
});

/**
 * Clear typing indicator for current user in a conversation.
 * T049: Deletes the typing indicator record when user stops typing.
 *
 * @remarks
 * This should be called when:
 * - User sends the message
 * - User clears the input field
 * - User navigates away from the conversation
 */
export const clearTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Find and delete the typing indicator
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});

/**
 * Get all users currently typing in a conversation.
 * T050: Returns array of typing users, filtering out expired indicators and current user.
 *
 * @remarks
 * - Filters out indicators where expiresAt < Date.now()
 * - Excludes the current user from results
 * - Returns user details for display (name, avatar)
 */
export const getTypingIndicators = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      userName: v.string(),
      userAvatarUrl: v.optional(v.string()),
    })
  ),
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
      // User is not a participant, return empty array
      return [];
    }

    const now = Date.now();

    // Get all typing indicators for this conversation
    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    // Filter out expired indicators and current user
    const activeIndicators = indicators.filter(
      (indicator) => indicator.expiresAt > now && indicator.userId !== user._id
    );

    // Get user details for each active indicator
    const typingUsers = await Promise.all(
      activeIndicators.map(async (indicator) => {
        const typingUser = await ctx.db.get(indicator.userId);
        if (!typingUser) {
          return null;
        }
        return {
          userId: typingUser._id,
          userName: typingUser.name,
          userAvatarUrl: typingUser.avatarUrl,
        };
      })
    );

    // Filter out null values (users that no longer exist)
    return typingUsers.filter(
      (u): u is NonNullable<typeof u> => u !== null
    );
  },
});
