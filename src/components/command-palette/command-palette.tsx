"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Hash, Clock, User, FileText, FolderOpen, BookOpen } from "lucide-react";
import { useQuery } from "convex/react";

// Use require pattern for Convex API to bypass TypeScript type inference
// This is a workaround for TS2589 "Type instantiation is excessively deep"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const convexApi = require("../../../convex/_generated/api");
const api = convexApi.api;

import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMessageSearch } from "@/hooks/use-message-search";
import { MessageContextDialog } from "@/components/messaging/message-context-dialog";
import { formatTimestamp } from "@/lib/message-utils";

// ============================================================================
// Types
// ============================================================================

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ChannelSearchResult {
  _id: Id<"channels">;
  name: string;
  description?: string;
  type: "public" | "private" | "course";
  memberCount: number;
}

interface KBDocumentSearchResult {
  _id: Id<"kbDocuments">;
  title: string;
  icon?: string;
  workspaceName: string;
  folderName: string;
  snippet?: string;
  updatedAt: number;
}

// ============================================================================
// CommandPalette Component
// ============================================================================

/**
 * CommandPalette - A keyboard-first search interface for channels and messages.
 *
 * Features:
 * - Opens with Ctrl+K / Cmd+K (handled by provider)
 * - Shows recent searches when query is empty
 * - Shows channel search results when query >= 2 characters
 * - Shows message search results when query >= 2 characters
 * - Keyboard navigation built into cmdk
 * - Footer with keyboard hints
 *
 * @example
 * ```tsx
 * <CommandPalette open={open} onOpenChange={setOpen} />
 * ```
 */
