"use client";

import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, Hash, Lock } from "lucide-react";

import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChannelSearch } from "@/hooks/use-channel-search";

// ============================================================================
// Types
// ============================================================================

export interface ChannelSearchProps {
  className?: string;
  /** Called when dropdown opens/closes for external state sync */
  onOpenChange?: (open: boolean) => void;
}

// ============================================================================
// ChannelSearch Component
// ============================================================================

/**
 * ChannelSearch provides a search interface for finding channels.
 *
 * Features:
 * - Debounced search (300ms) with 2+ character minimum
 * - Keyboard navigation (Arrow Up/Down, Enter, Escape)
 * - Accessible with ARIA combobox pattern
 * - Shows channel type icon (# or lock), name, and member count
 *
 * @example
 * ```tsx
 * <ChannelSearch className="px-2" />
 * ```
 */
export function ChannelSearch({
  className,
  onOpenChange,
}: ChannelSearchProps): React.ReactElement {
  const router = useRouter();

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Refs for focus management
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // Use custom hook for search with debounce
  const {
    results: searchResults,
    isLoading,
    hasResults,
    isEmpty: showNoResults,
    debouncedTerm: debouncedSearchTerm,
  } = useChannelSearch(searchTerm, { minLength: 2, debounceMs: 300 });

  // Open dropdown when there are results or loading state
  const shouldShowDropdown = isOpen && (isLoading || hasResults || showNoResults);

  // Notify parent of open state changes
  useEffect(() => {
    onOpenChange?.(shouldShowDropdown);
  }, [shouldShowDropdown, onOpenChange]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchResults]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listboxRef.current) {
      const highlightedItem = listboxRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      );
      highlightedItem?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchTerm(value);
      setIsOpen(value.length > 0);
    },
    []
  );

  // Handle clear button
  const handleClear = useCallback(() => {
    setSearchTerm("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }, []);

  // Handle selecting a channel
  const handleSelectChannel = useCallback(
    (channelId: Id<"channels">) => {
      router.push(`/messages/${channelId}`);
      setSearchTerm("");
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [router]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!hasResults || !searchResults) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < searchResults.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
            const selectedChannel = searchResults[highlightedIndex];
            if (selectedChannel) {
              handleSelectChannel(selectedChannel._id);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          handleClear();
          break;
      }
    },
    [hasResults, searchResults, highlightedIndex, handleSelectChannel, handleClear]
  );

  // Handle focus events
  const handleFocus = useCallback(() => {
    if (searchTerm.length > 0) {
      setIsOpen(true);
    }
  }, [searchTerm]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Only close if focus moves outside the component
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      // Small delay to allow click events on results to fire
      setTimeout(() => {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }, 150);
    }
  }, []);

  // Generate unique IDs for accessibility
  const inputId = "channel-search-input";
  const listboxId = "channel-search-listbox";

  // Screen reader announcement for results count
  const resultsAnnouncement =
    hasResults && searchResults
      ? `${searchResults.length} channel${searchResults.length === 1 ? "" : "s"} found`
      : showNoResults
        ? "No channels found"
        : "";

  return (
    <div
      data-slot="channel-search"
      className={cn("relative", className)}
      onBlur={handleBlur}
    >
      {/* Search Input */}
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          id={inputId}
          type="text"
          placeholder="Search channels..."
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          className="h-8 pl-8 pr-8"
          // ARIA attributes for combobox pattern
          role="combobox"
          aria-expanded={shouldShowDropdown}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-activedescendant={
            highlightedIndex >= 0
              ? `channel-option-${highlightedIndex}`
              : undefined
          }
          aria-autocomplete="list"
        />
        {/* Clear button */}
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 size-6 -translate-y-1/2 p-0"
            onClick={handleClear}
            tabIndex={-1}
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {resultsAnnouncement}
      </div>

      {/* Dropdown Results */}
      {shouldShowDropdown && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label="Channel search results"
          className={cn(
            "absolute top-full left-0 right-0 z-50 mt-1",
            "rounded-md border bg-popover shadow-md",
            "max-h-64 overflow-hidden"
          )}
        >
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="sr-only">Searching channels...</span>
            </div>
          )}

          {/* No results state */}
          {showNoResults && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No channels found matching &quot;{debouncedSearchTerm}&quot;
              </p>
            </div>
          )}

          {/* Results list */}
          {hasResults && searchResults && (
            <ScrollArea className="max-h-64">
              <div className="p-1">
                {searchResults.map((channel, index) => (
                  <button
                    key={channel._id}
                    id={`channel-option-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={highlightedIndex === index}
                    onClick={() => handleSelectChannel(channel._id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                      "focus-visible:outline-none",
                      highlightedIndex === index
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    )}
                  >
                    {/* Channel type icon */}
                    {channel.type === "private" ? (
                      <Lock className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Hash className="size-4 shrink-0 text-muted-foreground" />
                    )}

                    {/* Channel name */}
                    <span className="flex-1 truncate font-medium">
                      {channel.name}
                    </span>

                    {/* Member count */}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {channel.memberCount} member{channel.memberCount === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
