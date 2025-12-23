import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAuth, requireAdmin } from "../lib/auth";
import { Id } from "../_generated/dataModel";

// ============================================================================
// Conversation Mutations
// ============================================================================

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
