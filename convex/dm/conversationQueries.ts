import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import {
  participantWithDetailsValidator,
  groupDetailsValidator,
} from "./helpers";

// ============================================================================
// Direct Messages - Conversation Queries
// Phase 4 - User Story 2: Direct Messages
// ============================================================================

/**
 * T042: Find an existing direct conversation between current user and another user.
 * Returns the conversation ID if found, null otherwise.
 */
export const findWithUser = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(v.id("conversations"), v.null()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (args.userId === user._id) {
      throw new Error("Cannot find conversation with yourself");
    }

    // Get all conversation participations for the current user
    const userParticipations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Check each conversation to find a direct one with the target user
    for (const participation of userParticipations) {
      // Skip if user has left
      if (participation.leftAt !== undefined) {
        continue;
      }

      const conversation = await ctx.db.get(participation.conversationId);
      if (!conversation || conversation.type !== "direct") {
        continue;
      }

      // Check if the target user is also in this conversation
      const otherParticipation = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", args.userId).eq("conversationId", conversation._id)
        )
        .unique();

      if (otherParticipation && otherParticipation.leftAt === undefined) {
        return conversation._id;
      }
    }

    return null;
  },
});

/**
 * Get participants of a conversation.
 * Returns active participants with their user details.
 */
export const getParticipants = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.array(participantWithDetailsValidator),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify conversation exists
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Verify current user is a participant
    const userParticipation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (!userParticipation) {
      throw new Error("You are not a participant in this conversation");
    }

    // Get all active participants
    const allParticipants = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const activeParticipants = allParticipants.filter(
      (p) => p.leftAt === undefined
    );

    // Get user details for each participant
    const participantsWithDetails = await Promise.all(
      activeParticipants.map(async (p) => {
        const participantUser = await ctx.db.get(p.userId);
        if (!participantUser) {
          return null;
        }
        return {
          _id: participantUser._id,
          name: participantUser.name,
          email: participantUser.email,
          avatarUrl: participantUser.avatarUrl,
          status: participantUser.status,
          joinedAt: p.joinedAt,
          isCurrentUser: participantUser._id === user._id,
        };
      })
    );

    return participantsWithDetails.filter(
      (p): p is NonNullable<typeof p> => p !== null
    );
  },
});

/**
 * Get group conversation details.
 * Returns the conversation with participant info.
 */
export const getGroupDetails = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.union(groupDetailsValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify conversation exists and is a group
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.type !== "group") {
      return null;
    }

    // Verify current user is a participant
    const userParticipation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (!userParticipation) {
      return null;
    }

    // Count active participants
    const allParticipants = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const activeCount = allParticipants.filter(
      (p) => p.leftAt === undefined
    ).length;

    return {
      _id: conversation._id,
      type: "group" as const,
      name: conversation.name,
      createdAt: conversation.createdAt,
      participantCount: activeCount,
      isActive: conversation.isActive,
    };
  },
});
