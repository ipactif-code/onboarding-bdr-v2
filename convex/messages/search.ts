import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { requireAuth } from "../lib/auth";

// ============================================================================
// Search Result Validators
// ============================================================================

/**
 * Validator for search result item.
 */
const searchResultValidator = v.object({
  _id: v.id("messages"),
  content: v.string(),
  senderId: v.id("users"),
  senderName: v.string(),
  senderAvatarUrl: v.optional(v.string()),
  channelId: v.optional(v.id("channels")),
  channelName: v.optional(v.string()),
  conversationId: v.optional(v.id("conversations")),
  createdAt: v.number(),
  contentType: v.string(),
});

/**
 * Validator for search response with pagination.
 */
const searchResponseValidator = v.object({
  results: v.array(searchResultValidator),
  nextCursor: v.optional(v.string()),
  hasMore: v.boolean(),
  totalEstimate: v.optional(v.number()),
});

/**
 * Validator for search history item.
 */
const searchHistoryItemValidator = v.object({
  query: v.string(),
  resultCount: v.number(),
  timestamp: v.number(),
});

// ============================================================================
// Search Queries
// ============================================================================

/**
 * Search messages across all accessible channels and conversations.
 * T123.2: Implement searchMessages query with filters.
 * T124.1-T124.3: Access control - user can only search messages they have access to.
 * T125.1-T125.4: Filters for channelId, senderId, dateRange, contentType.
 * FR-025, FR-027: Message search requirements.
 *
 * Uses Convex search index for full-text search with optional filters.
 * Access control is applied post-search to ensure users only see messages
 * from channels/conversations they have access to.
 */
