import { v } from "convex/values";
import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum message length in characters (FR-046).
 */
export const MAX_MESSAGE_LENGTH = 4000;

// ============================================================================
// Validators
// ============================================================================

/**
 * Message with sender information for channel messages.
 * T001-T002: Includes lesson data when message has lessonId.
 */
export const channelMessageWithSenderValidator = v.object({
  _id: v.id("messages"),
  channelId: v.optional(v.id("channels")),
  conversationId: v.optional(v.id("conversations")),
  senderId: v.id("users"),
  sender: v.object({
    _id: v.id("users"),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    status: v.union(
      v.literal("online"),
      v.literal("offline"),
      v.literal("away"),
      v.literal("dnd")
    ),
  }),
  content: v.string(),
  contentType: v.optional(
    v.union(
      v.literal("text"),
      v.literal("voice"),
      v.literal("file"),
      v.literal("system")
    )
  ),
  parentId: v.optional(v.id("messages")),
  threadReplyCount: v.optional(v.number()),
  threadLastReplyAt: v.optional(v.number()),
  lessonId: v.optional(v.id("lessons")),
  // T001-T002: Enriched lesson data (fetched when lessonId exists)
  lesson: v.optional(
    v.object({
      _id: v.id("lessons"),
      title: v.string(),
    })
  ),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
  isEdited: v.optional(v.boolean()),
  deletedAt: v.optional(v.number()),
  reactionCount: v.optional(v.number()),
  status: v.optional(
    v.union(v.literal("sending"), v.literal("sent"), v.literal("failed"))
  ),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract @mentions from message content and store them.
 */
export async function extractAndStoreMentions(
  ctx: MutationCtx,
  messageId: Id<"messages">,
  content: string,
  channelId: Id<"channels">
): Promise<void> {
  const now = Date.now();

  // Check for @everyone
  if (content.includes("@everyone")) {
    await ctx.db.insert("mentions", {
      messageId,
      type: "everyone",
      channelId,
      createdAt: now,
    });
  }

  // Check for @here
  if (content.includes("@here")) {
    await ctx.db.insert("mentions", {
      messageId,
      type: "here",
      channelId,
      createdAt: now,
    });
  }

  // Extract @username mentions (simple pattern: @word)
  const mentionPattern = /@([a-zA-Z0-9_-]+)/g;
  const matches = content.matchAll(mentionPattern);

  for (const match of matches) {
    const username = match[1];
    if (username === "everyone" || username === "here") {
      continue; // Already handled above
    }

    // Try to find user by name or email prefix
    // This is a simplified implementation - in production you might want
    // a more robust username lookup
    const users = await ctx.db
      .query("users")
      .filter((q) =>
        q.or(q.eq(q.field("name"), username), q.eq(q.field("email"), username))
      )
      .take(1);

    const foundUser = users[0];
    if (foundUser) {
      await ctx.db.insert("mentions", {
        messageId,
        type: "user",
        mentionedUserId: foundUser._id,
        channelId,
        createdAt: now,
      });
    }
  }
}
