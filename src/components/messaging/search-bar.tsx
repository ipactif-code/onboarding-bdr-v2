"use client";

import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search,
  X,
  Filter,
  Clock,
  Hash,
  FileText,
  Mic,
  FileIcon,
  ChevronDown,
} from "lucide-react";
import { useQuery } from "convex/react";

// Import api using require to completely bypass TypeScript type inference
// eslint-disable-next-line @typescript-eslint/no-require-imports
const convexApi = require("../../../convex/_generated/api");
const api = convexApi.api;

import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessageSearch } from "@/hooks/use-message-search";
import { SearchResults } from "./search-results";

// ============================================================================
// Types
// ============================================================================

export interface SearchBarProps {
  /** Called when a search result is selected */
  onResultSelect?: (messageId: Id<"messages">) => void;
  /** Called when a channel search result is selected */
  onChannelSelect?: (channelId: Id<"channels">) => void;
  /** Additional CSS classes */
  className?: string;
}

interface ChannelOption {
  _id: Id<"channels">;
  name: string;
  type: "public" | "private" | "course";
}

interface ChannelSearchResult {
  _id: Id<"channels">;
  name: string;
  type: "public" | "private" | "course";
  description?: string;
  memberCount: number;
}

// ============================================================================
// SearchBar Component
// ============================================================================

/**
 * SearchBar provides a comprehensive search interface for messages.
 *
 * Features:
 * - Full-text search with debounce (300ms)
 * - Filter dropdown for channel, sender, date range, and content type
 * - Suggestions dropdown showing recent searches
 * - Keyboard shortcut hint (Ctrl+K / Cmd+K)
 * - Clear button to reset search
 * - Accessible with ARIA combobox pattern
 *
 * @example
 * ```tsx
 * <SearchBar onResultSelect={(messageId) => openMessage(messageId)} />
 * ```
 */
