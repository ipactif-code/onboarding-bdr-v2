import { v, Infer } from "convex/values";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getCurrentUser } from "../lib/auth";

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
 * Validator for grouped reaction data attached to messages.
 * Matches the structure returned by reactions.getMessageReactions.
 */
export const messageReactionValidator = v.object({
  emoji: v.string(),
  count: v.number(),
  userIds: v.array(v.id("users")),
  currentUserReacted: v.boolean(),
});

/**
 * Message with sender information for channel messages.
 * T001-T002: Includes lesson data when message has lessonId.
 * T097b: Includes optional reactions array for displaying reaction badges.
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
  // T097b: Grouped reactions array (optional for backwards compatibility)
  reactions: v.optional(v.array(messageReactionValidator)),
  status: v.optional(
    v.union(v.literal("sending"), v.literal("sent"), v.literal("failed"))
  ),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract @mentions from message content and store them.
 *
 * Handles three types of mentions:
 * - @everyone: Notifies all channel members (stored with type: "everyone")
 *   SECURITY: Only admins can use @everyone mentions
 * - @here: Notifies online channel members only (stored with type: "here")
 * - @username: Notifies a specific user (stored with type: "user")
 *
 * T100a: This function stores mentions in the database for later processing.
 * Real-time notifications should be triggered after mentions are stored.
 *
 * @param ctx - Mutation context
 * @param messageId - The message containing the mentions
 * @param content - The message content to parse for mentions
 * @param channelId - The channel where the message was sent
 * @param senderId - The ID of the user sending the message (for permission checks)
 */
export async function extractAndStoreMentions(
  ctx: MutationCtx,
  messageId: Id<"messages">,
  content: string,
  channelId: Id<"channels">,
  senderId?: Id<"users">
): Promise<void> {
  const now = Date.now();

  // ============================================================================
  // @everyone mention - notifies ALL channel members
  // SECURITY: Only admins can use @everyone mentions
  // ============================================================================
  if (content.includes("@everyone")) {
    // Admin authorization check - prevent non-admins from spamming all members
    if (senderId) {
      const sender = await ctx.db.get(senderId);
      if (!sender || sender.role !== "admin") {
        throw new Error("Only admins can use @everyone mentions");
      }
    }

    await ctx.db.insert("mentions", {
      messageId,
      type: "everyone",
      channelId,
      createdAt: now,
    });

    // TODO [T100a - Notifications]: Trigger real-time notification to all channel members
    // Implementation steps when adding notifications:
    // 1. Query channel members via channelMembers table using channelId
    // 2. For each member, create a notification record or push to notification queue
    // 3. Consider using ctx.scheduler.runAfter() for async notification dispatch
    // 4. Handle notification preferences (muted channels, DND status)
  }

  // ============================================================================
  // @here mention - notifies only ONLINE channel members
  // ============================================================================
  if (content.includes("@here")) {
    await ctx.db.insert("mentions", {
      messageId,
      type: "here",
      channelId,
      createdAt: now,
    });

    // TODO [T100a - Notifications]: Trigger real-time notification to online members only
    // Implementation steps when adding notifications:
    // 1. Query channel members via channelMembers table using channelId
    // 2. Filter members where user.status === "online" (exclude "offline", "away", "dnd")
    // 3. For each online member, create a notification record
    // 4. Consider using ctx.scheduler.runAfter() for async notification dispatch
  }

  // ============================================================================
  // @username mentions - notifies specific users
  // ============================================================================
  const mentionPattern = /@([a-zA-Z0-9_-]+)/g;
  const matches = content.matchAll(mentionPattern);

  for (const match of matches) {
    const username = match[1];
    if (username === "everyone" || username === "here") {
      continue; // Already handled above
    }

    // Try to find user by name or email prefix
    // NOTE: This uses .filter() because user lookup by arbitrary name is not indexed.
    // For high-volume systems, consider adding a "username" field with a dedicated index.
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

      // TODO [T100a - Notifications]: Trigger real-time notification to mentioned user
      // Implementation steps when adding notifications:
      // 1. Check if foundUser.status allows notifications (not "dnd")
      // 2. Check if user has muted this channel
      // 3. Create notification record with message preview
      // 4. Consider using ctx.scheduler.runAfter() for async notification dispatch
      // 5. Push notification payload includes: messageId, channelId, senderName, preview
    }
  }

  // ============================================================================
  // Notification Architecture Notes (for future implementation)
  // ============================================================================
  // When implementing real-time notifications for mentions:
  //
  // 1. NOTIFICATION TABLE SCHEMA:
  //    - userId: Id<"users"> (recipient)
  //    - type: "mention" | "dm" | "thread_reply" | etc.
  //    - messageId: Id<"messages">
  //    - channelId: Id<"channels">
  //    - read: boolean
  //    - createdAt: number
  //
  // 2. REAL-TIME DELIVERY OPTIONS:
  //    a) Convex subscriptions: Client subscribes to notifications query
  //    b) Push notifications: Use ctx.scheduler to call external push service
  //    c) Email digest: Batch unread notifications for email delivery
  //
  // 3. RATE LIMITING:
  //    - Deduplicate rapid mentions of same user
  //    - Batch @everyone/@here notifications to avoid spam
  //    - Respect user notification preferences
  //
  // 4. PERMISSION CHECKS:
  //    - Verify sender has permission to mention in channel
  //    - Verify mentioned users are channel members (for DM prevention)
}

// ============================================================================
// Reaction Helpers
// ============================================================================

/** Type for grouped reaction data */
export type GroupedReaction = Infer<typeof messageReactionValidator>;

/**
 * Get grouped reactions for a single message.
 *
 * Groups reactions by emoji and includes count, user IDs, and whether
 * the current user has reacted with each emoji.
 *
 * @param ctx - Query context
 * @param messageId - The message to get reactions for
 * @returns Array of grouped reactions sorted by count descending
 */
export async function getReactionsForMessage(
  ctx: QueryCtx,
  messageId: Id<"messages">
): Promise<GroupedReaction[]> {
  const currentUser = await getCurrentUser(ctx);

  // Get all reactions for this message using the by_message index
  const reactions = await ctx.db
    .query("reactions")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
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
}

/**
 * Batch fetch reactions for multiple messages in parallel.
 *
 * Uses Promise.all for efficient parallel fetching to avoid N+1 queries.
 *
 * @param ctx - Query context
 * @param messageIds - Array of message IDs to fetch reactions for
 * @returns Map of messageId to grouped reactions array
 */
export async function getReactionsForMessages(
  ctx: QueryCtx,
  messageIds: Id<"messages">[]
): Promise<Map<string, GroupedReaction[]>> {
  const reactionsMap = new Map<string, GroupedReaction[]>();

  // Fetch reactions for all messages in parallel
  const results = await Promise.all(
    messageIds.map(async (messageId) => ({
      messageId,
      reactions: await getReactionsForMessage(ctx, messageId),
    }))
  );

  for (const { messageId, reactions } of results) {
    reactionsMap.set(messageId.toString(), reactions);
  }

  return reactionsMap;
}
