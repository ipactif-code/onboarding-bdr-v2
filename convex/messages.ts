import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireAdmin } from "./lib/auth";
import { Id } from "./_generated/dataModel";

// ============================================================================
// Queries
// ============================================================================

/**
 * List all conversations for the current user.
 * T161: Implement messages.listConversations query
 */
export const listConversations = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("conversations"),
      type: v.union(v.literal("direct"), v.literal("broadcast")),
      updatedAt: v.number(),
      participants: v.array(
        v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
          status: v.union(
            v.literal("online"),
            v.literal("offline"),
            v.literal("away")
          ),
        })
      ),
      lastMessage: v.optional(
        v.object({
          content: v.string(),
          senderId: v.id("users"),
          senderName: v.string(),
          createdAt: v.number(),
        })
      ),
      unreadCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get all conversation participations for the user
    const participations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const result = await Promise.all(
      participations.map(async (participation) => {
        const conversation = await ctx.db.get(participation.conversationId);
        if (!conversation) {
          return null;
        }

        // Get all participants
        const allParticipants = await ctx.db
          .query("conversationParticipants")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .collect();

        // Get participant user details (excluding current user for direct messages)
        const participants = await Promise.all(
          allParticipants
            .filter(
              (p) =>
                conversation.type === "broadcast" || p.userId !== user._id
            )
            .map(async (p) => {
              const participantUser = await ctx.db.get(p.userId);
              if (!participantUser) return null;
              return {
                _id: participantUser._id,
                name: participantUser.name,
                avatarUrl: participantUser.avatarUrl,
                status: participantUser.status,
              };
            })
        );

        // Get last message
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation_time", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .order("desc")
          .take(1);

        let lastMessage:
          | {
              content: string;
              senderId: Id<"users">;
              senderName: string;
              createdAt: number;
            }
          | undefined;

        const msg = messages[0];
        if (msg) {
          const sender = await ctx.db.get(msg.senderId);
          lastMessage = {
            content:
              msg.content.length > 100
                ? msg.content.substring(0, 100) + "..."
                : msg.content,
            senderId: msg.senderId,
            senderName: sender?.name ?? "Unknown",
            createdAt: msg.createdAt,
          };
        }

        // Count unread messages
        const lastReadAt = participation.lastReadAt ?? 0;
        const allMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation_time", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .collect();

        const unreadCount = allMessages.filter(
          (m) => m.createdAt > lastReadAt && m.senderId !== user._id
        ).length;

        return {
          _id: conversation._id,
          type: conversation.type,
          updatedAt: conversation.updatedAt,
          participants: participants.filter(
            (p): p is NonNullable<typeof p> => p !== null
          ),
          lastMessage,
          unreadCount,
        };
      })
    );

    // Filter out null values and sort by updatedAt
    return result
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/**
 * Get messages in a conversation.
 * T162: Implement messages.getConversation query
 */
export const getConversation = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  returns: v.object({
    conversation: v.union(
      v.object({
        _id: v.id("conversations"),
        type: v.union(v.literal("direct"), v.literal("broadcast")),
        participants: v.array(
          v.object({
            _id: v.id("users"),
            name: v.string(),
            avatarUrl: v.optional(v.string()),
            status: v.union(
              v.literal("online"),
              v.literal("offline"),
              v.literal("away")
            ),
          })
        ),
      }),
      v.null()
    ),
    messages: v.array(
      v.object({
        _id: v.id("messages"),
        senderId: v.id("users"),
        senderName: v.string(),
        senderAvatarUrl: v.optional(v.string()),
        content: v.string(),
        createdAt: v.number(),
        isOwn: v.boolean(),
      })
    ),
    nextCursor: v.optional(v.number()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const limit = args.limit ?? 50;

    // Verify user is a participant
    const participation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (!participation) {
      return {
        conversation: null,
        messages: [],
        hasMore: false,
      };
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return {
        conversation: null,
        messages: [],
        hasMore: false,
      };
    }

    // Get all participants
    const allParticipants = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const participants = await Promise.all(
      allParticipants
        .filter((p) => conversation.type === "broadcast" || p.userId !== user._id)
        .map(async (p) => {
          const participantUser = await ctx.db.get(p.userId);
          if (!participantUser) return null;
          return {
            _id: participantUser._id,
            name: participantUser.name,
            avatarUrl: participantUser.avatarUrl,
            status: participantUser.status,
          };
        })
    );

    // Get messages with pagination
    let messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_time", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .collect();

    // Apply cursor (timestamp-based pagination)
    if (args.cursor) {
      messages = messages.filter((m) => m.createdAt < args.cursor!);
    }

    const paginatedMessages = messages.slice(0, limit + 1);
    const hasMore = paginatedMessages.length > limit;
    const resultMessages = paginatedMessages.slice(0, limit);

    // Get sender details for each message
    const messagesWithSenders = await Promise.all(
      resultMessages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);
        return {
          _id: msg._id,
          senderId: msg.senderId,
          senderName: sender?.name ?? "Unknown",
          senderAvatarUrl: sender?.avatarUrl,
          content: msg.content,
          createdAt: msg.createdAt,
          isOwn: msg.senderId === user._id,
        };
      })
    );

    // Reverse to get chronological order
    messagesWithSenders.reverse();

    return {
      conversation: {
        _id: conversation._id,
        type: conversation.type,
        participants: participants.filter(
          (p): p is NonNullable<typeof p> => p !== null
        ),
      },
      messages: messagesWithSenders,
      nextCursor: hasMore
        ? resultMessages[resultMessages.length - 1]?.createdAt
        : undefined,
      hasMore,
    };
  },
});

