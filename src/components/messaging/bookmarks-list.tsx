"use client";

import { Bookmark, ExternalLink, Hash, MessageCircle, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";
import * as apiModule from "../../../convex/_generated/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials, getTextContent, formatTimestamp } from "@/lib/message-utils";

// Type workaround: Convex's API has excessively deep type nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (apiModule as any).api;

// ============================================================================
// Types
// ============================================================================

/** Type for a single bookmark returned from listBookmarks query */
interface BookmarkData {
  _id: Id<"bookmarks">;
  messageId: Id<"messages">;
  note?: string;
  createdAt: number;
  message: {
    _id: Id<"messages">;
    content: string;
    contentType?: "text" | "voice" | "file" | "system";
    createdAt: number;
    isEdited?: boolean;
    senderId: Id<"users">;
    sender: {
      _id: Id<"users">;
      name: string;
      avatarUrl?: string;
    } | null;
  } | null;
  context: {
    type: "channel" | "conversation";
    id: string;
    name: string;
  } | null;
}

export interface BookmarksListProps {
  /** Optional callback when panel is closed */
  onClose?: () => void;
  /** Callback when user wants to navigate to a bookmarked message */
  onNavigateToMessage?: (
    messageId: Id<"messages">,
    context: { type: "channel" | "conversation"; id: string }
  ) => void;
  /** Optional className for the container */
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Truncates content to a specified length, adding ellipsis if needed.
 */
function truncateContent(content: string, maxLength: number = 100): string {
  const plainText = getTextContent(content);
  if (plainText.length <= maxLength) {
    return plainText;
  }
  return plainText.slice(0, maxLength).trim() + "...";
}

/**
 * Skeleton loader for the bookmarks list
 */
function BookmarksListSkeleton(): React.ReactElement {
  return (
    <div data-slot="bookmarks-list-skeleton" className="space-y-3 p-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} size="sm">
          <CardContent className="space-y-3">
            {/* Context badge skeleton */}
            <Skeleton className="h-5 w-20" />

            {/* Sender info skeleton */}
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>

            {/* Message preview skeleton */}
            <Skeleton className="h-12 w-full" />

            {/* Footer skeleton */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-32" />
              <div className="flex gap-2">
                <Skeleton className="size-7" />
                <Skeleton className="size-7" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Empty state component when user has no bookmarks
 */
function EmptyBookmarks(): React.ReactElement {
  return (
    <div
      data-slot="bookmarks-empty"
      className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center"
    >
      <div className="rounded-full bg-muted p-4">
        <Bookmark className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          No bookmarked messages yet
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Bookmark important messages to find them easily later. Click the bookmark
          icon on any message to save it here.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// BookmarkItem Component
// ============================================================================

interface BookmarkItemProps {
  bookmarkId: Id<"bookmarks">;
  messageId: Id<"messages">;
  note?: string;
  createdAt: number;
  message: {
    _id: Id<"messages">;
    content: string;
    contentType?: "text" | "voice" | "file" | "system";
    createdAt: number;
    isEdited?: boolean;
    senderId: Id<"users">;
    sender: {
      _id: Id<"users">;
      name: string;
      avatarUrl?: string;
    } | null;
  } | null;
  context: {
    type: "channel" | "conversation";
    id: string;
    name: string;
  } | null;
  onRemove: (bookmarkId: Id<"bookmarks">) => Promise<void>;
  onNavigate?: (
    messageId: Id<"messages">,
    context: { type: "channel" | "conversation"; id: string }
  ) => void;
}

function BookmarkItem({
  bookmarkId,
  messageId,
  note,
  createdAt,
  message,
  context,
  onRemove,
  onNavigate,
}: BookmarkItemProps): React.ReactElement {
  const handleRemove = async (): Promise<void> => {
    try {
      await onRemove(bookmarkId);
      toast.success("Bookmark removed");
    } catch {
      toast.error("Failed to remove bookmark");
    }
  };

  const handleNavigate = (): void => {
    if (context && onNavigate) {
      onNavigate(messageId, { type: context.type, id: context.id });
    }
  };

  // If message was deleted, show a placeholder
  if (!message) {
    return (
      <Card data-slot="bookmark-item" size="sm" className="opacity-60">
        <CardContent className="space-y-3">
          {/* Context badge */}
          {context && (
            <Badge variant="secondary" className="text-xs">
              {context.type === "channel" ? (
                <>
                  <Hash className="size-3" data-icon="inline-start" aria-hidden="true" />
                  {context.name}
                </>
              ) : (
                <>
                  <MessageCircle className="size-3" data-icon="inline-start" aria-hidden="true" />
                  DM
                </>
              )}
            </Badge>
          )}

          {/* Deleted message notice */}
          <p className="text-sm italic text-muted-foreground">
            This message has been deleted
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              Bookmarked {formatTimestamp(createdAt)}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleRemove}
              aria-label="Remove bookmark"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const senderName = message.sender?.name ?? "Unknown User";
  const senderAvatarUrl = message.sender?.avatarUrl;

  return (
    <Card data-slot="bookmark-item" size="sm">
      <CardContent className="space-y-3">
        {/* Context badge */}
        {context && (
          <Badge variant="secondary" className="text-xs">
            {context.type === "channel" ? (
              <>
                <Hash className="size-3" data-icon="inline-start" aria-hidden="true" />
                {context.name}
              </>
            ) : (
              <>
                <MessageCircle className="size-3" data-icon="inline-start" aria-hidden="true" />
                DM
              </>
            )}
          </Badge>
        )}

        {/* Sender info */}
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            {senderAvatarUrl ? (
              <AvatarImage src={senderAvatarUrl} alt={senderName} />
            ) : null}
            <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground">
            {senderName}
          </span>
          {message.isEdited && (
            <span className="text-xs italic text-muted-foreground">(edited)</span>
          )}
        </div>

        {/* Message content preview */}
        <div className="space-y-1">
          <p className="text-sm text-foreground/90 line-clamp-3">
            {message.contentType === "voice"
              ? "[Voice message]"
              : message.contentType === "file"
                ? "[File attachment]"
                : truncateContent(message.content)}
          </p>
        </div>

        {/* Personal note (if exists) */}
        {note && (
          <div className="rounded-md border-l-2 border-primary/50 bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Note:</p>
            <p className="text-sm text-foreground/80">{note}</p>
          </div>
        )}

        {/* Footer: timestamp and actions */}
        <div className="flex items-center justify-between border-t border-border/50 pt-2">
          <span className="text-xs text-muted-foreground">
            Bookmarked {formatTimestamp(createdAt)}
          </span>
          <div className="flex items-center gap-1">
            {context && onNavigate && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleNavigate}
                aria-label="Jump to message"
                className="text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleRemove}
              aria-label="Remove bookmark"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// BookmarksList Component
// ============================================================================

/**
 * BookmarksList displays all of the current user's bookmarked messages.
 *
 * Features:
 * - Real-time updates via Convex useQuery subscription
 * - Context badge showing channel name or "DM" indicator
 * - Message preview with sender info
 * - Personal notes display (if exists)
 * - Remove bookmark action with toast feedback
 * - Jump to message navigation
 * - Loading and empty states
 *
 * @example
 * ```tsx
 * <BookmarksList
 *   onNavigateToMessage={(messageId, context) => {
 *     if (context.type === "channel") {
 *       router.push(`/channels/${context.id}?messageId=${messageId}`);
 *     } else {
 *       router.push(`/conversations/${context.id}?messageId=${messageId}`);
 *     }
 *   }}
 *   onClose={() => setBookmarksPanelOpen(false)}
 * />
 * ```
 */
export function BookmarksList({
  onClose: _onClose,
  onNavigateToMessage,
  className,
}: BookmarksListProps): React.ReactElement {
  // Fetch bookmarks with real-time updates
  const bookmarks = useQuery(api.bookmarks.listBookmarks);
  const removeBookmark = useMutation(api.bookmarks.removeBookmark);

  // Handle bookmark removal
  const handleRemoveBookmark = async (bookmarkId: Id<"bookmarks">): Promise<void> => {
    await removeBookmark({ bookmarkId });
  };

  // Loading state
  if (bookmarks === undefined) {
    return (
      <div data-slot="bookmarks-list" className={cn("h-full", className)}>
        <BookmarksListSkeleton />
      </div>
    );
  }

  // Empty state
  if (bookmarks.length === 0) {
    return (
      <div data-slot="bookmarks-list" className={cn("h-full", className)}>
        <EmptyBookmarks />
      </div>
    );
  }

  return (
    <div data-slot="bookmarks-list" className={cn("h-full", className)}>
      {/* Scrollable bookmark list */}
      <ScrollArea className="h-full">
        <div className="space-y-3 p-4">
          {(bookmarks as BookmarkData[]).map((bookmark) => (
            <BookmarkItem
              key={bookmark._id}
              bookmarkId={bookmark._id}
              messageId={bookmark.messageId}
              note={bookmark.note}
              createdAt={bookmark.createdAt}
              message={bookmark.message}
              context={bookmark.context}
              onRemove={handleRemoveBookmark}
              onNavigate={onNavigateToMessage}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
