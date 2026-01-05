import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import {
  MAX_GROUP_PARTICIPANTS,
  MIN_GROUP_PARTICIPANTS,
  // MAX_GROUP_NAME_LENGTH is defined but reserved for future group name validation
} from "./helpers";

// ============================================================================
// Direct Messages - Group DM Mutations
// Phase 4 - User Story 2: Direct Messages
// ============================================================================

/**
 * T039: Create a group DM with 2-8 participants.
 * Creates a new group conversation with the specified participants.
 * FR-008: Group DM size limited to 2-8 participants total.
 */
export const createGroup = mutation({
  args: {
    participantIds: v.array(v.id("users")),
    name: v.optional(v.string()),
  },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate participant count (min 2 excluding creator, max 8 total including creator)
    if (args.participantIds.length < MIN_GROUP_PARTICIPANTS) {
      throw new Error(
        "Group DM requires at least 2 other participants besides yourself"
      );
    }

    // Total participants = creator + participantIds
    const totalParticipants = args.participantIds.length + 1;
    if (totalParticipants > MAX_GROUP_PARTICIPANTS) {
      throw new Error(
        `Group DM cannot have more than ${MAX_GROUP_PARTICIPANTS} participants`
      );
    }

    // Validate that creator is not in the participant list
    if (args.participantIds.includes(user._id)) {
      throw new Error("You cannot add yourself as a participant");
    }

    // Validate all participants exist
    const uniqueParticipantIds = Array.from(new Set(args.participantIds));
    if (uniqueParticipantIds.length !== args.participantIds.length) {
      throw new Error("Duplicate participants are not allowed");
    }

    for (const participantId of uniqueParticipantIds) {
      const participant = await ctx.db.get(participantId);
      if (!participant) {
        throw new Error(`User with ID ${participantId} not found`);
      }
    }

    const now = Date.now();

    // Create the group conversation
    const conversationId = await ctx.db.insert("conversations", {
      type: "group",
      name: args.name,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });

    // Add creator as first participant
    await ctx.db.insert("conversationParticipants", {
      conversationId,
      userId: user._id,
      joinedAt: now,
      lastReadAt: now,
    });

    // Add all other participants
    for (const participantId of uniqueParticipantIds) {
      await ctx.db.insert("conversationParticipants", {
        conversationId,
        userId: participantId,
        joinedAt: now,
        addedBy: user._id,
      });
    }

    return conversationId;
  },
});

/**
 * T055: Add a user to an existing group DM.
 * Only existing participants can add new members.
 * Maximum 8 participants allowed.
 */
export const addParticipant = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
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
      throw new Error("Can only add participants to group conversations");
    }

    // Verify current user is an active participant
    const userParticipation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (!userParticipation || userParticipation.leftAt !== undefined) {
      throw new Error("You are not an active participant in this conversation");
    }

    // Verify the user to add exists
    const userToAdd = await ctx.db.get(args.userId);
    if (!userToAdd) {
      throw new Error("User to add not found");
    }

    // Check if user is already a participant
    const existingParticipation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .unique();

    if (existingParticipation) {
      if (existingParticipation.leftAt === undefined) {
        throw new Error("User is already a participant in this conversation");
      }
      // User previously left - rejoin them
      await ctx.db.patch(existingParticipation._id, {
        leftAt: undefined,
        joinedAt: Date.now(),
        addedBy: user._id,
      });
      return null;
    }

    // Count current active participants
    const allParticipants = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const activeParticipants = allParticipants.filter(
      (p) => p.leftAt === undefined
    );

    if (activeParticipants.length >= MAX_GROUP_PARTICIPANTS) {
      throw new Error(
        `Group DM cannot have more than ${MAX_GROUP_PARTICIPANTS} participants`
      );
    }

    // Add the new participant
    const now = Date.now();
    await ctx.db.insert("conversationParticipants", {
      conversationId: args.conversationId,
      userId: args.userId,
      joinedAt: now,
      addedBy: user._id,
    });

    // Update conversation timestamp
    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
    });

    return null;
  },
});
