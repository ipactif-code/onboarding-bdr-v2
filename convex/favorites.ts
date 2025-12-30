import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// ============================================================================
// Favorites - Unified favorites list query
// ============================================================================

/**
 * Validator for a favorite item in the list.
 */
const favoriteItemValidator = v.object({
  type: v.union(v.literal("channel"), v.literal("dm")),
  id: v.string(),
  name: v.string(),
  avatarUrl: v.optional(v.string()),
  isPrivate: v.optional(v.boolean()),
  unreadCount: v.optional(v.number()),
  status: v.optional(
    v.union(
      v.literal("online"),
      v.literal("offline"),
      v.literal("away"),
      v.literal("dnd")
    )
  ),
});

/**
 * List all favorited channels and DM conversations for the current user.
 * Returns a combined, sorted list of favorites.
 */
export const list = query({
  args: {},
  returns: v.array(favoriteItemValidator),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const favorites: Array<{
      type: "channel" | "dm";
      id: string;
      name: string;
      avatarUrl?: string;
      isPrivate?: boolean;
      unreadCount?: number;
      status?: "online" | "offline" | "away" | "dnd";
    }> = [];

    // 1. Query favorited channels using by_user_favorite index
    const favoriteChannelMemberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_user_favorite", (q) =>
        q.eq("userId", user._id).eq("isFavorite", true)
      )
      .collect();

    // Process each favorite channel
    for (const membership of favoriteChannelMemberships) {
      // Skip if user has left or is banned
      if (membership.leftAt || membership.isBanned) {
        continue;
      }

      const channel = await ctx.db.get(membership.channelId);
      if (!channel || channel.isArchived) {
        continue;
      }

      // Calculate unread count
      let unreadCount = 0;
      const lastReadAt = membership.lastReadAt ?? 0;
      const lastMessageAt = channel.lastMessageAt ?? 0;

      if (lastMessageAt > lastReadAt) {
        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_channel_time", (q) =>
            q.eq("channelId", channel._id).gt("createdAt", lastReadAt)
          )
          .collect();
        // Exclude thread replies from channel unread count
        unreadCount = unreadMessages.filter((m) => !m.deletedAt && m.senderId !== user._id && !m.parentId).length;
      }

      favorites.push({
        type: "channel",
        id: channel._id,
        name: channel.name,
        isPrivate: channel.type === "private",
        unreadCount,
      });
    }

    // 2. Query favorited conversations using by_user_favorite index
    const favoriteConversationParticipants = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_favorite", (q) =>
        q.eq("userId", user._id).eq("isFavorite", true)
      )
      .collect();

    // Process each favorite conversation
    for (const participation of favoriteConversationParticipants) {
      // Skip if user has left
      if (participation.leftAt !== undefined) {
        continue;
      }

      const conversation = await ctx.db.get(participation.conversationId);
      if (!conversation) {
        continue;
      }

      // For DMs, get the other participant's info
      let name: string;
      let avatarUrl: string | undefined;
      let status: "online" | "offline" | "away" | "dnd" | undefined;

      if (conversation.type === "direct") {
        // Find the other participant
        const participants = await ctx.db
          .query("conversationParticipants")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .collect();

        const otherParticipant = participants.find(
          (p) => p.userId !== user._id && p.leftAt === undefined
        );

        if (otherParticipant) {
          const otherUser = await ctx.db.get(otherParticipant.userId);
          if (otherUser) {
            name = otherUser.name;
            avatarUrl = otherUser.avatarUrl;
            status = otherUser.status;
          } else {
            name = "Unknown User";
          }
        } else {
          name = "Unknown User";
        }
      } else if (conversation.type === "group") {
        // For group DMs, use the group name or generate from participants
        if (conversation.name) {
          name = conversation.name;
        } else {
          // Generate name from participants (excluding current user)
          const participants = await ctx.db
            .query("conversationParticipants")
            .withIndex("by_conversation", (q) =>
              q.eq("conversationId", conversation._id)
            )
            .collect();

          const otherParticipantNames: string[] = [];
          for (const p of participants) {
            if (p.userId !== user._id && p.leftAt === undefined) {
              const otherUser = await ctx.db.get(p.userId);
              if (otherUser) {
                otherParticipantNames.push(otherUser.name);
              }
            }
          }

          name =
            otherParticipantNames.length > 0
              ? otherParticipantNames.slice(0, 3).join(", ") +
                (otherParticipantNames.length > 3
                  ? ` +${otherParticipantNames.length - 3}`
                  : "")
              : "Group";
        }
      } else {
        // Broadcast or other types - skip
        continue;
      }

      // Calculate unread count for DMs - always calculate, no guard condition
      const lastReadAt = participation.lastReadAt ?? 0;
      const allMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation_time", (q) =>
          q.eq("conversationId", conversation._id)
        )
        .collect();

      // Exclude thread replies from DM unread count
      const unreadCount = allMessages.filter(
        (m) => m.createdAt > lastReadAt && !m.deletedAt && m.senderId !== user._id && !m.parentId
      ).length;

      favorites.push({
        type: "dm",
        id: conversation._id,
        name,
        avatarUrl,
        unreadCount,
        status,
      });
    }

    // 3. Sort by name alphabetically
    favorites.sort((a, b) => a.name.localeCompare(b.name));

    return favorites;
  },
});
