import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getCurrentUser } from "./lib/auth";

// ============================================================================
// Reaction Queries
// ============================================================================

/**
 * Validator for grouped reaction response.
 */
const groupedReactionValidator = v.object({
  emoji: v.string(),
  count: v.number(),
  userIds: v.array(v.id("users")),
  currentUserReacted: v.boolean(),
});

/**
 * Get all reactions for a message, grouped by emoji.
 *
 * Returns an array of reaction groups, each containing:
 * - emoji: The emoji character
 * - count: Number of users who reacted with this emoji
 * - userIds: Array of user IDs who reacted with this emoji
 * - currentUserReacted: Whether the current user has reacted with this emoji
 *
 * @param messageId - The message to get reactions for
 * @returns Array of grouped reactions
 */
export const getMessageReactions = query({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.array(groupedReactionValidator),
  handler: async (ctx, args) => {
    // Get current user (optional - reactions are viewable to anyone who can see the message)
    const currentUser = await getCurrentUser(ctx);

    // Verify message exists
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return [];
    }

    // Get all reactions for this message using the by_message index
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    // Group reactions by emoji
    const emojiGroups = new Map<
      string,
      {
        emoji: string;
        userIds: Id<"users">[];
        currentUserReacted: boolean;
      }
    >();

    for (const reaction of reactions) {
      const existing = emojiGroups.get(reaction.emoji);

      if (existing) {
        existing.userIds.push(reaction.userId);
        if (currentUser && reaction.userId === currentUser._id) {
          existing.currentUserReacted = true;
        }
      } else {
        emojiGroups.set(reaction.emoji, {
          emoji: reaction.emoji,
          userIds: [reaction.userId],
          currentUserReacted: currentUser
            ? reaction.userId === currentUser._id
            : false,
        });
      }
    }

    // Convert to array with count
    const result = Array.from(emojiGroups.values()).map((group) => ({
      emoji: group.emoji,
      count: group.userIds.length,
      userIds: group.userIds,
      currentUserReacted: group.currentUserReacted,
    }));

    // Sort by count descending, then by emoji for consistency
    result.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.emoji.localeCompare(b.emoji);
    });

    return result;
  },
});

/**
 * Get user names for a list of user IDs.
 * Used by the reaction bar to display names in tooltips.
 *
 * @param userIds - Array of user IDs to fetch names for
 * @returns Map of userId to user name
 */
export const getReactionUserNames = query({
  args: {
    userIds: v.array(v.id("users")),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // No auth required - reaction user names are public to message viewers
    const results: { userId: Id<"users">; name: string }[] = [];

    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);
      if (user) {
        results.push({
          userId: user._id,
          name: user.name,
        });
      }
    }

    return results;
  },
});
