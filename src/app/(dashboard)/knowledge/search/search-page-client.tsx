"use client";

import { type ReactElement, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Sparkles, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearch } from "@/hooks/knowledge/use-search";
import { SearchResults } from "@/components/knowledge/search/search-results";
import { SearchFilters } from "@/components/knowledge/search/search-filters";

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * SearchPageClient - Client component for the Knowledge Base search page.
 *
 * Features:
 * - Full-text search with real-time results
 * - Filter sidebar (status, date range)
 * - Toggle between keyword and semantic (AI) search modes
 * - URL query parameter sync
 * - Pagination with "Load more" button
 *
 * @example
 * ```tsx
 * // In server component:
 * <Suspense fallback={<SearchPageSkeleton />}>
 *   <SearchPageClient />
 * </Suspense>
 * ```
 */
export function SearchPageClient(): ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get initial values from URL
  const initialQuery = searchParams.get("q") || "";
  const initialMode = searchParams.get("mode") === "semantic" ? "semantic" : "keyword";

  const {
    query,
    setQuery,
    mode,
    setMode,
    filters,
    setFilters,
    results,
    isLoading,
    isLoadingMore,
    trackSearch,
    loadMore,
  } = useSearch({ initialMode, debounceMs: 300 });

  // Set initial query from URL on mount
  useEffect(() => {
    if (initialQuery && !query) {
      setQuery(initialQuery);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL when query changes (debounced)
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }

    if (mode === "semantic") {
      params.set("mode", "semantic");
    } else {
      params.delete("mode");
    }

    const newUrl = params.toString() ? `?${params.toString()}` : "";
    router.replace(`/knowledge/search${newUrl}`, { scroll: false });
  }, [query, mode, searchParams, router]);

  // Track search when results load
  useEffect(() => {
    if (results?.results) {
      trackSearch(results.results.length);
    }
  }, [results, trackSearch]);

  // Handle search input change
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [setQuery]
  );

  // Handle mode toggle
  const handleModeChange = useCallback(
    (newMode: "keyword" | "semantic") => {
      setMode(newMode);
    },
    [setMode]
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Filters sidebar - collapsed on mobile */}
      <aside className="w-full lg:w-64 shrink-0 order-2 lg:order-1">
        <SearchFilters filters={filters} onChange={setFilters} />
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 order-1 lg:order-2">
        {/* Search input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={handleQueryChange}
            placeholder="Search documents..."
            className="pl-10"
            autoFocus
          />
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={mode === "keyword" ? "default" : "outline"}
            size="sm"
            onClick={() => handleModeChange("keyword")}
          >
            <Zap className="mr-2 h-4 w-4" />
            Keyword
          </Button>
          <Button
            variant={mode === "semantic" ? "default" : "outline"}
            size="sm"
            onClick={() => handleModeChange("semantic")}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            AI Search
          </Button>
        </div>

        {/* Results */}
        <SearchResults
          results={results?.results}
          isLoading={isLoading}
          emptyMessage={
            query.length < 2
              ? "Enter at least 2 characters to search."
              : "No documents found matching your search."
          }
        />

        {/* Pagination */}
        {results?.hasMore && (
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}

        {/* Result count */}
        {results && results.totalCount !== undefined && results.totalCount > 0 && (
          <p className="mt-4 text-sm text-muted-foreground text-center">
            Showing {results.results.length} of {results.totalCount} results
          </p>
        )}
      </main>
    </div>
  );
}
