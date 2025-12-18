/**
 * Search API Contracts
 *
 * This file defines the TypeScript signatures for message search
 * and discovery functionality.
 */

import { Id } from "convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type MessageType = "text" | "voice" | "file" | "all";

export interface SearchFilters {
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
  senderId?: Id<"users">;
  messageType?: MessageType;
  startDate?: number;
  endDate?: number;
  hasAttachments?: boolean;
  inThreads?: boolean;
}

export interface SearchResult {
  _id: Id<"messages">;
  content: string;
  contentType: "text" | "voice" | "file" | "system";
  highlightedContent: string; // Content with search terms highlighted
  sender: {
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
  };
  createdAt: number;
  context: {
    type: "channel" | "dm";
    channelId?: Id<"channels">;
    channelName?: string;
    conversationId?: Id<"conversations">;
    conversationParticipants?: string[];
  };
  threadInfo?: {
    parentId: Id<"messages">;
    isReply: boolean;
  };
  voiceTranscription?: string; // For voice messages
  relevanceScore: number;
}

export interface SearchSuggestion {
  type: "recent" | "channel" | "user" | "keyword";
  value: string;
  displayText: string;
  metadata?: {
    channelId?: Id<"channels">;
    userId?: Id<"users">;
  };
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Search messages across all accessible content
 *
 * Searches text content and voice transcriptions (FR-027).
 * Respects access controls:
 * - Excludes channels user has left (FR-025a)
 * - Includes archived channels user is member of (FR-025b)
 * Returns results within 500ms (SC-003).
 */
export interface SearchMessagesArgs {
  query: string;
  filters?: SearchFilters;
  cursor?: string;
  limit?: number; // Default 20, max 50
}

export interface SearchMessagesResult {
  results: SearchResult[];
  totalCount: number; // Approximate total matches
  nextCursor?: string;
  hasMore: boolean;
  searchTime: number; // Milliseconds
  appliedFilters: SearchFilters;
}

// Query: api.search.messages

/**
 * Get search suggestions as user types
 *
 * Returns recent searches, matching channels, and users.
 */
export interface GetSearchSuggestionsArgs {
  query: string;
  limit?: number; // Default 5 per category
}

export interface GetSearchSuggestionsResult {
  suggestions: SearchSuggestion[];
}

// Query: api.search.getSuggestions

/**
 * Get recent searches for current user
 */
export interface GetRecentSearchesArgs {
  limit?: number; // Default 10
}

export interface GetRecentSearchesResult {
  searches: Array<{
    query: string;
    searchedAt: number;
    resultCount: number;
  }>;
}

// Query: api.search.getRecent

/**
 * Get available filter options for search
 *
 * Returns channels and users that have messages.
 */
export interface GetFilterOptionsResult {
  channels: Array<{
    _id: Id<"channels">;
    name: string;
    type: "public" | "private" | "course";
    messageCount: number;
  }>;
  users: Array<{
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
    messageCount: number;
  }>;
  dateRange: {
    earliest: number;
    latest: number;
  };
}

// Query: api.search.getFilterOptions

// ============================================================================
// Mutations
// ============================================================================

/**
 * Save a search to history
 *
 * Called when user executes a search.
 */
export interface SaveSearchHistoryArgs {
  query: string;
  resultCount: number;
  filters?: SearchFilters;
}

export interface SaveSearchHistoryResult {
  success: boolean;
}

// Mutation: api.search.saveToHistory

/**
 * Clear search history
 */
export interface ClearSearchHistoryResult {
  success: boolean;
}

// Mutation: api.search.clearHistory

/**
 * Remove a specific search from history
 */
export interface RemoveFromHistoryArgs {
  query: string;
}

export interface RemoveFromHistoryResult {
  success: boolean;
}

// Mutation: api.search.removeFromHistory

// ============================================================================
// Advanced Search Operators
// ============================================================================

/**
 * Search query syntax:
 *
 * - Simple text: "hello world" - matches messages containing both words
 * - Exact phrase: "\"hello world\"" - matches exact phrase
 * - From user: "from:@username" - messages from specific user
 * - In channel: "in:#channel-name" - messages in specific channel
 * - Has attachment: "has:file" or "has:voice" - messages with attachments
 * - Date range: "after:2024-01-01 before:2024-12-31"
 * - Combine: "from:@john in:#general hello" - all conditions must match
 *
 * Example queries:
 * - "project update from:@alice"
 * - "in:#engineering has:file"
 * - "budget after:2024-06-01"
 */
export interface ParsedSearchQuery {
  text: string; // Remaining text after extracting operators
  operators: {
    from?: string; // Username
    in?: string; // Channel name
    has?: "file" | "voice" | "link";
    after?: number; // Timestamp
    before?: number; // Timestamp
  };
}

// ============================================================================
// Search Index Configuration (Reference)
// ============================================================================

/**
 * Convex search index configuration:
 *
 * messages table:
 *   .searchIndex("search_content", {
 *     searchField: "content",
 *     filterFields: ["channelId", "conversationId", "senderId", "contentType"],
 *   })
 *
 * voiceMessages table (via join):
 *   Transcription text is stored in messages.content for voice type,
 *   making it automatically searchable.
 */
