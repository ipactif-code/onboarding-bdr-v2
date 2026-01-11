"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { Id } from "../../../convex/_generated/dataModel";
import { useDebounce } from "../use-debounce";

// Use require pattern for Convex API to bypass TypeScript type inference
// This is a workaround for TS2589 "Type instantiation is excessively deep"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const convexApi = require("../../../convex/_generated/api");
const api = convexApi.api;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Search mode for document search.
 * - "keyword": Fast full-text search using indexes
 * - "semantic": AI-powered similarity search using embeddings
 */
export type SearchMode = "keyword" | "semantic";

/**
 * Filters that can be applied to search results.
 */
export interface SearchFilters {
  /** Filter by workspace IDs */
  workspaceIds?: Id<"kbWorkspaces">[];
  /** Filter by document creator IDs */
  creatorIds?: Id<"users">[];
  /** Filter by date range (timestamps in milliseconds) */
  dateRange?: {
    start?: number;
    end?: number;
  };
  /** Filter by document status */
  status?: "published" | "draft";
}

/**
 * Full search result item with all metadata.
 */
export interface SearchResult {
  _id: Id<"kbDocuments">;
  title: string;
  icon?: string;
  snippet: string;
  highlightedTerms: string[];
  workspace: {
    _id: Id<"kbWorkspaces">;
    name: string;
  };
  folder: {
    _id: Id<"kbFolders">;
    name: string;
  };
  creator: {
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
  };
  relevanceScore?: number;
  updatedAt: number;
}

/**
 * Quick search result for command palette (lighter weight).
 */
export interface QuickSearchResult {
  _id: Id<"kbDocuments">;
  title: string;
  icon?: string;
  workspaceName: string;
  folderName: string;
  updatedAt: number;
}

/**
 * Search suggestion from autocomplete.
 */
export interface SearchSuggestion {
  query: string;
  type: "recent" | "popular" | "document";
}

/**
 * Recent search entry.
 */
export interface RecentSearch {
  query: string;
  resultCount: number;
  timestamp: number;
}

/**
 * Full search response with pagination.
 */
export interface SearchResponse {
  results: SearchResult[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount?: number;
  mode: SearchMode;
}

/**
 * Options for useSearch hook.
 */
export interface UseSearchOptions {
  /** Initial search mode (default: "keyword") */
  initialMode?: SearchMode;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
}

/**
 * Return type for useSearch hook.
 */
export interface UseSearchReturn {
  // State
  /** Current search query */
  query: string;
  /** Update search query */
  setQuery: (query: string) => void;
  /** Current search mode */
  mode: SearchMode;
  /** Update search mode */
  setMode: (mode: SearchMode) => void;
  /** Current filters */
  filters: SearchFilters;
  /** Update filters */
  setFilters: (filters: SearchFilters) => void;

  // Results
  /** Full search results (for search page) */
  results: SearchResponse | undefined;
  /** Quick search results (for command palette) */
  quickResults: QuickSearchResult[] | undefined;
  /** Search suggestions for autocomplete */
  suggestions: SearchSuggestion[] | undefined;
  /** User's recent searches */
  recentSearches: RecentSearch[] | undefined;

  // Loading states
  /** Whether full search is loading */
  isLoading: boolean;
  /** Whether quick search is loading */
  isQuickLoading: boolean;
  /** Whether loading more results */
  isLoadingMore: boolean;
  /** Error message from semantic search (null if no error) */
  error: string | null;