/**
 * Get or create a direct conversation with another user.
 * T163: Implement messages.getOrCreateDirect query
 */
export const getOrCreateDirect = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (args.otherUserId === user._id) {
      throw new Error("Cannot create conversation with yourself");
    }

    // Check if other user exists
    const otherUser = await ctx.db.get(args.otherUserId);
    if (!otherUser) {
      throw new Error("User not found");
    }

    // Look for existing direct conversation between these users
    const userParticipations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const participation of userParticipations) {
      const conversation = await ctx.db.get(participation.conversationId);
      if (!conversation || conversation.type !== "direct") {
        continue;
      }

      // Check if other user is in this conversation
      const otherParticipation = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", args.otherUserId).eq("conversationId", conversation._id)
        )
        .unique();

      if (otherParticipation) {
        // Found existing conversation
        return conversation._id;
      }
    }

    // Create new conversation
    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      type: "direct",
      updatedAt: now,
    });

    // Add both participants
    await ctx.db.insert("conversationParticipants", {
      conversationId,
      userId: user._id,
      joinedAt: now,
    });

    await ctx.db.insert("conversationParticipants", {
      conversationId,
      userId: args.otherUserId,
      joinedAt: now,
    });

    return conversationId;
  },
});

/**
 * Get total unread message count for the current user.
 * T164: Implement messages.getUnreadCount query
 */
export const getUnreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get all conversation participations
    const participations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let totalUnread = 0;

    for (const participation of participations) {
      const lastReadAt = participation.lastReadAt ?? 0;

      // Count messages after lastReadAt that weren't sent by the user
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation_time", (q) =>
          q.eq("conversationId", participation.conversationId)
        )
        .collect();

      const unread = messages.filter(
        (m) => m.createdAt > lastReadAt && m.senderId !== user._id
      ).length;

      totalUnread += unread;
    }

    return totalUnread;
  },
});

/**
 * Search messages across all conversations.
 * T165: Implement messages.search query
 */
export const search = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      conversationId: v.id("conversations"),
      senderId: v.id("users"),
      senderName: v.string(),
      content: v.string(),
      createdAt: v.number(),
      otherParticipant: v.optional(
        v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (!args.searchTerm || args.searchTerm.length < 2) {
      return [];
    }

    const limit = args.limit ?? 20;
    const searchLower = args.searchTerm.toLowerCase();

    // Get user's conversations
    const participations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const conversationIds = new Set(
      participations.map((p) => p.conversationId.toString())
    );

    // Search messages in user's conversations
    const allMessages = await ctx.db.query("messages").collect();

    const matchingMessages = allMessages
      .filter(
        (m) =>
          conversationIds.has(m.conversationId.toString()) &&
          m.content.toLowerCase().includes(searchLower)
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    // Get details for each message
    const result = await Promise.all(
      matchingMessages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);
        const conversation = await ctx.db.get(msg.conversationId);

        let otherParticipant:
          | { _id: Id<"users">; name: string; avatarUrl?: string }
          | undefined;

        if (conversation?.type === "direct") {
          const participants = await ctx.db
            .query("conversationParticipants")
            .withIndex("by_conversation", (q) =>
              q.eq("conversationId", msg.conversationId)
            )
            .collect();

          const other = participants.find((p) => p.userId !== user._id);
          if (other) {
            const otherUser = await ctx.db.get(other.userId);
            if (otherUser) {
              otherParticipant = {
                _id: otherUser._id,
                name: otherUser.name,
                avatarUrl: otherUser.avatarUrl,
              };
            }
          }
        }

        return {
          _id: msg._id,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          senderName: sender?.name ?? "Unknown",
          content: msg.content,
          createdAt: msg.createdAt,
          otherParticipant,
        };
      })
    );

    return result;
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Send a message to a conversation.
 * T166: Implement messages.send mutation
 */
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate content
    if (!args.content.trim()) {
      throw new Error("Message content cannot be empty");
    }

    if (args.content.length > 5000) {
      throw new Error("Message content is too long (max 5000 characters)");
    }

    // Verify user is a participant
    const participation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (!participation) {
      throw new Error("You are not a participant in this conversation");
    }

    const now = Date.now();

    // Create the message
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: user._id,
      content: args.content.trim(),
      createdAt: now,
    });

    // Update conversation timestamp
    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
    });

    // Mark as read for sender
    await ctx.db.patch(participation._id, {
      lastReadAt: now,
    });

    return messageId;
  },
});