export function CommandPalette({
  open,
  onOpenChange,
}: CommandPaletteProps): React.ReactElement {
  const router = useRouter();

  // Message context dialog state
  const [selectedMessageId, setSelectedMessageId] =
    useState<Id<"messages"> | null>(null);
  const [isContextDialogOpen, setIsContextDialogOpen] = useState(false);

  // Use message search hook
  const {
    query,
    setQuery,
    results: messageResults,
    isLoading: isMessageLoading,
    suggestions,
    debouncedQuery,
  } = useMessageSearch();

  // Channel search query - only search when query has at least 2 characters
  // Backend validation requires searchTerm.length >= 2
  const channelSearchResults = useQuery(
    api.channels.search,
    query.trim().length >= 2 ? { searchTerm: query.trim() } : "skip"
  ) as ChannelSearchResult[] | undefined;

  const isChannelLoading = query.trim().length >= 2 && channelSearchResults === undefined;

  // Knowledge Base quick search - returns recent documents when empty, search results when query
  const kbSearchResults = useQuery(
    api.knowledge.search.quick,
    { query: query.trim(), limit: 5 }
  ) as KBDocumentSearchResult[] | undefined;

  const isKBLoading = kbSearchResults === undefined;

  // ========================================================================
  // Handlers
  // ========================================================================

  const handleChannelSelect = useCallback(
    (channelId: Id<"channels">) => {
      router.push(`/messages/${channelId}`);
      onOpenChange(false);
      setQuery("");
    },
    [router, onOpenChange, setQuery]
  );

  const handleMessageSelect = useCallback(
    (messageId: Id<"messages">) => {
      setSelectedMessageId(messageId);
      setIsContextDialogOpen(true);
      onOpenChange(false);
      setQuery("");
    },
    [onOpenChange, setQuery]
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      setQuery(suggestion);
    },
    [setQuery]
  );

  const handleCloseContextDialog = useCallback(() => {
    setIsContextDialogOpen(false);
    setSelectedMessageId(null);
  }, []);

  const handleKBDocumentSelect = useCallback(
    (documentId: Id<"kbDocuments">) => {
      router.push(`/knowledge/doc/${documentId}`);
      onOpenChange(false);
      setQuery("");
    },
    [router, onOpenChange, setQuery]
  );

  const handleKBSearchPage = useCallback(() => {
    router.push(`/knowledge/search?q=${encodeURIComponent(query)}`);
    onOpenChange(false);
    setQuery("");
  }, [router, query, onOpenChange, setQuery]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen);
      if (!newOpen) {
        setQuery("");
      }
    },
    [onOpenChange, setQuery]
  );

  // ========================================================================
  // Computed values
  // ========================================================================

  const hasQuery = query.trim().length > 0;
  const showSuggestions = !hasQuery && suggestions.length > 0;
  const showChannels = hasQuery && query.trim().length >= 2;
  const showMessages = hasQuery && debouncedQuery.length >= 2;
  const showKBResults = kbSearchResults && kbSearchResults.length > 0;

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>
            Search for channels, messages, and documents
          </DialogDescription>
        </DialogHeader>
        <DialogContent
          data-slot="command-palette"
          className={cn(
            // Override default center positioning for top 20%
            "top-[20%] translate-y-0",
            // Size and appearance
            "sm:max-w-xl p-0 gap-0 overflow-hidden"
          )}
          showCloseButton={false}
        >
          <Command
            className="rounded-xl"
            shouldFilter={false}
          >
            <CommandInput
              placeholder="Search channels, messages, and documents..."
              value={query}
              onValueChange={setQuery}
              aria-keyshortcuts={
                typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")
                  ? "Meta+k"
                  : "Control+k"
              }
            />
            <CommandList className="max-h-[400px]">
              <CommandEmpty>
                {isChannelLoading || isMessageLoading || isKBLoading ? (
                  <span className="text-muted-foreground">Searching...</span>
                ) : hasQuery ? (
                  <span className="text-muted-foreground">No results found.</span>
                ) : (
                  <span className="text-muted-foreground">
                    Start typing to search...
                  </span>
                )}
              </CommandEmpty>

              {/* Recent Searches / Suggestions */}
              {showSuggestions && (
                <CommandGroup heading="Recent Searches">
                  {suggestions.slice(0, 5).map((suggestion, index) => (
                    <CommandItem
                      key={`suggestion-${index}`}
                      value={`suggestion-${suggestion}`}
                      onSelect={() => handleSuggestionSelect(suggestion)}
                    >
                      <Clock className="size-4 text-muted-foreground" />
                      <span className="truncate">{suggestion}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Channels */}
              {showChannels && channelSearchResults && channelSearchResults.length > 0 && (
                <>
                  {showSuggestions && <CommandSeparator />}
                  <CommandGroup heading="Channels">
                    {channelSearchResults.slice(0, 10).map((channel) => (
                      <CommandItem
                        key={channel._id}
                        value={`channel-${channel._id}`}
                        onSelect={() => handleChannelSelect(channel._id)}
                      >
                        <Hash className="size-4 text-muted-foreground" />
                        <span className="font-medium">{channel.name}</span>
                        {channel.description && (
                          <span className="text-muted-foreground text-xs truncate ml-2">
                            {channel.description}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {channel.memberCount} {channel.memberCount === 1 ? "member" : "members"}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {/* Messages */}
              {showMessages && messageResults.length > 0 && (
                <>
                  {(showSuggestions || (showChannels && channelSearchResults && channelSearchResults.length > 0)) && (
                    <CommandSeparator />
                  )}
                  <CommandGroup heading="Messages">
                    {messageResults.slice(0, 10).map((message) => (
                      <CommandItem
                        key={message._id}
                        value={`message-${message._id}`}
                        onSelect={() => handleMessageSelect(message._id)}
                        className="flex-col items-start gap-1 py-2"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <User className="size-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm">
                            {message.senderName}
                          </span>
                          {message.channelName && (
                            <span className="text-muted-foreground text-xs flex items-center gap-1">
                              in <Hash className="size-3" />
                              {message.channelName}
                            </span>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground shrink-0">
                            {formatTimestamp(message.createdAt)}
                          </span>
                        </div>
                        <div className="pl-6 text-sm text-muted-foreground truncate w-full">
                          {message.content}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {/* Knowledge Base Documents */}
              {showKBResults && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Knowledge Base">
                    {kbSearchResults.slice(0, 5).map((doc) => (
                      <CommandItem
                        key={doc._id}
                        value={`kb-${doc._id}`}
                        onSelect={() => handleKBDocumentSelect(doc._id)}
                        className="flex-col items-start gap-1 py-2"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <FileText className="size-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">
                            {doc.icon && <span className="mr-1">{doc.icon}</span>}
                            {doc.title}
                          </span>
                        </div>
                        {doc.snippet && (
                          <div className="pl-6 text-sm text-muted-foreground truncate w-full">
                            {doc.snippet}
                          </div>
                        )}
                        <div className="pl-6 flex items-center gap-1 text-xs text-muted-foreground">
                          <FolderOpen className="size-3" />
                          <span className="truncate">
                            {doc.workspaceName} / {doc.folderName}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                    {/* Link to advanced KB search */}
                    {hasQuery && query.length >= 2 && (
                      <CommandItem
                        value="kb-search-page"
                        onSelect={handleKBSearchPage}
                        className="text-muted-foreground"
                      >
                        <BookOpen className="size-4" />
                        <span>
                          Search Knowledge Base for &quot;{query}&quot;...
                        </span>
                      </CommandItem>
                    )}
                  </CommandGroup>
                </>
              )}
            </CommandList>

            {/* Footer with keyboard hints */}
            <div className="flex items-center justify-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  ↵
                </kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  esc
                </kbd>
                Close
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Message Context Dialog */}
      <MessageContextDialog
        messageId={selectedMessageId}
        isOpen={isContextDialogOpen}
        onClose={handleCloseContextDialog}
      />
    </>
  );
}