  // Actions
  /** Track a completed search (for history) */
  trackSearch: (resultCount: number) => Promise<void>;
  /** Clear search history */
  clearHistory: () => Promise<void>;
  /** Load more results (pagination) */
  loadMore: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * useSearch - Hook for Knowledge Base document search.
 *
 * Provides state management and Convex integration for:
 * - Full-text search with filters and pagination
 * - Quick search for command palette
 * - Search suggestions/autocomplete
 * - Search history tracking
 *
 * @param options - Hook configuration options
 * @returns Search state, results, and actions
 *
 * @example
 * ```tsx
 * function SearchPage() {
 *   const {
 *     query,
 *     setQuery,
 *     mode,
 *     setMode,
 *     results,
 *     isLoading,
 *   } = useSearch({ initialMode: "keyword", debounceMs: 300 });
 *
 *   return (
 *     <div>
 *       <Input value={query} onChange={e => setQuery(e.target.value)} />
 *       {isLoading ? <Skeleton /> : <SearchResults results={results} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { initialMode = "keyword", debounceMs = 300 } = options;

  // State
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [accumulatedResults, setAccumulatedResults] = useState<SearchResult[]>([]);

  // Semantic search state (action-based)
  const [semanticResults, setSemanticResults] = useState<SearchResponse | undefined>(undefined);
  const [isSemanticLoading, setIsSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState<string | null>(null);

  // Debounce query for performance
  const debouncedQuery = useDebounce(query, debounceMs);

  // Reset pagination when query, mode, or filters change
  const resetPagination = useCallback(() => {
    setCursor(undefined);
    setAccumulatedResults([]);
    setIsLoadingMore(false);
    setSemanticResults(undefined);
    setSemanticError(null);
  }, []);

  // Track previous query/mode/filters to detect changes
  const prevDebouncedQuery = useRef(debouncedQuery);
  const prevMode = useRef(mode);
  const prevFilters = useRef(filters);

  // Reset pagination when search parameters change
  if (
    prevDebouncedQuery.current !== debouncedQuery ||
    prevMode.current !== mode ||
    prevFilters.current !== filters
  ) {
    prevDebouncedQuery.current = debouncedQuery;
    prevMode.current = mode;
    prevFilters.current = filters;
    resetPagination();
  }

  // Semantic search action
  const semanticSearchAction = useAction(api.actions.embeddings.semanticSearchWithEnrichment);

  // Execute semantic search when mode is "semantic" and query changes
  useEffect(() => {
    // Only run semantic search when mode is semantic and query is valid
    if (mode !== "semantic" || debouncedQuery.length < 2) {
      return;
    }

    let cancelled = false;

    const runSemanticSearch = async () => {
      setIsSemanticLoading(true);
      setSemanticError(null);

      try {
        const result = await semanticSearchAction({
          query: debouncedQuery,
          limit: 20,
        });

        if (!cancelled) {
          setSemanticResults(result as SearchResponse);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[useSearch] Semantic search error:", error);
          setSemanticError(error instanceof Error ? error.message : "Semantic search failed");
          setSemanticResults({
            results: [],
            hasMore: false,
            totalCount: 0,
            mode: "semantic",
          });
        }
      } finally {
        if (!cancelled) {
          setIsSemanticLoading(false);
        }
      }
    };

    runSemanticSearch();

    return () => {
      cancelled = true;
    };
  }, [mode, debouncedQuery, semanticSearchAction]);

  // Keyword search (for search page) - requires 2+ chars, only when mode is "keyword"
  const keywordSearchResults = useQuery(
    api.knowledge.search.documents,
    mode === "keyword" && debouncedQuery.length >= 2
      ? {
          query: debouncedQuery,
          mode: "keyword",
          filters: {
            workspaceIds: filters.workspaceIds,
            creatorIds: filters.creatorIds,
            dateRange: filters.dateRange,
            status: filters.status,
          },
          limit: 20,
          cursor,
        }
      : "skip"
  ) as SearchResponse | undefined;

  // Accumulate results when loading more pages (keyword mode only)
  useEffect(() => {
    if (mode === "keyword" && keywordSearchResults?.results) {
      if (cursor) {
        // Append new results to existing ones
        setAccumulatedResults((prev) => [...prev, ...keywordSearchResults.results]);
      } else {
        // First page - replace accumulated results
        setAccumulatedResults(keywordSearchResults.results);
      }
      setIsLoadingMore(false);
    }
  }, [keywordSearchResults, cursor, mode]);

  // Build combined results with pagination info based on mode
  const combinedResults: SearchResponse | undefined = mode === "semantic"
    ? semanticResults
    : keywordSearchResults
      ? {
          ...keywordSearchResults,
          results: cursor ? accumulatedResults : keywordSearchResults.results,
        }
      : undefined;

  // Quick search (for command palette) - requires 1+ char or returns recent
  const quickResults = useQuery(
    api.knowledge.search.quick,
    {
      query: debouncedQuery,
      limit: 8,
    }
  ) as QuickSearchResult[] | undefined;

  // Suggestions for autocomplete - requires 1+ char
  const suggestions = useQuery(
    api.knowledge.search.suggestions,
    query.length >= 1 ? { prefix: query, limit: 5 } : "skip"
  ) as SearchSuggestion[] | undefined;

  // Recent searches
  const recentSearches = useQuery(api.knowledge.search.getRecent, {
    limit: 5,
  }) as RecentSearch[] | undefined;

  // Mutations
  const recordSearchMutation = useMutation(api.knowledge.search.recordSearch);
  const clearHistoryMutation = useMutation(api.knowledge.search.clearHistory);

  // Track search when user submits (for history)
  const trackSearch = useCallback(
    async (resultCount: number) => {
      if (debouncedQuery.length >= 2) {
        await recordSearchMutation({
          query: debouncedQuery,
          mode,
          filters: {
            workspaceIds: filters.workspaceIds,
            creatorIds: filters.creatorIds,
            dateRange: filters.dateRange,
            status: filters.status,
          },
          resultCount,
        });
      }
    },
    [debouncedQuery, mode, filters, recordSearchMutation]
  );

  // Clear search history
  const clearHistory = useCallback(async () => {
    await clearHistoryMutation({});
  }, [clearHistoryMutation]);

  // Load more results (pagination) - only supported for keyword mode
  const loadMore = useCallback(() => {
    // Semantic search doesn't support pagination
    if (mode === "semantic") {
      return;
    }
    if (keywordSearchResults?.hasMore && keywordSearchResults.nextCursor) {
      setIsLoadingMore(true);
      setCursor(keywordSearchResults.nextCursor);
    }
  }, [mode, keywordSearchResults?.hasMore, keywordSearchResults?.nextCursor]);

  // Compute loading state based on mode
  const isLoading = mode === "semantic"
    ? isSemanticLoading
    : keywordSearchResults === undefined && debouncedQuery.length >= 2 && !cursor;

  return {
    // State
    query,
    setQuery,
    mode,
    setMode,
    filters,
    setFilters,

    // Results - use combined results for pagination
    results: combinedResults,
    quickResults,
    suggestions,
    recentSearches,

    // Loading states
    isLoading,
    isQuickLoading: quickResults === undefined,
    isLoadingMore,
    error: semanticError,

    // Actions
    trackSearch,
    clearHistory,
    loadMore,
  };
}
