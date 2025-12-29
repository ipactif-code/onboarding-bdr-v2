"use client";

import * as React from "react";
import { useMemo, useCallback } from "react";
import { Hash, Loader2, MessageSquare } from "lucide-react";

import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { getInitials, formatTimestamp } from "@/lib/message-utils";
import type { SearchResult } from "@/hooks/use-message-search";

// ============================================================================
// Types
// ============================================================================

export interface SearchResultsProps {
  /** The search query (used for highlighting) */
  query: string;
  /** Array of search results */
  results: SearchResult[];
  /** Whether the search is loading */
  isLoading: boolean;
  /** Whether there are more results to load */
  hasMore: boolean;
  /** Callback to load more results */
  onLoadMore: () => void;
  /** Callback when a result is clicked */
  onResultClick: (messageId: Id<"messages">) => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Helper: Highlight Matches
// ============================================================================

/**
 * Highlights search terms in text by wrapping matches in <mark> elements.
 * Handles case-insensitive matching and preserves original text casing.
 */
function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query.trim()) {
    return text;
  }

  // Escape special regex characters in the query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Split query into words for multi-word matching
  const words = escapedQuery.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return text;
  }

  // Create regex pattern that matches any of the words
  const pattern = new RegExp(`(${words.join("|")})`, "gi");

  // Split text by matches
  const parts = text.split(pattern);

  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, index) => {
    // Check if this part matches any of the search words
    const isMatch = words.some(
      (word) => part.toLowerCase() === word.toLowerCase()
    );

    if (isMatch) {
      return (
        <mark
          key={index}
          className="bg-yellow-200 text-yellow-900 dark:bg-yellow-700 dark:text-yellow-100 rounded-sm px-0.5"
        >
          {part}
        </mark>
      );
    }

    return part;
  });
}

/**
 * Truncates content around the first match to show context.
 * Returns a snippet with ellipsis if truncated.
 */
function getSnippet(content: string, query: string, maxLength = 150): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Find first occurrence of any query word
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const lowerContent = content.toLowerCase();

  let firstMatchIndex = -1;
  for (const word of words) {
    const idx = lowerContent.indexOf(word);
    if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
      firstMatchIndex = idx;
    }
  }

  // If no match found, return beginning of content
  if (firstMatchIndex === -1) {
    return content.substring(0, maxLength) + "...";
  }

  // Calculate start position to center the match
  const contextBefore = 40;
  const start = Math.max(0, firstMatchIndex - contextBefore);
  const end = Math.min(content.length, start + maxLength);

  let snippet = content.substring(start, end);

  // Add ellipsis if truncated
  if (start > 0) {
    snippet = "..." + snippet;
  }
  if (end < content.length) {
    snippet = snippet + "...";
  }

  return snippet;
}

// ============================================================================
// SearchResultItem Component
// ============================================================================

interface SearchResultItemProps {
  result: SearchResult;
  query: string;
  onClick: (messageId: Id<"messages">) => void;
}

function SearchResultItem({
  result,
  query,
  onClick,
}: SearchResultItemProps): React.ReactElement {
  const handleClick = useCallback(() => {
    onClick(result._id);
  }, [onClick, result._id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick(result._id);
      }
    },
    [onClick, result._id]
  );

  const snippet = useMemo(
    () => getSnippet(result.content, query),
    [result.content, query]
  );

  const highlightedContent = useMemo(
    () => highlightMatches(snippet, query),
    [snippet, query]
  );

  return (
    <div
      role="option"
      aria-selected={false}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex gap-3 px-3 py-2.5 cursor-pointer transition-colors",
        "hover:bg-accent focus-visible:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "border-b border-border/50 last:border-b-0"
      )}
      aria-label={`Message from ${result.senderName} in ${result.channelName ?? "direct message"}`}
    >
      {/* Avatar */}
      <Avatar size="sm" className="mt-0.5 shrink-0">
        {result.senderAvatarUrl ? (
          <AvatarImage src={result.senderAvatarUrl} alt={result.senderName} />
        ) : null}
        <AvatarFallback>{getInitials(result.senderName)}</AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header: sender, channel, timestamp */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {result.senderName}
          </span>

          {result.channelName && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="size-3" aria-hidden="true" />
              {result.channelName}
            </span>
          )}

          {result.conversationId && !result.channelName && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="size-3" aria-hidden="true" />
              Direct message
            </span>
          )}

          <span className="text-xs text-muted-foreground">
            {formatTimestamp(result.createdAt)}
          </span>
        </div>

        {/* Message preview with highlighted matches */}
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2 break-words">
          {highlightedContent}
        </p>

        {/* Content type badge for non-text messages */}
        {result.contentType !== "text" && (
          <span
            className={cn(
              "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              result.contentType === "voice" &&
                "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
              result.contentType === "file" &&
                "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            )}
          >
            {result.contentType === "voice" && "Voice message"}
            {result.contentType === "file" && "File attachment"}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SearchResults Component
// ============================================================================

/**
 * SearchResults displays a list of message search results with highlighting.
 *
 * Features:
 * - Highlights search terms in message content
 * - Shows sender avatar, name, channel, and timestamp
 * - Loading skeleton while searching
 * - Empty state when no results
 * - "Load more" button for pagination
 * - Click to select a result
 *
 * @example
 * ```tsx
 * <SearchResults
 *   query="hello world"
 *   results={searchResults}
 *   isLoading={false}
 *   hasMore={true}
 *   onLoadMore={() => loadMoreResults()}
 *   onResultClick={(messageId) => openMessage(messageId)}
 * />
 * ```
 */
export function SearchResults({
  query,
  results,
  isLoading,
  hasMore,
  onLoadMore,
  onResultClick,
  className,
}: SearchResultsProps): React.ReactElement {
  // ========================================================================
  // Loading State
  // ========================================================================

  if (isLoading && results.length === 0) {
    return (
      <div
        data-slot="search-results"
        className={cn("p-2", className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <SearchResultsSkeleton />
        <span className="sr-only">Searching messages...</span>
      </div>
    );
  }

  // ========================================================================
  // Empty State
  // ========================================================================

  if (!isLoading && results.length === 0) {
    return (
      <div
        data-slot="search-results"
        className={cn(
          "flex flex-col items-center justify-center py-8 px-4 text-center",
          className
        )}
      >
        <MessageSquare className="size-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          No messages found
        </p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          Try different keywords or adjust your filters
        </p>
      </div>
    );
  }

  // ========================================================================
  // Results List
  // ========================================================================

  return (
    <div data-slot="search-results" className={cn(className)}>
      <ScrollArea className="max-h-[50vh]">
        {/* Results count */}
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
          {results.length} result{results.length !== 1 ? "s" : ""} found
          {hasMore && " (more available)"}
        </div>

        {/* Results list */}
        <div role="listbox" aria-label="Search results">
          {results.map((result) => (
            <SearchResultItem
              key={result._id}
              result={result}
              query={query}
              onClick={onResultClick}
            />
          ))}
        </div>

        {/* Load more button */}
        {hasMore && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load more results"
              )}
            </Button>
          </div>
        )}

        {/* Loading indicator for pagination */}
        {isLoading && results.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <span className="sr-only">Loading more results...</span>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// SearchResults Skeleton
// ============================================================================

export function SearchResultsSkeleton(): React.ReactElement {
  return (
    <div
      data-slot="search-results-skeleton"
      className="space-y-1"
      role="status"
      aria-busy="true"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-3 py-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading search results</span>
    </div>
  );
}
