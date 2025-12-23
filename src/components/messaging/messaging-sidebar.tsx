"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Plus, Search, X, Loader2 } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QuickNavigation } from "./quick-navigation";
import { CollapsibleSection } from "./collapsible-section";
import { FavoritesList } from "./favorites-list";
import { ChannelListItem } from "./sidebar/channel-list-item";
import { DMListItem } from "./sidebar/dm-list-item";
import { OnlineIndicator, type Status } from "./online-indicator";

// ============================================================================
// Types
// ============================================================================

interface UserSearchResult {
  _id: Id<"users">;
  name: string;
  email: string;
  avatarUrl?: string;
  status: "online" | "away" | "dnd" | "offline";
}

// ============================================================================
// NewDMDialog Component
// ============================================================================

interface NewDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function NewDMDialog({
  open,
  onOpenChange,
}: NewDMDialogProps): React.ReactElement {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const searchResults = useQuery(
    api.directMessages.searchUsers,
    searchQuery.trim().length >= 2
      ? { query: searchQuery.trim(), limit: 10 }
      : "skip"
  );

  const getOrCreateDirect = useMutation(api.messages.getOrCreateDirect);

  const handleUserSelect = useCallback(
    async (userId: Id<"users">) => {
      try {
        setIsCreating(true);
        const conversationId = await getOrCreateDirect({ otherUserId: userId });
        onOpenChange(false);
        setSearchQuery("");
        router.push(`/messages/dm/${conversationId}`);
      } catch {
        // Error handled silently - toast could be added here
      } finally {
        setIsCreating(false);
      }
    },
    [getOrCreateDirect, onOpenChange, router]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Search for a user to start a conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 size-7 -translate-y-1/2 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="size-4" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
          </div>

          {/* Search results */}
          <ScrollArea className="h-64">
            {searchQuery.trim().length < 2 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="mb-2 size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Type at least 2 characters to search
                </p>
              </div>
            ) : searchResults === undefined ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No users found matching &quot;{searchQuery}&quot;
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {searchResults.map((user: UserSearchResult) => (
                  <button
                    key={user._id}
                    onClick={() => handleUserSelect(user._id)}
                    disabled={isCreating}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:pointer-events-none disabled:opacity-50"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="size-9">
                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                        <AvatarFallback>
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      {/* Status indicator using OnlineIndicator component */}
                      <OnlineIndicator
                        status={user.status as Status}
                        size="sm"
                        showAsBadge
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{user.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MessagingSidebar Component
// ============================================================================

export interface MessagingSidebarProps {
  className?: string;
}

/**
 * MessagingSidebar provides a Slack-like interface with:
 * - Quick navigation links at top (Unread, Threads, Mentions, Drafts)
 * - Collapsible Favorites section (mixed channels + DMs)
 * - Collapsible Channels section
 * - Collapsible Direct Messages section
 * - Single scrollable container
 *
 * @example
 * ```tsx
 * <MessagingSidebar className="w-64" />
 * ```
 */
export function MessagingSidebar({
  className,
}: MessagingSidebarProps): React.ReactElement {
  const [isNewDMDialogOpen, setIsNewDMDialogOpen] = useState(false);
  const pathname = usePathname();

  // Fetch channels and conversations
  const channels = useQuery(api.channels.list, {});
  const conversations = useQuery(api.messages.listConversations);

  // Determine active IDs from pathname
  const activeChannelId = pathname?.match(/^\/messages\/([^\/]+)$/)?.[1];
  const activeConversationId = pathname
    ?.split("/messages/dm/")[1]
    ?.split("/")[0];

  // Filter out special routes from activeChannelId
  const isValidChannelId =
    activeChannelId &&
    !["unread", "threads", "mentions", "drafts", "dm"].includes(activeChannelId);

  return (
    <div
      data-slot="messaging-sidebar"
      className={cn("flex h-full flex-col", className)}
    >
      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Quick Navigation - always visible */}
          <QuickNavigation className="mb-2" />

          <div className="my-2 border-t" />

          {/* Favorites Section */}
          <CollapsibleSection id="favorites" title="Favorites" defaultOpen>
            <FavoritesList />
          </CollapsibleSection>

          {/* Channels Section */}
          <CollapsibleSection
            id="channels"
            title="Channels"
            defaultOpen
            action={
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0"
                onClick={() => {
                  /* TODO: Create channel dialog */
                }}
              >
                <Plus className="size-4" />
                <span className="sr-only">Create channel</span>
              </Button>
            }
          >
            {channels === undefined ? (
              <div className="space-y-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-7 animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            ) : channels.length === 0 ? (
              <p className="py-1 text-xs text-muted-foreground">
                No channels yet
              </p>
            ) : (
              <div className="space-y-0.5">
                {channels.map((channel) => (
                  <ChannelListItem
                    key={channel._id}
                    id={channel._id}
                    name={channel.name}
                    isPrivate={channel.type === "private"}
                    unreadCount={channel.membership?.unreadCount ?? 0}
                    isActive={Boolean(isValidChannelId && activeChannelId === channel._id)}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Direct Messages Section */}
          <CollapsibleSection
            id="direct-messages"
            title="Direct Messages"
            defaultOpen
            action={
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0"
                onClick={() => setIsNewDMDialogOpen(true)}
              >
                <Plus className="size-4" />
                <span className="sr-only">New message</span>
              </Button>
            }
          >
            {conversations === undefined ? (
              <div className="space-y-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-7 animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <p className="py-1 text-xs text-muted-foreground">
                No conversations yet
              </p>
            ) : (
              <div className="space-y-0.5">
                {conversations.map((conversation) => {
                  // Get the other participant's info (first participant for direct messages)
                  const otherParticipant = conversation.participants?.[0];
                  return (
                    <DMListItem
                      key={conversation._id}
                      conversationId={conversation._id}
                      name={otherParticipant?.name ?? "Unknown"}
                      avatarUrl={otherParticipant?.avatarUrl}
                      status={otherParticipant?.status ?? "offline"}
                      isActive={activeConversationId === conversation._id}
                    />
                  );
                })}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </ScrollArea>

      {/* New DM Dialog */}
      <NewDMDialog
        open={isNewDMDialogOpen}
        onOpenChange={setIsNewDMDialogOpen}
      />
    </div>
  );
}

export { NewDMDialog };
