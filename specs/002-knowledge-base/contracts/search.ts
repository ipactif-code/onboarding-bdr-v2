/**
 * API Contracts: Search
 *
 * Convex queries for full-text and semantic search.
 * All results are filtered by user permissions.
 * All functions require authentication via requireAuth().
 */

import { v } from "convex/values";

// =============================================================================
// VALIDATORS
// =============================================================================

export const searchMode = v.union(
  v.literal("keyword"),  // Full-text search
  v.literal("semantic")  // AI-powered semantic search
);

export const searchFilters = v.object({
  workspaceIds: v.optional(v.array(v.id("kbWorkspaces"))),
  creatorIds: v.optional(v.array(v.id("users"))),
  dateRange: v.optional(
    v.object({
      start: v.optional(v.number()),
      end: v.optional(v.number()),
    })
  ),
  status: v.optional(v.union(v.literal("published"), v.literal("draft"))),
});

export const searchInput = v.object({
  query: v.string(),
  mode: v.optional(searchMode), // Default: keyword
  filters: v.optional(searchFilters),
  limit: v.optional(v.number()), // Default: 20
  cursor: v.optional(v.string()),
});

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Search documents by keyword or semantic similarity.
 *
 * Keyword mode uses Convex search indexes.
 * Semantic mode uses OpenAI embeddings (counts against rate limit).
 *
 * @param input - Search parameters
 * @returns Search results with pagination
 *
 * @example
 * // Keyword search
 * const results = useQuery(api.knowledge.search.documents, {
 *   query: "onboarding process",
 *   mode: "keyword",
 * });
 *
 * // Semantic search
 * const aiResults = useQuery(api.knowledge.search.documents, {
 *   query: "how do I get started with sales training?",
 *   mode: "semantic",
 * });
 */
export const documents = {
  args: searchInput,
  returns: v.object({
    results: v.array(
      v.object({
        _id: v.id("kbDocuments"),
        title: v.string(),
        icon: v.optional(v.string()),
        // Content snippet with highlighted matches
        snippet: v.string(),
        highlightedTerms: v.array(v.string()),
        // Location info
        workspace: v.object({
          _id: v.id("kbWorkspaces"),
          name: v.string(),
        }),
        folder: v.object({
          _id: v.id("kbFolders"),
          name: v.string(),
        }),
        // Metadata
        creator: v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        }),
        // For semantic search
        relevanceScore: v.optional(v.number()),
        // Timestamps
        updatedAt: v.number(),
      })
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
    totalCount: v.optional(v.number()), // Only for keyword search
    mode: searchMode,
  }),
};

/**
 * Quick search for command palette (Cmd+K).
 *
 * Faster, lighter weight search for navigation.
 * Returns limited results without full content.
 *
 * @param query - Search query
 * @param limit - Maximum results (default: 10)
 * @returns Quick search results
 *
 * @example
 * const quickResults = useQuery(api.knowledge.search.quick, {
 *   query: "getting started",
 *   limit: 5,
 * });
 */
export const quick = {
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbDocuments"),
      title: v.string(),
      icon: v.optional(v.string()),
      workspaceName: v.string(),
      folderName: v.string(),
      updatedAt: v.number(),
    })
  ),
};

/**
 * Search across multiple content types (documents, courses, messages).
 *
 * Unified search for the global search feature.
 *
 * @param query - Search query
 * @param types - Content types to search (default: all)
 * @param limit - Results per type (default: 5)
 * @returns Grouped search results
 *
 * @example
 * const globalResults = useQuery(api.knowledge.search.global, {
 *   query: "sales methodology",
 *   types: ["documents", "courses"],
 * });
 */
export const global = {
  args: {
    query: v.string(),
    types: v.optional(
      v.array(
        v.union(
          v.literal("documents"),
          v.literal("courses"),
          v.literal("messages")
        )
      )
    ),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    documents: v.array(
      v.object({
        _id: v.id("kbDocuments"),
        title: v.string(),
        icon: v.optional(v.string()),
        snippet: v.string(),
        workspaceName: v.string(),
      })
    ),
    courses: v.array(
      v.object({
        _id: v.id("courses"),
        title: v.string(),
        description: v.optional(v.string()),
      })
    ),
    messages: v.array(
      v.object({
        _id: v.id("messages"),
        content: v.string(),
        channelName: v.optional(v.string()),
        senderName: v.string(),
        createdAt: v.number(),
      })
    ),
  }),
};

/**
 * Get AI-generated answer for a natural language question.
 *
 * Uses semantic search to find relevant documents and generates an answer.
 * Counts against semantic search rate limit.
 *
 * @param question - Natural language question
 * @returns AI-generated answer with source citations
 *
 * @example
 * const answer = useQuery(api.knowledge.search.askAI, {
 *   question: "What is the SPIN selling methodology?",
 * });
 */
export const askAI = {
  args: {
    question: v.string(),
  },
  returns: v.object({
    answer: v.string(),
    confidence: v.number(), // 0-1 confidence score
    sources: v.array(
      v.object({
        _id: v.id("kbDocuments"),
        title: v.string(),
        relevantPassage: v.string(),
        relevanceScore: v.number(),
      })
    ),
    // Rate limit info
    searchesRemaining: v.number(),
  }),
};

/**
 * Get search suggestions based on query prefix.
 *
 * @param prefix - Query prefix
 * @param limit - Maximum suggestions (default: 5)
 * @returns Search suggestions
 *
 * @example
 * const suggestions = useQuery(api.knowledge.search.suggestions, {
 *   prefix: "onb",
 * });
 */
export const suggestions = {
  args: {
    prefix: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      query: v.string(),
      type: v.union(
        v.literal("recent"),    // User's recent search
        v.literal("popular"),   // Popular search
        v.literal("document")   // Document title match
      ),
    })
  ),
};

/**
 * Get user's recent searches.
 *
 * @param limit - Maximum results (default: 10)
 * @returns Recent search queries
 *
 * @example
 * const recentSearches = useQuery(api.knowledge.search.getRecent, { limit: 5 });
 */
export const getRecent = {
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      query: v.string(),
      resultCount: v.number(),
      timestamp: v.number(),
    })
  ),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Clear user's search history.
 *
 * @example
 * await clearSearchHistory();
 */
export const clearHistory = {
  args: {},
  returns: v.null(),
};