export function SearchBar({
  onResultSelect,
  onChannelSelect,
  className,
}: SearchBarProps): React.ReactElement {
  // ========================================================================
  // State
  // ========================================================================

  const [isOpen, setIsOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Filter UI state
  const [channelFilterOpen, setChannelFilterOpen] = useState(false);
  const [contentTypeFilterOpen, setContentTypeFilterOpen] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ========================================================================
  // Hooks
  // ========================================================================

  const {
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
    clearSearch,
    debouncedQuery,
  } = useMessageSearch();

  // Fetch user's channels for filter dropdown
  const channelsList = useQuery(api.channels.queries.list) as
    | { channels: ChannelOption[] }
    | undefined;
  const channels = channelsList?.channels ?? [];

  // Fetch channel search results (only when query has 2+ characters)
  const channelSearchResults = useQuery(
    api.channels.queries.search,
    debouncedQuery.length >= 2 ? { searchTerm: debouncedQuery } : "skip"
  ) as ChannelSearchResult[] | undefined;
  const isChannelSearchLoading =
    debouncedQuery.length >= 2 && channelSearchResults === undefined;

  // ========================================================================
  // Computed values
  // ========================================================================

  const hasActiveFilters =
    filters.channelId ||
    filters.senderId ||
    filters.dateRange ||
    filters.contentType;

  const activeFiltersCount = [
    filters.channelId,
    filters.senderId,
    filters.dateRange,
    filters.contentType,
  ].filter(Boolean).length;

  const shouldShowDropdown = isOpen && (query.length > 0 || suggestions.length > 0);
  const showResults = debouncedQuery.length >= 2;

  // Get selected channel name for display
  const selectedChannel = filters.channelId
    ? channels.find((c) => c._id === filters.channelId)
    : undefined;

  // ========================================================================
  // Handlers
  // ========================================================================

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setIsOpen(true);
      setHighlightedIndex(-1);
    },
    [setQuery]
  );

  const handleClear = useCallback(() => {
    clearSearch();
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }, [clearSearch]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setQuery(suggestion);
      setIsOpen(true);
      inputRef.current?.focus();
    },
    [setQuery]
  );

  const handleResultSelect = useCallback(
    (messageId: Id<"messages">) => {
      onResultSelect?.(messageId);
      setIsOpen(false);
    },
    [onResultSelect]
  );

  const handleChannelResultSelect = useCallback(
    (channelId: Id<"channels">) => {
      onChannelSelect?.(channelId);
      setIsOpen(false);
    },
    [onChannelSelect]
  );

  const handleChannelFilter = useCallback(
    (channelId: Id<"channels"> | undefined) => {
      setFilters({ ...filters, channelId });
      setChannelFilterOpen(false);
    },
    [filters, setFilters]
  );

  const handleContentTypeFilter = useCallback(
    (contentType: "text" | "voice" | "file" | undefined) => {
      setFilters({ ...filters, contentType });
      setContentTypeFilterOpen(false);
    },
    [filters, setFilters]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        return;
      }

      // If showing suggestions (not results)
      if (!showResults && suggestions.length > 0) {
        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setHighlightedIndex((prev) =>
              prev < suggestions.length - 1 ? prev + 1 : prev
            );
            break;
          case "ArrowUp":
            e.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
            break;
          case "Enter":
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
              const selected = suggestions[highlightedIndex];
              if (selected) {
                handleSuggestionClick(selected);
              }
            }
            break;
        }
      }
    },
    [showResults, suggestions, highlightedIndex, handleSuggestionClick]
  );

  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Only close if focus moves outside the container
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (
      !relatedTarget ||
      !containerRef.current?.contains(relatedTarget)
    ) {
      setTimeout(() => {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }, 150);
    }
  }, []);

  // ========================================================================
  // Keyboard shortcut (Ctrl+K / Cmd+K)
  // ========================================================================

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return (): void => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  // ========================================================================
  // IDs for accessibility
  // ========================================================================

  const inputId = "message-search-input";
  const listboxId = "message-search-listbox";

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div
      ref={containerRef}
      data-slot="search-bar"
      className={cn("relative", className)}
      onBlur={handleBlur}
    >
      {/* Search Input Row */}
      <div className="flex items-center gap-2">
        {/* Main search input */}
        <div className="relative flex-1">
          <Search
            className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            id={inputId}
            type="text"
            placeholder="Search messages..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            className="h-9 pl-9 pr-20"
            role="combobox"
            aria-expanded={shouldShowDropdown}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            aria-autocomplete="list"
          />

          {/* Keyboard shortcut hint */}
          {!query && (
            <kbd className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-foreground/80 sm:flex">
              <span className="text-xs">
                {typeof navigator !== "undefined" &&
                navigator.userAgent.includes("Mac")
                  ? "Cmd"
                  : "Ctrl"}
              </span>
              K
            </kbd>
          )}

          {/* Clear button */}
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2 p-0"
              onClick={handleClear}
              tabIndex={-1}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        {/* Filter button */}
        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger
            render={
              <Button
                variant={hasActiveFilters ? "secondary" : "outline"}
                size="sm"
                className="h-9 gap-1.5"
                aria-label={`Filters${activeFiltersCount > 0 ? ` (${activeFiltersCount} active)` : ""}`}
              />
            }
          >
            <Filter className="size-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {activeFiltersCount}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Search Filters</h4>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs"
                    onClick={clearFilters}
                  >
                    Clear all
                  </Button>
                )}
              </div>

              {/* Channel filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Hash className="size-3" />
                  Channel
                </label>
                <Popover
                  open={channelFilterOpen}
                  onOpenChange={setChannelFilterOpen}
                >
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-between h-8"
                      />
                    }
                  >
                    <span className="truncate">
                      {selectedChannel?.name ?? "All channels"}
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search channels..." />
                      <CommandList>
                        <CommandEmpty>No channels found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => handleChannelFilter(undefined)}
                          >
                            All channels
                          </CommandItem>
                          {channels.map((channel) => (
                            <CommandItem
                              key={channel._id}
                              onSelect={() => handleChannelFilter(channel._id)}
                              data-checked={
                                filters.channelId === channel._id
                                  ? "true"
                                  : undefined
                              }
                            >
                              <Hash className="mr-2 size-4 text-muted-foreground" />
                              {channel.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Content type filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <FileText className="size-3" />
                  Message Type
                </label>
                <Popover
                  open={contentTypeFilterOpen}
                  onOpenChange={setContentTypeFilterOpen}
                >
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-between h-8"
                      />
                    }
                  >
                    <span className="flex items-center gap-2">
                      {filters.contentType === "text" && (
                        <>
                          <FileText className="size-4" />
                          Text messages
                        </>
                      )}
                      {filters.contentType === "voice" && (
                        <>
                          <Mic className="size-4" />
                          Voice messages
                        </>
                      )}
                      {filters.contentType === "file" && (
                        <>
                          <FileIcon className="size-4" />
                          File attachments
                        </>
                      )}
                      {!filters.contentType && "All types"}
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-0" align="start">
                    <Command>
                      <CommandList>
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => handleContentTypeFilter(undefined)}
                          >
                            All types
                          </CommandItem>
                          <CommandItem
                            onSelect={() => handleContentTypeFilter("text")}
                            data-checked={
                              filters.contentType === "text"
                                ? "true"
                                : undefined
                            }
                          >
                            <FileText className="mr-2 size-4" />
                            Text messages
                          </CommandItem>
                          <CommandItem
                            onSelect={() => handleContentTypeFilter("voice")}
                            data-checked={
                              filters.contentType === "voice"
                                ? "true"
                                : undefined
                            }
                          >
                            <Mic className="mr-2 size-4" />
                            Voice messages
                          </CommandItem>
                          <CommandItem
                            onSelect={() => handleContentTypeFilter("file")}
                            data-checked={
                              filters.contentType === "file"
                                ? "true"
                                : undefined
                            }
                          >
                            <FileIcon className="mr-2 size-4" />
                            File attachments
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Active filters summary */}
              {hasActiveFilters && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {activeFiltersCount} filter
                    {activeFiltersCount !== 1 ? "s" : ""} applied
                  </p>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Dropdown: Suggestions or Results */}
      {shouldShowDropdown && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions and results"
          className={cn(
            "absolute top-full left-0 right-0 z-50 mt-2",
            "rounded-lg border bg-popover shadow-lg",
            "max-h-[70vh] overflow-hidden"
          )}
        >
          {/* Show suggestions when query is short or empty */}
          {!showResults && (
            <ScrollArea className="max-h-64">
              {suggestions.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Recent searches
                  </p>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        highlightedIndex === index &&
                          "bg-accent text-accent-foreground"
                      )}
                      onClick={() => handleSuggestionClick(suggestion)}
                      role="option"
                      aria-selected={highlightedIndex === index}
                    >
                      <Clock className="size-4 text-muted-foreground" />
                      <span className="flex-1 truncate text-left">
                        {suggestion}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {suggestions.length === 0 && query.length > 0 && query.length < 2 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Type at least 2 characters to search
                </div>
              )}
            </ScrollArea>
          )}

          {/* Show results when query is 2+ characters */}
          {showResults && (
            <ScrollArea className="max-h-[60vh]">
              {/* Channels Section */}
              {(isChannelSearchLoading ||
                (channelSearchResults && channelSearchResults.length > 0)) && (
                <div className="border-b">
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                    Channels ({channelSearchResults?.length ?? 0})
                  </div>
                  {isChannelSearchLoading ? (
                    <div className="p-2 space-y-1">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2">
                          <Skeleton className="h-4 w-4 rounded" />
                          <div className="flex-1 space-y-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-1">
                      {channelSearchResults?.map((channel) => (
                        <div
                          key={channel._id}
                          role="option"
                          aria-selected={false}
                          tabIndex={0}
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => handleChannelResultSelect(channel._id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleChannelResultSelect(channel._id);
                            }
                          }}
                        >
                          <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate text-sm">
                              {channel.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {channel.type === "public"
                                ? "Public"
                                : channel.type === "private"
                                  ? "Private"
                                  : "Course"}
                              {channel.memberCount !== undefined &&
                                ` \u00B7 ${channel.memberCount} member${channel.memberCount !== 1 ? "s" : ""}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* No channels found message (only show if search returned empty) */}
              {!isChannelSearchLoading &&
                channelSearchResults &&
                channelSearchResults.length === 0 &&
                results.length === 0 &&
                !isLoading && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No channels match &quot;{debouncedQuery}&quot;
                  </div>
                )}

              {/* Messages Section */}
              <div>
                {(isLoading || results.length > 0) && (
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                    Messages ({results.length})
                  </div>
                )}
                <SearchResults
                  query={debouncedQuery}
                  results={results}
                  isLoading={isLoading}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  onResultClick={handleResultSelect}
                />
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {showResults && !isLoading && !isChannelSearchLoading && (
          <span>
            {channelSearchResults?.length ?? 0} channel
            {(channelSearchResults?.length ?? 0) !== 1 ? "s" : ""} and{" "}
            {results.length} message{results.length !== 1 ? "s" : ""} found
          </span>
        )}
        {showResults &&
          !isLoading &&
          !isChannelSearchLoading &&
          results.length === 0 &&
          (channelSearchResults?.length ?? 0) === 0 && (
            <span>No results found</span>
          )}
      </div>
    </div>
  );
}

// ============================================================================
// SearchBar Skeleton
// ============================================================================

export function SearchBarSkeleton(): React.ReactElement {
  return (
    <div data-slot="search-bar-skeleton" className="flex items-center gap-2">
      <Skeleton className="h-9 flex-1" />
      <Skeleton className="h-9 w-24" />
    </div>
  );
}