/**
 * Send a direct message to a user (creates conversation if needed).
 * T167: Implement messages.sendDirect mutation
 */
export const sendDirect = mutation({
  args: {
    recipientId: v.id("users"),
    content: v.string(),
  },
  returns: v.object({
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (args.recipientId === user._id) {
      throw new Error("Cannot send a message to yourself");
    }

    // Validate content
    if (!args.content.trim()) {
      throw new Error("Message content cannot be empty");
    }

    if (args.content.length > 5000) {
      throw new Error("Message content is too long (max 5000 characters)");
    }

    // Check if recipient exists
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient) {
      throw new Error("Recipient not found");
    }

    // Find or create conversation
    let conversationId: Id<"conversations"> | null = null;

    const userParticipations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const participation of userParticipations) {
      const conversation = await ctx.db.get(participation.conversationId);
      if (!conversation || conversation.type !== "direct") {
        continue;
      }

      const recipientParticipation = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", args.recipientId).eq("conversationId", conversation._id)
        )
        .unique();

      if (recipientParticipation) {
        conversationId = conversation._id;
        break;
      }
    }

    const now = Date.now();

    // Create new conversation if not found
    if (!conversationId) {
      conversationId = await ctx.db.insert("conversations", {
        type: "direct",
        updatedAt: now,
      });

      // Add both participants
      await ctx.db.insert("conversationParticipants", {
        conversationId,
        userId: user._id,
        joinedAt: now,
        lastReadAt: now,
      });

      await ctx.db.insert("conversationParticipants", {
        conversationId,
        userId: args.recipientId,
        joinedAt: now,
      });
    }

    // Create the message
    const messageId = await ctx.db.insert("messages", {
      conversationId,
      senderId: user._id,
      content: args.content.trim(),
      createdAt: now,
    });

    // Update conversation timestamp
    await ctx.db.patch(conversationId, {
      updatedAt: now,
    });

    // Update sender's lastReadAt
    const senderParticipation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", conversationId!)
      )
      .unique();

    if (senderParticipation) {
      await ctx.db.patch(senderParticipation._id, {
        lastReadAt: now,
      });
    }

    return { conversationId, messageId };
  },
});

/**
 * Broadcast a message to all users (admin only).
 * T168: Implement messages.broadcast mutation (admin)
 */
export const broadcast = mutation({
  args: {
    content: v.string(),
    teamId: v.optional(v.id("teams")),
  },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // Validate content
    if (!args.content.trim()) {
      throw new Error("Broadcast content cannot be empty");
    }

    if (args.content.length > 10000) {
      throw new Error("Broadcast content is too long (max 10000 characters)");
    }

    const now = Date.now();

    // Create broadcast conversation
    const conversationId = await ctx.db.insert("conversations", {
      type: "broadcast",
      updatedAt: now,
    });

    // Add admin as participant
    await ctx.db.insert("conversationParticipants", {
      conversationId,
      userId: admin._id,
      joinedAt: now,
      lastReadAt: now,
    });

    // Get target users
    let userIds: Id<"users">[];

    if (args.teamId) {
      // Broadcast to team members
      const teamId = args.teamId;
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect();
      userIds = teamMembers
        .map((m) => m.userId)
        .filter((id) => id !== admin._id);
    } else {
      // Broadcast to all users
      const allUsers = await ctx.db.query("users").collect();
      userIds = allUsers.map((u) => u._id).filter((id) => id !== admin._id);
    }

    // Add all target users as participants
    for (const userId of userIds) {
      await ctx.db.insert("conversationParticipants", {
        conversationId,
        userId,
        joinedAt: now,
      });
    }

    // Create the broadcast message
    await ctx.db.insert("messages", {
      conversationId,
      senderId: admin._id,
      content: args.content.trim(),
      createdAt: now,
    });

    return conversationId;
  },
});

/**
 * Mark messages as read up to a certain point.
 * T169: Implement messages.markRead mutation
 */
export const markRead = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Find user's participation
    const participation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (!participation) {
      return null;
    }

    // Update lastReadAt to current time
    await ctx.db.patch(participation._id, {
      lastReadAt: Date.now(),
    });

    return null;
  },
});
