"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";

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

/** Simplified channel type for search results display */
export interface ChannelSearchResult {
  _id: Id<"channels">;
  name: string;
  type: "public" | "private" | "course";
  memberCount: number;
}

export interface UseChannelSearchOptions {
  /** Minimum characters before triggering search (default: 2) */
  minLength?: number;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
}

export interface UseChannelSearchReturn {
  /** The search results (undefined when loading, empty array when no results) */
  results: ChannelSearchResult[] | undefined;
  /** Whether the search is currently loading */
  isLoading: boolean;
  /** Whether there are results */
  hasResults: boolean;
  /** Whether search returned no results (different from not searching) */
  isEmpty: boolean;
  /** The debounced search term being used */
  debouncedTerm: string;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for searching channels with debounce.
 *
 * Handles the Convex query type complexity internally and returns
 * simplified, strongly-typed results.
 *
 * @param searchTerm - The raw search input from user
 * @param options - Configuration options
 * @returns Search state and results
 *
 * @example
 * ```tsx
 * const { results, isLoading, hasResults, isEmpty } = useChannelSearch(searchTerm);
 * ```
 */
export function useChannelSearch(
  searchTerm: string,
  options: UseChannelSearchOptions = {}
): UseChannelSearchReturn {
  const { minLength = 2, debounceMs = 300 } = options;

  // Debounce the search term
  const debouncedTerm = useDebounce(searchTerm.trim(), debounceMs);

  // Only search when we have enough characters
  const shouldSearch = debouncedTerm.length >= minLength;

  // Construct args outside useQuery to avoid type inference issues
  const queryArgs = shouldSearch ? { searchTerm: debouncedTerm } : "skip";

  // Execute the query - api is already untyped via require() above
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawResults = useQuery(api.channels.search, queryArgs as any);

  // Map to simplified result type for component use
  const results = useMemo((): ChannelSearchResult[] | undefined => {
    if (!shouldSearch) return undefined;
    if (rawResults === undefined) return undefined;
    if (!Array.isArray(rawResults)) return [];

    return rawResults.map((channel: {
      _id: Id<"channels">;
      name: string;
      type: "public" | "private" | "course";
      memberCount: number;
    }) => ({
      _id: channel._id,
      name: channel.name,
      type: channel.type,
      memberCount: channel.memberCount,
    }));
  }, [rawResults, shouldSearch]);

  // Compute derived state
  const isLoading = shouldSearch && results === undefined;
  const hasResults = Boolean(results && results.length > 0);
  const isEmpty = shouldSearch && results !== undefined && results.length === 0;

  return {
    results,
    isLoading,
    hasResults,
    isEmpty,
    debouncedTerm,
  };
}