export const searchMessages = query({
  args: {
    query: v.string(),
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
    senderId: v.optional(v.id("users")),
    contentType: v.optional(
      v.union(v.literal("text"), v.literal("voice"), v.literal("file"))
    ),
    dateRange: v.optional(
      v.object({
        start: v.number(),
        end: v.number(),
      })
    ),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: searchResponseValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate search query
    const searchQuery = args.query.trim();

    // Minimum length check
    if (searchQuery.length < 2) {
      return {
        results: [],
        hasMore: false,
      };
    }

    // Maximum length check (prevent resource exhaustion)
    if (searchQuery.length > 500) {
      return {
        results: [],
        hasMore: false,
      };
    }

    const limit = Math.min(args.limit ?? 20, 100);

    // Validate date range if provided
    if (args.dateRange) {
      const { start, end } = args.dateRange;

      // Both must be non-negative
      if (start < 0 || end < 0) {
        return { results: [], hasMore: false };
      }

      // Start must be before or equal to end
      if (start > end) {
        return { results: [], hasMore: false };
      }

      // End can't be too far in the future (1 day buffer)
      const maxFuture = Date.now() + 24 * 60 * 60 * 1000;
      if (end > maxFuture) {
        return { results: [], hasMore: false };
      }
    }

    // ========================================================================
    // Step 1: Get user's accessible channels and conversations
    // ========================================================================

    // Get all channel memberships for the user (active + archived channels)
    const channelMemberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter to accessible channels: member, not banned
    // Include archived channels (user was a member) and current channels
    // Exclude channels where user has left (leftAt is set) unless they later rejoined
    const accessibleChannelIds = new Set<string>();
    for (const membership of channelMemberships) {
      // User is considered to have access if:
      // 1. They are not banned
      // 2. They haven't left (leftAt is undefined)
      if (!membership.isBanned && membership.leftAt === undefined) {
        accessibleChannelIds.add(membership.channelId.toString());
      }
    }

    // Also include public channels user has access to (global admin or not banned)
    if (user.role === "admin") {
      // Admins can search all channels
      const allChannels = await ctx.db.query("channels").collect();
      for (const channel of allChannels) {
        accessibleChannelIds.add(channel._id.toString());
      }
    }

    // Get user's DM conversations
    const conversationParticipations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter to active conversations (not left)
    const accessibleConversationIds = new Set<string>();
    for (const participation of conversationParticipations) {
      if (participation.leftAt === undefined) {
        accessibleConversationIds.add(participation.conversationId.toString());
      }
    }

    // ========================================================================
    // Step 2: Build and execute search query
    // ========================================================================

    // Use Convex search index for full-text search
    // The search index is defined on messages table with:
    // - searchField: "content"
    // - filterFields: ["channelId", "conversationId", "senderId", "contentType"]
    const searchBuilder = ctx.db
      .query("messages")
      .withSearchIndex("search_content", (q) => {
        let search = q.search("content", searchQuery);

        // Apply filter for specific channel if provided
        if (args.channelId) {
          search = search.eq("channelId", args.channelId);
        }

        // Apply filter for specific conversation if provided
        if (args.conversationId) {
          search = search.eq("conversationId", args.conversationId);
        }

        // Apply filter for specific sender if provided
        if (args.senderId) {
          search = search.eq("senderId", args.senderId);
        }

        // Apply filter for content type if provided
        if (args.contentType) {
          search = search.eq("contentType", args.contentType);
        }

        return search;
      });

    // Fetch extra results for pagination and access filtering
    // We need more results than limit because we'll filter some out
    const fetchLimit = limit * 3;
    const searchResults = await searchBuilder.take(fetchLimit);

    // ========================================================================
    // Step 3: Filter results by access control and date range
    // ========================================================================

    const accessibleResults: typeof searchResults = [];

    for (const message of searchResults) {
      // Skip deleted messages
      if (message.deletedAt !== undefined) {
        continue;
      }

      // Check access control
      let hasAccess = false;

      if (message.channelId) {
        // Channel message - check if user has access to this channel
        if (accessibleChannelIds.has(message.channelId.toString())) {
          hasAccess = true;
        } else if (args.channelId) {
          // If user specified a channelId filter, verify they have access
          const membership = channelMemberships.find(
            (m) =>
              m.channelId.toString() === message.channelId?.toString() &&
              !m.isBanned &&
              m.leftAt === undefined
          );
          hasAccess = !!membership;
        }
      } else if (message.conversationId) {
        // Conversation message - check if user is a participant
        hasAccess = accessibleConversationIds.has(
          message.conversationId.toString()
        );
      }

      if (!hasAccess) {
        continue;
      }

      // Apply date range filter (post-search since it's not in the search index)
      if (args.dateRange) {
        if (
          message.createdAt < args.dateRange.start ||
          message.createdAt > args.dateRange.end
        ) {
          continue;
        }
      }

      // Handle cursor-based pagination
      if (args.cursor) {
        // Validate cursor format: "timestamp:messageId"
        // Format must be: digits followed by colon followed by alphanumeric ID
        if (!/^\d+:[a-z0-9]+$/i.test(args.cursor)) {
          // Invalid cursor format - skip cursor logic (start from beginning)
          // Don't throw error to avoid information disclosure
        } else {
          const cursorParts = args.cursor.split(":");
          const cursorTimestamp = cursorParts[0];
          const cursorId = cursorParts[1];

          if (cursorTimestamp && cursorId) {
            const cursorTime = parseInt(cursorTimestamp, 10);

            // Validate timestamp is a valid positive number
            if (isNaN(cursorTime) || cursorTime < 0) {
              // Invalid timestamp - skip cursor logic
            } else {
              // Skip messages that are before or at the cursor position
              if (message.createdAt > cursorTime) {
                continue;
              }
              if (
                message.createdAt === cursorTime &&
                message._id.toString() >= cursorId
              ) {
                continue;
              }
            }
          }
        }
      }

      accessibleResults.push(message);

      // Stop if we have enough results
      if (accessibleResults.length > limit) {
        break;
      }
    }

    // ========================================================================
    // Step 4: Enrich results with sender and channel information
    // ========================================================================

    const resultMessages = accessibleResults.slice(0, limit);
    const hasMore = accessibleResults.length > limit;

    // Batch fetch senders
    const senderIds = Array.from(new Set(resultMessages.map((m) => m.senderId)));
    const senders = await Promise.all(
      senderIds.map((id) => ctx.db.get(id) as Promise<Doc<"users"> | null>)
    );
    const senderMap = new Map(
      senders
        .filter((s): s is Doc<"users"> => s !== null)
        .map((s) => [s._id.toString(), s])
    );

    // Batch fetch channels for channel messages
    const channelIds = Array.from(
      new Set(
        resultMessages
          .filter((m) => m.channelId !== undefined)
          .map((m) => m.channelId!)
      )
    );
    const channels = await Promise.all(
      channelIds.map((id) => ctx.db.get(id) as Promise<Doc<"channels"> | null>)
    );
    const channelMap = new Map(
      channels
        .filter((c): c is Doc<"channels"> => c !== null)
        .map((c) => [c._id.toString(), c])
    );

    // Build final results
    const results = resultMessages.map((message) => {
      const sender = senderMap.get(message.senderId.toString());
      const channel = message.channelId
        ? channelMap.get(message.channelId.toString())
        : undefined;

      return {
        _id: message._id,
        content: message.content,
        senderId: message.senderId,
        senderName: sender?.name ?? "Unknown User",
        senderAvatarUrl: sender?.avatarUrl,
        channelId: message.channelId,
        channelName: channel?.name,
        conversationId: message.conversationId,
        createdAt: message.createdAt,
        contentType: message.contentType ?? "text",
      };
    });

    // Build next cursor if there are more results
    const lastResult = resultMessages[resultMessages.length - 1];
    const nextCursor = hasMore && lastResult
      ? `${lastResult.createdAt}:${lastResult._id.toString()}`
      : undefined;

    return {
      results,
      nextCursor,
      hasMore,
    };
  },
});

