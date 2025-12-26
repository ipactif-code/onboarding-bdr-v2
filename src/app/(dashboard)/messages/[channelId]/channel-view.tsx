"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";

import { Id } from "../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;
import { useChannel } from "@/hooks/use-channel";
import { useChannelMessages } from "@/hooks/use-messages";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChannelHeader } from "@/components/messaging/channel-header";
import { MessageList } from "@/components/messaging/message-list";
import { MessageInput } from "@/components/messaging/message-input";
import { LessonSelector } from "@/components/messaging/lesson-selector";

// ============================================================================
// Types
// ============================================================================

interface ChannelViewProps {
  /**
   * The channel ID from the URL params.
   */
  channelId: string;
}

// ============================================================================
// ChannelView Component
// ============================================================================

/**
 * ChannelView is the main client component for viewing and interacting with a channel.
 *
 * Features:
 * - Real-time message updates via Convex subscription
 * - Channel header with name, topic, and member count
 * - Infinite scroll message list
 * - Rich text message input
 * - Auto-mark messages as read when visible
 *
 * @param channelId - The channel ID to display
 */
export function ChannelView({ channelId }: ChannelViewProps): React.ReactElement {
  // Get the current user
  const currentUser = useQuery(api.users.me);
  const currentUserId = currentUser?._id;

  // Parse channel ID
  const parsedChannelId = channelId as Id<"channels">;

  // Subscribe to channel data
  const { channel, isLoading: isChannelLoading, isMember, join, markAsRead } = useChannel({
    channelId: parsedChannelId,
  });

  // Subscribe to messages
  const {
    messages,
    isLoading: isMessagesLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    sendMessage,
    editMessage: _editMessage, // TODO: Use when inline edit UI is implemented
    deleteMessage,
  } = useChannelMessages({
    channelId: parsedChannelId,
  });

  // Ref to track the last read timestamp to debounce markAsRead calls
  const lastReadAtRef = useRef<number>(0);

  // State for selected lesson in course channels (T007)
  const [selectedLessonId, setSelectedLessonId] = useState<Id<"lessons"> | null>(null);

  // ========================================================================
  // Mark as read when messages become visible (T035)
  // ========================================================================

  const handleMessageVisible = useCallback(
    (_messageId: Id<"messages">, createdAt: number) => {
      // Only mark as read if this message is newer than our last read
      if (createdAt > lastReadAtRef.current) {
        lastReadAtRef.current = createdAt;

        // Debounce the markAsRead call
        // We'll only mark as read after the user has stopped scrolling
        setTimeout(() => {
          if (createdAt === lastReadAtRef.current && isMember) {
            markAsRead(createdAt).catch(() => {
              // Silently ignore errors for marking as read
            });
          }
        }, 1000);
      }
    },
    [isMember, markAsRead]
  );

  // Mark as read when entering the channel
  useEffect(() => {
    if (isMember && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage && latestMessage.createdAt > lastReadAtRef.current) {
        markAsRead().catch(() => {
          // Silently ignore errors
        });
      }
    }
  }, [isMember, messages, markAsRead]);

  // ========================================================================
  // Message actions
  // ========================================================================

  const handleSendMessage = useCallback(
    async (content: string) => {
      try {
        // Pass lessonId for course channels if a lesson is selected (T007)
        await sendMessage(content, {
          lessonId: selectedLessonId ?? undefined,
        });
        // Reset lesson selection after sending (optional: keep selection sticky)
        // Note: We keep the selection sticky for better UX when discussing a lesson
        // Auto-scroll is handled by MessageList
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send message";
        toast.error(message);
      }
    },
    [sendMessage, selectedLessonId]
  );

  const handleReply = useCallback((_messageId: Id<"messages">) => {
    // TODO: Implement thread reply UI
    toast.info("Thread replies coming soon!");
  }, []);

  const handleEdit = useCallback(
    async (_messageId: Id<"messages">) => {
      // TODO: Implement inline edit UI
      // For now, just show a placeholder
      toast.info("Edit UI coming soon!");
    },
    []
  );

  const handleDelete = useCallback(
    async (messageId: Id<"messages">) => {
      try {
        await deleteMessage(messageId);
        toast.success("Message deleted");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete message";
        toast.error(message);
      }
    },
    [deleteMessage]
  );

  // ========================================================================
  // Join channel action
  // ========================================================================

  const handleJoinChannel = useCallback(async () => {
    try {
      await join();
      toast.success("Joined channel successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to join channel";
      toast.error(message);
    }
  }, [join]);

  // ========================================================================
  // Loading state
  // ========================================================================

  if (isChannelLoading || currentUser === undefined) {
    return <ChannelViewSkeleton />;
  }

  // ========================================================================
  // Channel not found
  // ========================================================================

  if (!channel) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-semibold">Channel not found</h2>
        <p className="mt-2 text-muted-foreground">
          This channel may have been deleted or you don&apos;t have access to it.
        </p>
      </div>
    );
  }

  // ========================================================================
  // Not a member - show join prompt
  // ========================================================================

  if (!isMember) {
    return (
      <div className="flex h-full flex-col">
        <ChannelHeader channel={channel} />
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <h2 className="text-xl font-semibold">#{channel.name}</h2>
          {channel.description && (
            <p className="mt-2 max-w-md text-muted-foreground">
              {channel.description}
            </p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            {channel.memberCount} {channel.memberCount === 1 ? "member" : "members"}
          </p>
          {channel.type === "public" && !channel.isArchived && (
            <Button onClick={handleJoinChannel} className="mt-6">
              Join Channel
            </Button>
          )}
          {channel.type === "private" && (
            <p className="mt-4 text-sm text-muted-foreground">
              This is a private channel. You need an invite to join.
            </p>
          )}
          {channel.isArchived && (
            <p className="mt-4 text-sm text-muted-foreground">
              This channel has been archived.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ========================================================================
  // Full channel view (member)
  // ========================================================================

  return (
    <div data-slot="channel-view" className="flex h-full flex-col">
      {/* Channel header */}
      <ChannelHeader channel={channel} />

      {/* Message list */}
      <MessageList
        messages={messages}
        isLoading={isMessagesLoading}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        onMessageVisible={handleMessageVisible}
        onReply={handleReply}
        onEdit={handleEdit}
        onDelete={handleDelete}
        currentUserId={currentUserId}
        className="flex-1"
      />

      {/* Message input */}
      {!channel.isArchived && (
        <div className="border-t p-4">
          {/* Lesson selector for course channels (T007) */}
          {channel.courseId && (
            <div className="mb-2">
              <LessonSelector
                courseId={channel.courseId}
                selectedLessonId={selectedLessonId}
                onLessonChange={setSelectedLessonId}
              />
            </div>
          )}
          <MessageInput
            onSend={handleSendMessage}
            placeholder={`Message #${channel.name}`}
          />
        </div>
      )}

      {/* Archived channel notice */}
      {channel.isArchived && (
        <div className="border-t bg-muted/50 p-4 text-center text-sm text-muted-foreground">
          This channel has been archived. You cannot send new messages.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function ChannelViewSkeleton(): React.ReactElement {
  return (
    <div className="flex h-full flex-col">
      {/* Header skeleton */}
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <Skeleton className="size-5" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="size-8" />
      </div>

      {/* Messages skeleton */}
      <div className="flex-1 space-y-1 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3 py-2">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>

      {/* Input skeleton */}
      <div className="border-t p-4">
        <div className="flex items-end gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="size-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
