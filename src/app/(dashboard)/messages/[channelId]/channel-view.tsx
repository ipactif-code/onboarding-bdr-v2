"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQuery } from "convex/react";

import { Id } from "../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;
import { useChannel } from "@/hooks/use-channel";
import { useChannelMessages } from "@/hooks/use-messages";
import { ChannelHeader } from "@/components/messaging/channel-header";
import { MessageList } from "@/components/messaging/message-list";
import { MessageInput } from "@/components/messaging/message-input";
import { LessonSelector } from "@/components/messaging/lesson-selector";
import { ThreadPanel } from "@/components/messaging/thread-panel";
import { ChannelViewSkeleton } from "./channel-view-skeleton";
import { ChannelJoinPrompt } from "./channel-join-prompt";
import { useChannelActions } from "./use-channel-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ============================================================================
// Types
// ============================================================================

interface ChannelViewProps {
  /** The channel ID from the URL params. */
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
 */
export function ChannelView({ channelId }: ChannelViewProps): React.ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentUser = useQuery(api.users.me);
  const currentUserId = currentUser?._id;
  const parsedChannelId = channelId as Id<"channels">;

  const { channel, isLoading: isChannelLoading, isMember, join, markAsRead } = useChannel({
    channelId: parsedChannelId,
  });

  // Compute if user is a channel admin for pin functionality
  const isChannelAdmin = channel?.membership?.role === "owner" || channel?.membership?.role === "admin";

  const {
    messages,
    isLoading: isMessagesLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    sendMessage,
    deleteMessage,
  } = useChannelMessages({ channelId: parsedChannelId });

  const lastReadAtRef = useRef<number>(0);
  const hasMarkedAsReadRef = useRef(false);
  const [selectedLessonId, setSelectedLessonId] = useState<Id<"lessons"> | null>(null);
  const [openThreadId, setOpenThreadId] = useState<Id<"messages"> | null>(null);

  // Delete confirmation state
  const [deleteMessageId, setDeleteMessageId] = useState<Id<"messages"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track whether we've processed the initial thread param
  const threadParamProcessedRef = useRef(false);

  const {
    handleSendMessage,
    handleReply,
    handleCloseThread,
    handleSendThreadReply,
    handleEdit,
    handleDelete,
    handleJoinChannel,
  } = useChannelActions({
    sendMessage,
    deleteMessage,
    join,
    selectedLessonId,
    openThreadId,
    setOpenThreadId,
  });

  // Request delete confirmation - shows modal instead of deleting directly
  const handleDeleteRequest = useCallback((messageId: Id<"messages">) => {
    setDeleteMessageId(messageId);
  }, []);

  // Actual delete handler - called when user confirms
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteMessageId) return;
    setIsDeleting(true);
    try {
      await handleDelete(deleteMessageId);
    } finally {
      setIsDeleting(false);
      setDeleteMessageId(null);
    }
  }, [deleteMessageId, handleDelete]);

  // Open thread from URL query parameter (e.g., ?thread=messageId)
  // Only process once after channel access is verified
  useEffect(() => {
    // Skip if already processed, not a member, or channel is still loading
    if (threadParamProcessedRef.current || !isMember || isChannelLoading) {
      return;
    }

    const threadId = searchParams.get("thread");
    if (threadId) {
      // Mark as processed to prevent re-running
      threadParamProcessedRef.current = true;

      // Set the thread to open
      setOpenThreadId(threadId as Id<"messages">);

      // Clear the query param from URL for cleaner UX
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname, isMember, isChannelLoading, setOpenThreadId]);

  // Mark as read when messages become visible
  const handleMessageVisible = useCallback(
    (_messageId: Id<"messages">, createdAt: number) => {
      if (createdAt > lastReadAtRef.current) {
        lastReadAtRef.current = createdAt;
        setTimeout(() => {
          if (createdAt === lastReadAtRef.current && isMember) {
            markAsRead(createdAt).catch(() => {});
          }
        }, 1000);
      }
    },
    [isMember, markAsRead]
  );

  // Reset mark-as-read flag when channel changes
  useEffect(() => {
    hasMarkedAsReadRef.current = false;
  }, [parsedChannelId]);

  // Mark as read when entering the channel (ONLY ONCE per channel)
  // This prevents infinite loops: markAsRead() triggers a DB update,
  // which causes channels:get to re-run, giving messages a new reference,
  // which would trigger this effect again without the guard.
  useEffect(() => {
    if (isMember && messages.length > 0 && !hasMarkedAsReadRef.current) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage && latestMessage.createdAt > lastReadAtRef.current) {
        lastReadAtRef.current = latestMessage.createdAt;
        hasMarkedAsReadRef.current = true;
        markAsRead().catch(() => {});
      }
    }
  }, [isMember, messages, markAsRead]);

  // Loading state
  if (isChannelLoading || currentUser === undefined) {
    return <ChannelViewSkeleton />;
  }

  // Channel not found
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

  // Not a member - show join prompt
  if (!isMember) {
    return <ChannelJoinPrompt channel={channel} onJoin={handleJoinChannel} />;
  }

  // Full channel view (member)
  return (
    <div data-slot="channel-view" className="flex h-full flex-col">
      <ChannelHeader channel={channel} />

      <MessageList
        messages={messages}
        isLoading={isMessagesLoading}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        onMessageVisible={handleMessageVisible}
        onReply={handleReply}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
        currentUserId={currentUserId}
        currentUserName={currentUser?.name}
        channelId={parsedChannelId}
        isChannelAdmin={isChannelAdmin}
        className="flex-1"
      />

      {!channel.isArchived && (
        <div className="border-t p-4">
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
            channelId={parsedChannelId}
            lessonId={selectedLessonId ?? undefined}
          />
        </div>
      )}

      {channel.isArchived && (
        <div className="border-t bg-muted/50 p-4 text-center text-sm text-muted-foreground">
          This channel has been archived. You cannot send new messages.
        </div>
      )}

      {currentUserId && (
        <ThreadPanel
          parentMessageId={openThreadId}
          currentUserId={currentUserId}
          currentUserName={currentUser?.name}
          channelId={parsedChannelId}
          isChannelAdmin={isChannelAdmin}
          onClose={handleCloseThread}
          onSendReply={handleSendThreadReply}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AlertDialog
        open={deleteMessageId !== null}
        onOpenChange={(open) => !open && setDeleteMessageId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this message. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