// ============================================================================
// Search History Queries
// ============================================================================

/**
 * Get search suggestions based on user's recent search history.
 * T126.2: Returns top 10 most recent unique queries for the current user.
 *
 * Used for autocomplete/suggestion UI in the search input.
 */
export const getSuggestions = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get recent search history for this user
    const searchHistory = await ctx.db
      .query("searchHistory")
      .withIndex("by_user_recent", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50); // Fetch more to deduplicate

    // Deduplicate and get top 10 unique queries
    const uniqueQueries: string[] = [];
    const seenQueries = new Set<string>();

    for (const entry of searchHistory) {
      const normalizedQuery = entry.query.toLowerCase().trim();
      if (!seenQueries.has(normalizedQuery)) {
        seenQueries.add(normalizedQuery);
        uniqueQueries.push(entry.query);
        if (uniqueQueries.length >= 10) {
          break;
        }
      }
    }

    return uniqueQueries;
  },
});

/**
 * Get recent search history with metadata.
 * T127.1: Returns last N searches with query text, result count, and timestamp.
 *
 * Used for displaying search history in the UI.
 */
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(searchHistoryItemValidator),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const limit = Math.min(args.limit ?? 20, 50);

    // Get recent search history for this user
    const searchHistory = await ctx.db
      .query("searchHistory")
      .withIndex("by_user_recent", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return searchHistory.map((entry) => ({
      query: entry.query,
      resultCount: entry.resultCount,
      timestamp: entry.timestamp,
    }));
  },
});

// ============================================================================
// Search History Mutations
// ============================================================================

/**
 * Save a search query to user's history.
 * T128.1: Stores search queries with deduplication.
 *
 * If the same query already exists for this user, updates the timestamp
 * and result count instead of creating a duplicate entry.
 */
export const saveToHistory = mutation({
  args: {
    query: v.string(),
    resultCount: v.number(),
  },
  returns: v.id("searchHistory"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Normalize the query
    const normalizedQuery = args.query.trim();

    // Check if this query already exists for the user (deduplication)
    const existingEntries = await ctx.db
      .query("searchHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existingEntry = existingEntries.find(
      (e) => e.query.toLowerCase().trim() === normalizedQuery.toLowerCase()
    );

    if (existingEntry) {
      // Update existing entry with new timestamp and result count
      await ctx.db.patch(existingEntry._id, {
        timestamp: Date.now(),
        resultCount: args.resultCount,
      });
      return existingEntry._id;
    }

    // Insert new search history entry
    const historyId = await ctx.db.insert("searchHistory", {
      userId: user._id,
      query: normalizedQuery,
      resultCount: args.resultCount,
      timestamp: Date.now(),
    });

    // Clean up old entries if user has too many (keep last 100)
    const allEntries = await ctx.db
      .query("searchHistory")
      .withIndex("by_user_recent", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    if (allEntries.length > 100) {
      // Delete oldest entries beyond 100
      const entriesToDelete = allEntries.slice(100);
      await Promise.all(
        entriesToDelete.map((entry) => ctx.db.delete(entry._id))
      );
    }

    return historyId;
  },
});

/**
 * Clear all search history for the current user.
 * Useful for privacy and GDPR compliance.
 */
export const clearHistory = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get all search history entries for this user
    const entries = await ctx.db
      .query("searchHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Delete all entries
    await Promise.all(entries.map((entry) => ctx.db.delete(entry._id)));

    return entries.length;
  },
});
