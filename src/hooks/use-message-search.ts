"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";

// Import api using require to completely bypass TypeScript type inference
// This is a workaround for TS2589 "Type instantiation is excessively deep"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const convexApi = require("../../convex/_generated/api");
const api = convexApi.api;

import type { Id } from "../../convex/_generated/dataModel";
import { useDebounce } from "./use-debounce";

// ============================================================================
// Types
// ============================================================================

/**
 * Search result item from the Convex searchMessages query.
 */
export interface SearchResult {
  _id: Id<"messages">;
  content: string;
  senderId: Id<"users">;
  senderName: string;
  senderAvatarUrl?: string;
  channelId?: Id<"channels">;
  channelName?: string;
  conversationId?: Id<"conversations">;
  createdAt: number;
  contentType: string;
}

/**
 * Search filters for narrowing down results.
 */
export interface SearchFilters {
  channelId?: Id<"channels">;
  senderId?: Id<"users">;
  dateRange?: { start: Date; end: Date };
  contentType?: "text" | "voice" | "file";
}

/**
 * Recent search item with metadata.
 */
export interface RecentSearch {
  query: string;
  resultCount: number;
  timestamp: number;
}

/**
 * Return type for the useMessageSearch hook.
 */
export interface UseMessageSearchReturn {
  /** Current search query */
  query: string;
  /** Update the search query */
  setQuery: (query: string) => void;
  /** Current filter settings */
  filters: SearchFilters;
  /** Update filters */
  setFilters: (filters: SearchFilters) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Search results (undefined while loading) */
  results: SearchResult[];
  /** Whether search is in progress */
  isLoading: boolean;
  /** Whether there are more results to load */
  hasMore: boolean;
  /** Load more results (pagination) */
  loadMore: () => void;
  /** Suggested queries from history */
  suggestions: string[];
  /** Recent searches with metadata */
  recentSearches: RecentSearch[];
  /** Clear the search query and results */
  clearSearch: () => void;
  /** The debounced query that was actually searched */
  debouncedQuery: string;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for message search with debouncing, filters, and pagination.
 *
 * Features:
 * - Debounced search (300ms delay)
 * - Filter support (channel, sender, date range, content type)
 * - Cursor-based pagination
 * - Automatic history save on successful search
 * - Suggestions from recent search history
 *
 * @example
 * ```tsx
 * const {
 *   query, setQuery,
 *   filters, setFilters,
 *   results, isLoading,
 *   hasMore, loadMore,
 *   suggestions, recentSearches
 * } = useMessageSearch();
 * ```
 */
export function useMessageSearch(): UseMessageSearchReturn {
  // ========================================================================
  // State
  // ========================================================================

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulatedResults, setAccumulatedResults] = useState<SearchResult[]>(
    []
  );

  // Track if this is a new search (query/filters changed) vs pagination
  const lastSearchRef = useRef<{
    query: string;
    filters: SearchFilters;
  } | null>(null);

  // Debounce the search query (300ms)
  const debouncedQuery = useDebounce(query.trim(), 300);

  // ========================================================================
  // Convex Queries
  // ========================================================================

  // Determine if we should search (minimum 2 characters)
  const shouldSearch = debouncedQuery.length >= 2;

  // Build search args
  const searchArgs = useMemo(() => {
    if (!shouldSearch) return "skip";

    return {
      query: debouncedQuery,
      channelId: filters.channelId,
      senderId: filters.senderId,
      contentType: filters.contentType,
      dateRange: filters.dateRange
        ? {
            start: filters.dateRange.start.getTime(),
            end: filters.dateRange.end.getTime(),
          }
        : undefined,
      cursor,
      limit: 20,
    };
  }, [debouncedQuery, filters, cursor, shouldSearch]);

  // Execute search query
  const searchResponse = useQuery(api.messages.search.searchMessages, searchArgs) as
    | {
        results: SearchResult[];
        nextCursor?: string;
        hasMore: boolean;
      }
    | undefined;

  // Get suggestions (recent unique queries)
  const suggestions = (useQuery(api.messages.search.getSuggestions) as string[] | undefined) ?? [];

  // Get recent searches with metadata
  const recentSearchesRaw = useQuery(
    api.messages.search.getRecent,
    { limit: 10 }
  ) as RecentSearch[] | undefined;
  const recentSearches = recentSearchesRaw ?? [];

  // ========================================================================
  // Mutations
  // ========================================================================

  const saveToHistory = useMutation(api.messages.search.saveToHistory);

  // ========================================================================
  // Effects
  // ========================================================================

  // Reset accumulated results when query or filters change
  useEffect(() => {
    const currentSearch = { query: debouncedQuery, filters };
    const lastSearch = lastSearchRef.current;

    // Check if this is a new search (not just pagination)
    const isNewSearch =
      !lastSearch ||
      lastSearch.query !== debouncedQuery ||
      JSON.stringify(lastSearch.filters) !== JSON.stringify(filters);

    if (isNewSearch) {
      setAccumulatedResults([]);
      setCursor(undefined);
      lastSearchRef.current = currentSearch;
    }
  }, [debouncedQuery, filters]);

  // Save to history when search completes with results
  useEffect(() => {
    if (
      shouldSearch &&
      searchResponse &&
      searchResponse.results.length > 0 &&
      !cursor // Only save on first page
    ) {
      // Fire and forget - don't await
      saveToHistory({
        query: debouncedQuery,
        resultCount: searchResponse.results.length,
      }).catch(() => {
        // Silently fail - history save is not critical
      });
    }
  }, [shouldSearch, searchResponse, debouncedQuery, cursor, saveToHistory]);

  // Update accumulated results when new page loads
  useEffect(() => {
    if (searchResponse) {
      if (cursor) {
        // Pagination - append to existing results
        setAccumulatedResults((prev) => {
          // Deduplicate by message ID
          const existingIds = new Set(prev.map((r) => r._id.toString()));
          const newResults = searchResponse.results.filter(
            (r) => !existingIds.has(r._id.toString())
          );
          return [...prev, ...newResults];
        });
      } else {
        // New search - replace results
        setAccumulatedResults(searchResponse.results);
      }
    }
  }, [searchResponse, cursor]);

  // ========================================================================
  // Handlers
  // ========================================================================

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const loadMore = useCallback(() => {
    if (searchResponse?.nextCursor) {
      setCursor(searchResponse.nextCursor);
    }
  }, [searchResponse?.nextCursor]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setFilters({});
    setCursor(undefined);
    setAccumulatedResults([]);
    lastSearchRef.current = null;
  }, []);

  // ========================================================================
  // Computed Values
  // ========================================================================

  const isLoading = shouldSearch && searchResponse === undefined;
  const hasMore = searchResponse?.hasMore ?? false;

  // Use accumulated results if we have them, otherwise use fresh results
  const results = accumulatedResults.length > 0 ? accumulatedResults : [];

  return {
    query,
    setQuery,
    filters,
    setFilters,
    clearFilters,
    results,
    isLoading,
    hasMore,
    loadMore,
    suggestions,
    recentSearches,
    clearSearch,
    debouncedQuery,
  };
}
