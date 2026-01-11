import { query, mutation, internalQuery, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { requireKBAuth } from "../lib/kbAuth";
import { batchFilterAccessibleDocuments } from "./permissionHelpers";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default number of search results */
const DEFAULT_SEARCH_LIMIT = 20;

/** Maximum number of search results */
const MAX_SEARCH_LIMIT = 100;

/** Default snippet length in characters */
const SNIPPET_LENGTH = 150;

/** Characters before/after match for context */
const SNIPPET_CONTEXT = 50;

// ============================================================================
// VALIDATORS
// ============================================================================

const searchModeValidator = v.union(v.literal("keyword"), v.literal("semantic"));

const searchFiltersValidator = v.object({
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

const searchResultValidator = v.object({
  _id: v.id("kbDocuments"),
  title: v.string(),
  icon: v.optional(v.string()),
  snippet: v.string(),
  highlightedTerms: v.array(v.string()),
  workspace: v.object({
    _id: v.id("kbWorkspaces"),
    name: v.string(),
  }),
  folder: v.object({
    _id: v.id("kbFolders"),
    name: v.string(),
  }),
  creator: v.object({
    _id: v.id("users"),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  }),
  relevanceScore: v.optional(v.number()),
  updatedAt: v.number(),
});

const quickResultValidator = v.object({
  _id: v.id("kbDocuments"),
  title: v.string(),
  icon: v.optional(v.string()),
  workspaceName: v.string(),
  folderName: v.string(),
  snippet: v.optional(v.string()),
  updatedAt: v.number(),
});

const suggestionValidator = v.object({
  query: v.string(),
  type: v.union(v.literal("recent"), v.literal("popular"), v.literal("document")),
});

const recentSearchValidator = v.object({
  query: v.string(),
  resultCount: v.number(),
  timestamp: v.number(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract search terms from a query string.
 * Splits on whitespace and filters empty strings.
 */
function extractSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
}

/**
 * Extract a snippet from text around the first matching term.
 * Returns a substring with context around the match.
 *
 * @param text - The full text to extract snippet from
 * @param terms - Search terms to find
 * @param maxLength - Maximum snippet length
 * @returns Snippet string with ellipsis if truncated
 */
function extractSnippet(
  text: string,
  terms: string[],
  maxLength: number = SNIPPET_LENGTH
): string {
  if (!text || text.length === 0) {
    return "";
  }

  const lowerText = text.toLowerCase();

  // Find the first matching term position
  let firstMatchIndex = -1;
  for (const term of terms) {
    const index = lowerText.indexOf(term.toLowerCase());
    if (index !== -1 && (firstMatchIndex === -1 || index < firstMatchIndex)) {
      firstMatchIndex = index;
    }
  }

  // If no match found, return start of text
  if (firstMatchIndex === -1) {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + "...";
  }

  // Calculate snippet boundaries with context
  const start = Math.max(0, firstMatchIndex - SNIPPET_CONTEXT);
  const end = Math.min(text.length, start + maxLength);

  let snippet = text.substring(start, end);

  // Add ellipsis if truncated
  if (start > 0) {
    snippet = "..." + snippet;
  }
  if (end < text.length) {
    snippet = snippet + "...";
  }

  return snippet;
}

/**
 * Find which search terms appear in the text.
 *
 * @param text - The text to search in
 * @param terms - Search terms to find
 * @returns Array of terms that were found
 */
function findMatchingTerms(text: string, terms: string[]): string[] {
  const lowerText = text.toLowerCase();
  return terms.filter((term) => lowerText.includes(term.toLowerCase()));
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Search documents by keyword or semantic similarity.
 * Uses Convex search indexes for keyword search.
 * Results are filtered by user permissions.
 *
 * @param query - Search query string
 * @param mode - Search mode: "keyword" (default) or "semantic"
 * @param filters - Optional filters for workspace, creator, date, status
 * @param limit - Maximum results (default: 20, max: 100)
 * @param cursor - Pagination cursor
 * @returns Search results with pagination
 */
export const documents = query({
  args: {
    query: v.string(),
    mode: v.optional(searchModeValidator),
    filters: v.optional(searchFiltersValidator),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    results: v.array(searchResultValidator),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
    totalCount: v.optional(v.number()),
    mode: searchModeValidator,
  }),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const mode = args.mode ?? "keyword";
    const limit = Math.min(args.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
    const searchTerms = extractSearchTerms(args.query);

    if (searchTerms.length === 0) {
      return {
        results: [],
        nextCursor: undefined,
        hasMore: false,
        totalCount: 0,
        mode,
      };
    }

    // For keyword search, use the search index on document titles
    // Search on kbDocuments.title using search_title index
    const titleMatches = await ctx.db
      .query("kbDocuments")
      .withSearchIndex("search_title", (q) => {
        let searchQuery = q.search("title", args.query);

        // Apply status filter if provided
        if (args.filters?.status) {
          searchQuery = searchQuery.eq("status", args.filters.status);
        }

        // Apply creator filter if provided (only one creator for search index)
        if (args.filters?.creatorIds && args.filters.creatorIds.length === 1) {
          const firstCreator = args.filters.creatorIds[0];
          if (firstCreator) {
            searchQuery = searchQuery.eq("creatorId", firstCreator);
          }
        }

        return searchQuery;
      })
      .take(limit * 3); // Get extra to account for permission filtering

    // Also search content using search_content index on kbDocumentContent
    const contentMatches = await ctx.db
      .query("kbDocumentContent")
      .withSearchIndex("search_content", (q) => q.search("contentText", args.query))
      .take(limit * 3);

    // Get document IDs from content matches
    const contentDocIds = new Set(contentMatches.map((c) => c.documentId));

    // Fetch documents for content matches that aren't already in title matches
    const titleDocIds = new Set(titleMatches.map((d) => d._id));
    const additionalDocIds = Array.from(contentDocIds).filter(
      (id) => !titleDocIds.has(id)
    );
    const additionalDocs = await Promise.all(
      additionalDocIds.map((id) => ctx.db.get(id))
    );

    // Combine and dedupe documents
    const allDocs = [
      ...titleMatches,
      ...additionalDocs.filter((d): d is NonNullable<typeof d> => d !== null),
    ];

    // Apply additional filters that search index doesn't support
    let filteredDocs = allDocs;

    // Filter by status if not already applied in search
    if (args.filters?.status && args.filters.creatorIds?.length !== 1) {
      filteredDocs = filteredDocs.filter((d) => d.status === args.filters!.status);
    }

    // Filter archived documents
    filteredDocs = filteredDocs.filter((d) => d.status !== "archived");

    // Filter by multiple creators
    if (args.filters?.creatorIds && args.filters.creatorIds.length > 1) {
      const creatorSet = new Set(args.filters.creatorIds.map((id) => id.toString()));
      filteredDocs = filteredDocs.filter((d) =>
        creatorSet.has(d.creatorId.toString())
      );
    }

    // Filter by date range
    if (args.filters?.dateRange) {
      const { start, end } = args.filters.dateRange;
      if (start !== undefined) {
        filteredDocs = filteredDocs.filter((d) => d.updatedAt >= start);
      }
      if (end !== undefined) {
        filteredDocs = filteredDocs.filter((d) => d.updatedAt <= end);
      }
    }

    // Batch check permissions
    const docIds = filteredDocs.map((d) => d._id);
    const accessibleIds = await batchFilterAccessibleDocuments(
      ctx,
      userId,
      docIds,
      "read"
    );

    // Filter to accessible documents
    const accessibleDocs = filteredDocs.filter((d) => accessibleIds.has(d._id));

    // Filter by workspace if specified
    let workspaceFilteredDocs = accessibleDocs;
    if (args.filters?.workspaceIds && args.filters.workspaceIds.length > 0) {
      // Get folder -> workspace mapping
      const folderIds = [...new Set(accessibleDocs.map((d) => d.folderId))];
      const folders = await Promise.all(folderIds.map((id) => ctx.db.get(id)));
      const folderWorkspaceMap = new Map<string, string>();
      for (const folder of folders) {
        if (folder) {
          folderWorkspaceMap.set(folder._id, folder.workspaceId);
        }
      }

      const workspaceSet = new Set(
        args.filters.workspaceIds.map((id) => id.toString())
      );
      workspaceFilteredDocs = accessibleDocs.filter((d) => {
        const workspaceId = folderWorkspaceMap.get(d.folderId);
        return workspaceId && workspaceSet.has(workspaceId);
      });
    }

    // Apply cursor-based pagination
    let paginatedDocs = workspaceFilteredDocs;
    if (args.cursor) {
      const cursorIndex = paginatedDocs.findIndex((d) => d._id === args.cursor);
      if (cursorIndex !== -1) {
        paginatedDocs = paginatedDocs.slice(cursorIndex + 1);
      }
    }

    // Take limit + 1 to check if there are more results
    const resultDocs = paginatedDocs.slice(0, limit + 1);
    const hasMore = resultDocs.length > limit;
    const finalDocs = resultDocs.slice(0, limit);

    // Build result objects with full metadata
    const results: Array<{
      _id: Id<"kbDocuments">;
      title: string;
      icon: string | undefined;
      snippet: string;
      highlightedTerms: string[];
      workspace: { _id: Id<"kbWorkspaces">; name: string };
      folder: { _id: Id<"kbFolders">; name: string };
      creator: { _id: Id<"users">; name: string; avatarUrl: string | undefined };
      relevanceScore: number | undefined;
      updatedAt: number;
    }> = [];

    // Fetch related data in batches
    const uniqueFolderIds = [...new Set(finalDocs.map((d) => d.folderId))];
    const uniqueCreatorIds = [...new Set(finalDocs.map((d) => d.creatorId))];
    const uniqueDocIds = finalDocs.map((d) => d._id);

    const [folders, creators, contents] = await Promise.all([
      Promise.all(uniqueFolderIds.map((id) => ctx.db.get(id))),
      Promise.all(uniqueCreatorIds.map((id) => ctx.db.get(id))),
      Promise.all(
        uniqueDocIds.map((id) =>
          ctx.db
            .query("kbDocumentContent")
            .withIndex("by_document", (q) => q.eq("documentId", id))
            .unique()
        )
      ),
    ]);

    // Create lookup maps
    const folderMap = new Map<string, Doc<"kbFolders">>();
    const workspaceIds: Id<"kbWorkspaces">[] = [];
    for (const folder of folders) {
      if (folder) {
        folderMap.set(folder._id, folder);
        workspaceIds.push(folder.workspaceId);
      }
    }

    const workspaces = await Promise.all(
      [...new Set(workspaceIds)].map((id) => ctx.db.get(id))
    );
    const workspaceMap = new Map<string, Doc<"kbWorkspaces">>();
    for (const ws of workspaces) {
      if (ws) {
        workspaceMap.set(ws._id, ws);
      }
    }

    const creatorMap = new Map<string, Doc<"users">>();
    for (const creator of creators) {
      if (creator) {
        creatorMap.set(creator._id, creator);
      }
    }

    const contentMap = new Map<string, Doc<"kbDocumentContent">>();
    for (let i = 0; i < uniqueDocIds.length; i++) {
      const content = contents[i];
      const docId = uniqueDocIds[i];
      if (content && docId) {
        contentMap.set(docId, content);
      }
    }

    // Build results
    for (const doc of finalDocs) {
      const folder = folderMap.get(doc.folderId);
      const workspace = folder ? workspaceMap.get(folder.workspaceId) : null;
      const creator = creatorMap.get(doc.creatorId);
      const content = contentMap.get(doc._id);

      if (!folder || !workspace || !creator) {
        continue; // Skip if missing required data
      }

      // Extract snippet from content
      const plainText = content?.contentText ?? "";
      const snippet = extractSnippet(plainText || doc.title, searchTerms);
      const highlightedTerms = findMatchingTerms(
        plainText + " " + doc.title,
        searchTerms
      );

      results.push({
        _id: doc._id,
        title: doc.title,
        icon: doc.icon,
        snippet,
        highlightedTerms,
        workspace: {
          _id: workspace._id,
          name: workspace.name,
        },
        folder: {
          _id: folder._id,
          name: folder.name,
        },
        creator: {
          _id: creator._id,
          name: creator.name,
          avatarUrl: creator.avatarUrl,
        },
        relevanceScore: undefined, // Only set for semantic search
        updatedAt: doc.updatedAt,
      });
    }

    const lastDoc = finalDocs[finalDocs.length - 1];

    return {
      results,
      nextCursor: hasMore && lastDoc ? lastDoc._id : undefined,
      hasMore,
      totalCount: workspaceFilteredDocs.length,
      mode,
    };
  },
});

/**
 * Quick search for command palette (Cmd+K).
 * Faster, lighter weight search for navigation.
 * Returns limited results without full content.
 *
 * @param query - Search query string
 * @param limit - Maximum results (default: 10)
 * @returns Quick search results with basic metadata
 */
export const quick = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(quickResultValidator),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const limit = Math.min(args.limit ?? 10, 50);

    if (!args.query || args.query.trim().length === 0) {
      // Return recent documents when query is empty
      const recents = await ctx.db
        .query("kbUserRecents")
        .withIndex("by_user_time", (q) => q.eq("userId", userId))
        .order("desc")
        .take(limit * 2);

      if (recents.length === 0) {
        return [];
      }

      const recentDocs = await Promise.all(
        recents.map((r) => ctx.db.get(r.documentId))
      );

      const validDocs = recentDocs.filter(
        (doc): doc is NonNullable<typeof doc> =>
          doc !== null && doc.status !== "archived"
      );

      const docIds = validDocs.map((d) => d._id);
      const accessibleIds = await batchFilterAccessibleDocuments(
        ctx,
        userId,
        docIds,
        "read"
      );

      const accessibleDocs = validDocs
        .filter((d) => accessibleIds.has(d._id))
        .slice(0, limit);

      // No query string for recents - will show first ~150 chars of content
      return buildQuickResults(ctx, accessibleDocs);
    }

    // Search documents by title
    const titleMatches = await ctx.db
      .query("kbDocuments")
      .withSearchIndex("search_title", (q) => q.search("title", args.query))
      .take(limit * 2);

    // Also search content using search_content index on kbDocumentContent
    const contentMatches = await ctx.db
      .query("kbDocumentContent")
      .withSearchIndex("search_content", (q) => q.search("contentText", args.query))
      .take(limit * 2);

    // Get document IDs from content matches
    const contentDocIds = new Set(contentMatches.map((c) => c.documentId));

    // Fetch documents for content matches that aren't already in title matches
    const titleDocIds = new Set(titleMatches.map((d) => d._id));
    const additionalDocIds = Array.from(contentDocIds).filter(
      (id) => !titleDocIds.has(id)
    );
    const additionalDocs = await Promise.all(
      additionalDocIds.map((id) => ctx.db.get(id))
    );

    // Combine and dedupe documents (title matches first for better relevance)
    const allDocs = [
      ...titleMatches,
      ...additionalDocs.filter((d): d is NonNullable<typeof d> => d !== null),
    ];

    // Filter archived
    const filteredDocs = allDocs.filter((d) => d.status !== "archived");

    // Check permissions
    const docIds = filteredDocs.map((d) => d._id);
    const accessibleIds = await batchFilterAccessibleDocuments(
      ctx,
      userId,
      docIds,
      "read"
    );

    const accessibleDocs = filteredDocs
      .filter((d) => accessibleIds.has(d._id))
      .slice(0, limit);

    // Pass query string for contextual snippets centered on search matches
    return buildQuickResults(ctx, accessibleDocs, args.query);
  },
});

/**
 * Helper to build quick search results with folder/workspace names and content snippets.
 *
 * @param ctx - Query context with database access
 * @param docs - Documents to build results for
 * @param searchQuery - Optional search query for contextual snippets
 * @returns Array of quick search results with snippets
 */
async function buildQuickResults(
  ctx: QueryCtx,
  docs: Doc<"kbDocuments">[],
  searchQuery?: string
): Promise<
  Array<{
    _id: Id<"kbDocuments">;
    title: string;
    icon: string | undefined;
    workspaceName: string;
    folderName: string;
    snippet: string | undefined;
    updatedAt: number;
  }>
> {
  if (docs.length === 0) {
    return [];
  }

  // Fetch folders
  const folderIds = [...new Set(docs.map((d) => d.folderId))];
  const folders = await Promise.all(
    folderIds.map((id) => ctx.db.get(id) as Promise<Doc<"kbFolders"> | null>)
  );

  const folderMap = new Map<string, Doc<"kbFolders">>();
  const workspaceIds: Id<"kbWorkspaces">[] = [];
  for (const folder of folders) {
    if (folder) {
      folderMap.set(folder._id, folder);
      workspaceIds.push(folder.workspaceId);
    }
  }

  // Fetch workspaces
  const workspaces = await Promise.all(
    [...new Set(workspaceIds)].map((id) => ctx.db.get(id) as Promise<Doc<"kbWorkspaces"> | null>)
  );

  const workspaceMap = new Map<string, Doc<"kbWorkspaces">>();
  for (const ws of workspaces) {
    if (ws) {
      workspaceMap.set(ws._id, ws);
    }
  }

  // Fetch document content for snippets
  const contents = await Promise.all(
    docs.map((doc) =>
      ctx.db
        .query("kbDocumentContent")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .unique()
    )
  );

  const contentMap = new Map<string, Doc<"kbDocumentContent">>();
  for (let i = 0; i < docs.length; i++) {
    const content = contents[i];
    const doc = docs[i];
    if (content && doc) {
      contentMap.set(doc._id, content);
    }
  }

  // Extract search terms for snippet generation
  const searchTerms = searchQuery ? extractSearchTerms(searchQuery) : [];

  // Build results
  const results: Array<{
    _id: Id<"kbDocuments">;
    title: string;
    icon: string | undefined;
    workspaceName: string;
    folderName: string;
    snippet: string | undefined;
    updatedAt: number;
  }> = [];

  for (const doc of docs) {
    const folder = folderMap.get(doc.folderId);
    const workspace = folder ? workspaceMap.get(folder.workspaceId) : null;

    if (!folder || !workspace) {
      continue;
    }

    // Generate snippet from content
    const content = contentMap.get(doc._id);
    const plainText = content?.contentText ?? "";
    let snippet: string | undefined;

    if (plainText) {
      if (searchTerms.length > 0) {
        // For search queries, use extractSnippet to center on first match
        snippet = extractSnippet(plainText, searchTerms);
      } else {
        // For recents (no query), show first ~150 chars
        snippet = plainText.length > SNIPPET_LENGTH
          ? plainText.substring(0, SNIPPET_LENGTH) + "..."
          : plainText;
      }
    }

    results.push({
      _id: doc._id,
      title: doc.title,
      icon: doc.icon,
      workspaceName: workspace.name,
      folderName: folder.name,
      snippet,
      updatedAt: doc.updatedAt,
    });
  }

  return results;
}

/**
 * Get search suggestions based on query prefix.
 * Returns a mix of recent searches, popular searches, and document title matches.
 *
 * @param prefix - Query prefix for autocomplete
 * @param limit - Maximum suggestions (default: 5)
 * @returns Array of search suggestions with type
 */
export const suggestions = query({
  args: {
    prefix: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(suggestionValidator),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const limit = Math.min(args.limit ?? 5, 20);
    const prefix = args.prefix.toLowerCase().trim();

    const results: Array<{
      query: string;
      type: "recent" | "popular" | "document";
    }> = [];

    const seen = new Set<string>();

    // 1. Get user's recent searches matching prefix
    const recentSearches = await ctx.db
      .query("kbSearchHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    for (const search of recentSearches) {
      if (results.length >= limit) break;
      const query = search.query.toLowerCase();
      if (query.startsWith(prefix) && !seen.has(query)) {
        results.push({ query: search.query, type: "recent" });
        seen.add(query);
      }
    }

    // 2. Get document titles matching prefix (if we need more results)
    if (results.length < limit && prefix.length >= 2) {
      const titleMatches = await ctx.db
        .query("kbDocuments")
        .withSearchIndex("search_title", (q) => q.search("title", prefix))
        .take((limit - results.length) * 2);

      // Filter by permission
      const docIds = titleMatches
        .filter((d) => d.status !== "archived")
        .map((d) => d._id);
      const accessibleIds = await batchFilterAccessibleDocuments(
        ctx,
        userId,
        docIds,
        "read"
      );

      for (const doc of titleMatches) {
        if (results.length >= limit) break;
        if (!accessibleIds.has(doc._id)) continue;

        const query = doc.title.toLowerCase();
        if (!seen.has(query)) {
          results.push({ query: doc.title, type: "document" });
          seen.add(query);
        }
      }
    }

    return results;
  },
});

/**
 * Get user's recent searches.
 * Returns search queries ordered by most recent first.
 *
 * @param limit - Maximum results (default: 10)
 * @returns Array of recent search queries with metadata
 */
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(recentSearchValidator),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const limit = Math.min(args.limit ?? 10, 50);

    const recentSearches = await ctx.db
      .query("kbSearchHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return recentSearches.map((search) => ({
      query: search.query,
      resultCount: search.resultCount,
      timestamp: search.createdAt,
    }));
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Record a search in user's search history.
 * Called after performing a search to track recent queries.
 *
 * @param query - The search query string
 * @param mode - Search mode used (keyword or semantic)
 * @param filters - Optional filters applied to the search
 * @param resultCount - Number of results returned
 * @returns null
 */
