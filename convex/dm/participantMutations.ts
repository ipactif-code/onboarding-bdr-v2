import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { MAX_GROUP_NAME_LENGTH } from "./helpers";

// ============================================================================
// Direct Messages - Participant & Conversation Mutations
// Phase 4 - User Story 2: Direct Messages
// ============================================================================

/**
 * T056: Leave a group DM conversation.
 * Sets leftAt timestamp on the participant record (soft leave).
 * Only works for group conversations.
 */
export const leaveGroup = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify conversation exists and is a group
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.type !== "group") {
      throw new Error("Can only leave group conversations");
    }

    // Find user's participation
    const participation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (!participation) {
      throw new Error("You are not a participant in this conversation");
    }

    if (participation.leftAt !== undefined) {
      throw new Error("You have already left this conversation");
    }

    // Set leftAt timestamp (soft leave)
    await ctx.db.patch(participation._id, {
      leftAt: Date.now(),
    });

    return null;
  },
});

/**
 * T057: Update the name of a group DM.
 * Only active participants can update the name.
 */
export const updateGroupName = mutation({
  args: {
    conversationId: v.id("conversations"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate name
    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Group name cannot be empty");
    }

    if (trimmedName.length > MAX_GROUP_NAME_LENGTH) {
      throw new Error(
        `Group name cannot exceed ${MAX_GROUP_NAME_LENGTH} characters`
      );
    }

    // Verify conversation exists and is a group
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.type !== "group") {
      throw new Error("Can only rename group conversations");
    }

    // Verify current user is an active participant
    const participation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (!participation || participation.leftAt !== undefined) {
      throw new Error("You are not an active participant in this conversation");
    }

    // Update the group name
    await ctx.db.patch(args.conversationId, {
      name: trimmedName,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * T058: Hide a conversation from user's list (soft hide).
 * This is implemented by setting leftAt on the participation record.
 * The user can still rejoin if added back or if they start a new conversation.
 * Note: For a true "hide" feature without leaving, the schema would need a hiddenAt field.
 * This implementation uses leftAt as a soft-hide mechanism.
 */
export const hide = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify conversation exists
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Find user's participation
    const participation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (!participation) {
      throw new Error("You are not a participant in this conversation");
    }

    if (participation.leftAt !== undefined) {
      // Already hidden/left
      return null;
    }

    // For direct conversations, we use leftAt as a "hide" mechanism
    // For group conversations, this is the same as leaving
    // The user can be re-added or the conversation recreated
    await ctx.db.patch(participation._id, {
      leftAt: Date.now(),
    });

    return null;
  },
});

/**
 * Toggle favorite status for a conversation.
 * User must be a participant in the conversation.
 * Returns the new favorite state.
 */
export const toggleFavorite = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify conversation exists
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Find user's participation
    const participation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (!participation) {
      throw new Error("You are not a participant in this conversation");
    }

    if (participation.leftAt !== undefined) {
      throw new Error("You have left this conversation");
    }

    // Toggle the isFavorite state
    const newFavoriteState = !(participation.isFavorite ?? false);

    await ctx.db.patch(participation._id, {
      isFavorite: newFavoriteState,
    });

    return newFavoriteState;
  },
});
