"use client";

import { Pin } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials, formatTimestamp, getTextContent } from "@/lib/message-utils";

// ============================================================================
// Types
// ============================================================================

export interface DMPinnedMessagesProps {
  /** The conversation ID to display pinned messages for. */
  conversationId: Id<"conversations">;
  /** Optional className for the container. */
  className?: string;
}

/** Type for a pinned message from the API. */
interface PinnedMessage {
  _id: Id<"pins">;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
  messageId: Id<"messages">;
  pinnedBy: Id<"users">;
  pinnedAt: number;
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
  pinnedByUser: {
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
  } | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum characters for message content preview. */
const PREVIEW_MAX_LENGTH = 100;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncates message content to a preview length.
 * Extracts plain text from Plate.js content if necessary.
 */
function truncateContent(content: string, maxLength: number = PREVIEW_MAX_LENGTH): string {
  const plainText = getTextContent(content);
  if (plainText.length <= maxLength) {
    return plainText;
  }
  return plainText.slice(0, maxLength).trim() + "...";
}

// ============================================================================
// DMPinnedMessages Component
// ============================================================================

/**
 * DMPinnedMessages displays all pinned messages in a conversation (DM).
 *
 * Features:
 * - Real-time updates via Convex useQuery
 * - Shows sender avatar, name, and message preview
 * - "Pinned by [user] on [date]" subtitle
 * - Unpin button for any participant (DMs have no admin concept)
 * - Loading skeleton state
 * - Empty state when no pins exist
 *
 * @example
 * ```tsx
 * <DMPinnedMessages conversationId={conversationId} />
 * ```
 */
export function DMPinnedMessages({
  conversationId,
  className,
}: DMPinnedMessagesProps): React.ReactElement {
  // Real-time query for pinned messages in this conversation
  const pins = useQuery(api.pins.listByConversation, { conversationId }) as PinnedMessage[] | undefined;

  // Get current user to determine unpin permissions
  const currentUser = useQuery(api.users.me);

  // Mutation for unpinning messages
  const unpinMessage = useMutation(api.pins.unpinMessage);

  // Handle unpin action
  const handleUnpin = async (pinId: Id<"pins">, messageSenderName: string): Promise<void> => {
    try {
      await unpinMessage({ pinId });
      toast.success(`Message from ${messageSenderName} unpinned`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to unpin message";
      toast.error(message);
    }
  };

  // In DMs, any participant can unpin (no admin concept)
  // Server-side will verify the user is a participant
  const canUnpin = (): boolean => {
    return currentUser !== undefined && currentUser !== null;
  };

  // Loading state
  if (pins === undefined || currentUser === undefined) {
    return (
      <div
        data-slot="dm-pinned-messages"
        className={cn("flex h-full flex-col", className)}
      >
        <DMPinnedMessagesHeader />
        <DMPinnedMessagesSkeleton />
      </div>
    );
  }

  // Empty state
  if (pins.length === 0) {
    return (
      <div
        data-slot="dm-pinned-messages"
        className={cn("flex h-full flex-col", className)}
      >
        <DMPinnedMessagesHeader />
        <DMPinnedMessagesEmpty />
      </div>
    );
  }

  return (
    <div
      data-slot="dm-pinned-messages"
      className={cn("flex h-full flex-col", className)}
    >
      <DMPinnedMessagesHeader pinCount={pins.length} />

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          {pins.map((pin) => (
            <DMPinnedMessageItem
              key={pin._id}
              pin={pin}
              canUnpin={canUnpin()}
              onUnpin={() => handleUnpin(pin._id, pin.message?.sender?.name ?? "Unknown")}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

interface DMPinnedMessagesHeaderProps {
  pinCount?: number;
}

function DMPinnedMessagesHeader({
  pinCount,
}: DMPinnedMessagesHeaderProps): React.ReactElement {
  return (
    <div
      data-slot="dm-pinned-messages-header"
      className="flex items-center gap-2 border-b px-4 py-3"
    >
      <Pin className="size-4 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-sm font-semibold">
        Pinned Messages
        {pinCount !== undefined && pinCount > 0 && (
          <span className="ml-1 text-muted-foreground">({pinCount})</span>
        )}
      </h2>
    </div>
  );
}

interface DMPinnedMessageItemProps {
  pin: PinnedMessage;
  canUnpin: boolean;
  onUnpin: () => void;
}

function DMPinnedMessageItem({
  pin,
  canUnpin,
  onUnpin,
}: DMPinnedMessageItemProps): React.ReactElement {
  const { message, pinnedByUser, pinnedAt } = pin;

  // Handle deleted messages
  if (!message) {
    return (
      <div
        data-slot="dm-pinned-message-item"
        className="rounded-lg border bg-muted/30 p-3"
      >
        <p className="text-sm italic text-muted-foreground">
          This message has been deleted
        </p>
        {canUnpin && (
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onUnpin}
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
            >
              Remove pin
            </Button>
          </div>
        )}
      </div>
    );
  }

  const senderName = message.sender?.name ?? "Unknown User";
  const senderAvatarUrl = message.sender?.avatarUrl;
  const pinnedByName = pinnedByUser?.name ?? "Unknown";
  const contentPreview = truncateContent(message.content);

  return (
    <div
      data-slot="dm-pinned-message-item"
      className="group rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
    >
      {/* Message header: avatar + sender name */}
      <div className="flex items-start gap-3">
        <Avatar size="sm" className="shrink-0">
          {senderAvatarUrl && (
            <AvatarImage src={senderAvatarUrl} alt={senderName} />
          )}
          <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {senderName}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(message.createdAt)}
            </span>
            {message.isEdited && (
              <span className="text-xs italic text-muted-foreground">
                (edited)
              </span>
            )}
          </div>

          {/* Message content preview */}
          <p className="mt-1 text-sm text-foreground/80">
            {message.contentType === "voice" ? (
              <span className="italic text-muted-foreground">Voice message</span>
            ) : message.contentType === "file" ? (
              <span className="italic text-muted-foreground">File attachment</span>
            ) : (
              contentPreview
            )}
          </p>

          {/* Pinned by subtitle */}
          <p className="mt-2 text-xs text-muted-foreground">
            Pinned by {pinnedByName} on{" "}
            {new Date(pinnedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Unpin button */}
        {canUnpin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onUnpin}
                className="size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                aria-label={`Unpin message from ${senderName}`}
              >
                <Pin className="size-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Unpin message</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function DMPinnedMessagesEmpty(): React.ReactElement {
  return (
    <div
      data-slot="dm-pinned-messages-empty"
      className="flex flex-1 flex-col items-center justify-center p-8 text-center"
    >
      <div className="rounded-full bg-muted p-3">
        <Pin className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-foreground">
        No pinned messages
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Pin important messages to keep them visible in this conversation
      </p>
    </div>
  );
}

function DMPinnedMessagesSkeleton(): React.ReactElement {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border bg-card p-3"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-6 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export type { PinnedMessage as DMPinnedMessage };