export const recordSearch = mutation({
  args: {
    query: v.string(),
    mode: searchModeValidator,
    filters: v.optional(searchFiltersValidator),
    resultCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Skip recording empty queries
    if (!args.query || args.query.trim().length === 0) {
      return null;
    }

    // Check if this exact query was searched recently (within last minute)
    // to avoid duplicate entries from real-time search
    const recentSameQuery = await ctx.db
      .query("kbSearchHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);

    const oneMinuteAgo = Date.now() - 60 * 1000;
    const mostRecentQuery = recentSameQuery[0];
    if (
      mostRecentQuery &&
      mostRecentQuery.query.toLowerCase() === args.query.toLowerCase() &&
      mostRecentQuery.createdAt > oneMinuteAgo
    ) {
      // Update existing entry instead of creating new one
      await ctx.db.patch(mostRecentQuery._id, {
        resultCount: args.resultCount,
        createdAt: Date.now(),
      });
      return null;
    }

    // Insert new search history entry
    await ctx.db.insert("kbSearchHistory", {
      userId,
      query: args.query.trim(),
      mode: args.mode,
      filters: args.filters
        ? {
            workspaceIds: args.filters.workspaceIds,
            creatorIds: args.filters.creatorIds,
          }
        : undefined,
      resultCount: args.resultCount,
      createdAt: Date.now(),
    });

    // Cleanup: Keep only last 100 searches per user
    const allSearches = await ctx.db
      .query("kbSearchHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    if (allSearches.length > 100) {
      const toDelete = allSearches.slice(100);
      for (const search of toDelete) {
        await ctx.db.delete(search._id);
      }
    }

    return null;
  },
});

/**
 * Clear user's search history.
 * Removes all search history entries for the current user.
 *
 * @returns null
 */
export const clearHistory = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { userId } = await requireKBAuth(ctx);

    // Get all search history for user
    const searches = await ctx.db
      .query("kbSearchHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Delete all entries
    for (const search of searches) {
      await ctx.db.delete(search._id);
    }

    return null;
  },
});

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

