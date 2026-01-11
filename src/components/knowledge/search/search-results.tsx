"use client";

import { type ReactElement } from "react";
import Link from "next/link";
import { FileText, Calendar, FolderOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SearchResult } from "@/hooks/knowledge/use-search";

// ============================================================================
// TYPES
// ============================================================================

interface SearchResultsProps {
  /** Search results to display */
  results: SearchResult[] | undefined;
  /** Whether results are loading */
  isLoading?: boolean;
  /** Message to show when no results found */
  emptyMessage?: string;
}

interface HighlightedSnippetProps {
  /** Text to display */
  text: string;
  /** Terms to highlight */
  highlights: string[];
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * HighlightedSnippet - Renders text with highlighted matching terms.
 *
 * @param text - The snippet text to display
 * @param highlights - Array of terms to highlight
 */
function HighlightedSnippet({
  text,
  highlights,
}: HighlightedSnippetProps): ReactElement {
  if (!highlights.length) {
    return <>{text}</>;
  }

  // Escape special regex characters in highlight terms
  const escapedHighlights = highlights.map((h) =>
    h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );

  // Create regex to match any of the highlight terms
  const regex = new RegExp(`(${escapedHighlights.join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        highlights.some((h) => h.toLowerCase() === part.toLowerCase()) ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/**
 * SearchResultsSkeleton - Loading skeleton for search results.
 */
function SearchResultsSkeleton(): ReactElement {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex items-center gap-4 pt-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * SearchResultsEmpty - Empty state when no results found.
 *
 * @param message - Custom message to display
 */
function SearchResultsEmpty({ message }: { message: string }): ReactElement {
  return (
    <div className="py-12 text-center">
      <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
      <p className="mt-4 text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * SearchResults - Displays search results as a list of cards.
 *
 * Features:
 * - Loading skeleton state
 * - Empty state with custom message
 * - Highlighted search terms in snippets
 * - Document metadata (workspace, folder, author, date)
 * - Optional relevance score display
 *
 * @example
 * ```tsx
 * <SearchResults
 *   results={searchResults}
 *   isLoading={isLoading}
 *   emptyMessage="No documents match your search."
 * />
 * ```
 */
export function SearchResults({
  results,
  isLoading,
  emptyMessage = "No documents found. Try a different search term.",
}: SearchResultsProps): ReactElement {
  if (isLoading) {
    return <SearchResultsSkeleton />;
  }

  if (!results || results.length === 0) {
    return <SearchResultsEmpty message={emptyMessage} />;
  }

  return (
    <div className="space-y-4" data-slot="search-results">
      {results.map((result) => (
        <Link key={result._id} href={`/knowledge/doc/${result._id}`}>
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h3 className="font-medium flex items-center gap-2 truncate">
                    {result.icon && (
                      <span className="shrink-0">{result.icon}</span>
                    )}
                    <span className="truncate">{result.title}</span>
                  </h3>

                  {/* Snippet with highlighted terms */}
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    <HighlightedSnippet
                      text={result.snippet}
                      highlights={result.highlightedTerms}
                    />
                  </p>

                  {/* Metadata row */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {/* Workspace / Folder */}
                    <span className="flex items-center gap-1">
                      <FolderOpen className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[200px]">
                        {result.workspace.name} / {result.folder.name}
                      </span>
                    </span>

                    {/* Author */}
                    <span className="flex items-center gap-1.5">
                      <Avatar size="sm" className="h-4 w-4">
                        {result.creator.avatarUrl && (
                          <AvatarImage
                            src={result.creator.avatarUrl}
                            alt={result.creator.name}
                          />
                        )}
                        <AvatarFallback className="text-[8px]">
                          {result.creator.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate max-w-[100px]">
                        {result.creator.name}
                      </span>
                    </span>

                    {/* Date */}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {formatDistanceToNow(result.updatedAt, {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>

                {/* Relevance score (for semantic search) */}
                {result.relevanceScore !== undefined && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {Math.round(result.relevanceScore * 100)}% match
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export { SearchResultsSkeleton, SearchResultsEmpty };