/**
 * Internal query to enrich document IDs with full search result data.
 * Used by the semantic search action to return consistent result format.
 *
 * @param documents - Array of document IDs with optional relevance scores
 * @param userId - User ID for permission filtering
 * @param searchTerms - Optional search terms for snippet extraction
 * @returns Array of full search results matching the public query format
 */
export const enrichDocumentsForSearch = internalQuery({
  args: {
    documents: v.array(
      v.object({
        documentId: v.id("kbDocuments"),
        score: v.optional(v.number()),
        content: v.optional(v.string()), // Matched chunk content for snippet
      })
    ),
    userId: v.id("users"),
    searchTerms: v.optional(v.array(v.string())),
  },
  returns: v.array(searchResultValidator),
  handler: async (ctx, args) => {
    const { documents, userId, searchTerms } = args;

    if (documents.length === 0) {
      return [];
    }

    // Get unique document IDs
    const docIds = [...new Set(documents.map((d) => d.documentId))];

    // Batch check permissions
    const accessibleIds = await batchFilterAccessibleDocuments(
      ctx,
      userId,
      docIds,
      "read"
    );

    // Filter to accessible documents
    const accessibleDocs = documents.filter((d) => accessibleIds.has(d.documentId));

    if (accessibleDocs.length === 0) {
      return [];
    }

    // Fetch all document data
    const docDataPromises = accessibleDocs.map((d) => ctx.db.get(d.documentId));
    const docData = await Promise.all(docDataPromises);

    // Get unique folder IDs
    const folderIds = [...new Set(docData.filter((d) => d).map((d) => d!.folderId))];
    const foldersPromises = folderIds.map((id) => ctx.db.get(id));
    const folders = await Promise.all(foldersPromises);

    const folderMap = new Map<string, Doc<"kbFolders">>();
    for (const folder of folders) {
      if (folder) {
        folderMap.set(folder._id, folder);
      }
    }

    // Get unique workspace IDs from folders
    const workspaceIds = [...new Set(folders.filter((f) => f).map((f) => f!.workspaceId))];
    const workspacesPromises = workspaceIds.map((id) => ctx.db.get(id));
    const workspaces = await Promise.all(workspacesPromises);

    const workspaceMap = new Map<string, Doc<"kbWorkspaces">>();
    for (const ws of workspaces) {
      if (ws) {
        workspaceMap.set(ws._id, ws);
      }
    }

    // Get unique creator IDs
    const creatorIds = [...new Set(docData.filter((d) => d).map((d) => d!.creatorId))];
    const creatorsPromises = creatorIds.map((id) => ctx.db.get(id));
    const creators = await Promise.all(creatorsPromises);

    const creatorMap = new Map<string, Doc<"users">>();
    for (const creator of creators) {
      if (creator) {
        creatorMap.set(creator._id, creator);
      }
    }

    // Get content for each document (for snippets if not provided)
    const contentPromises = docIds.map((docId) =>
      ctx.db
        .query("kbDocumentContent")
        .withIndex("by_document", (q) => q.eq("documentId", docId))
        .unique()
    );
    const contents = await Promise.all(contentPromises);

    const contentMap = new Map<string, Doc<"kbDocumentContent">>();
    for (let i = 0; i < docIds.length; i++) {
      const content = contents[i];
      const docId = docIds[i];
      if (content && docId) {
        contentMap.set(docId, content);
      }
    }

    // Create a map for quick lookup of scores and chunk content
    const scoreMap = new Map<string, { score?: number; content?: string }>();
    for (const doc of accessibleDocs) {
      scoreMap.set(doc.documentId, { score: doc.score, content: doc.content });
    }

    // Build results maintaining order from input
    const results: Array<{
      _id: Id<"kbDocuments">;
      title: string;
      icon?: string;
      snippet: string;
      highlightedTerms: string[];
      workspace: { _id: Id<"kbWorkspaces">; name: string };
      folder: { _id: Id<"kbFolders">; name: string };
      creator: { _id: Id<"users">; name: string; avatarUrl?: string };
      relevanceScore?: number;
      updatedAt: number;
    }> = [];

    for (const docInput of accessibleDocs) {
      const doc = docData.find((d) => d && d._id === docInput.documentId);
      if (!doc) continue;

      const folder = folderMap.get(doc.folderId);
      const workspace = folder ? workspaceMap.get(folder.workspaceId) : null;
      const creator = creatorMap.get(doc.creatorId);
      const storedContent = contentMap.get(doc._id);

      if (!folder || !workspace || !creator) {
        continue; // Skip if missing required data
      }

      // Use chunk content for snippet if provided, otherwise use stored content
      const snippetSource =
        docInput.content || storedContent?.contentText || doc.title;
      const terms = searchTerms || [];
      const snippet = extractSnippet(snippetSource, terms);
      const highlightedTerms = findMatchingTerms(
        snippetSource + " " + doc.title,
        terms
      );

      const scoreData = scoreMap.get(doc._id);

      results.push({
        _id: doc._id,
        title: doc.title,
        icon: doc.icon,
        snippet,
        highlightedTerms,
        workspace: {
          _id: workspace._id,
          name: workspace.name,
        },
        folder: {
          _id: folder._id,
          name: folder.name,
        },
        creator: {
          _id: creator._id,
          name: creator.name,
          avatarUrl: creator.avatarUrl,
        },
        relevanceScore: scoreData?.score,
        updatedAt: doc.updatedAt,
      });
    }

    return results;
  },
});
