"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;
import { Id } from "../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

/**
 * User status for presence indication.
 */
type UserStatus = "online" | "offline" | "away" | "dnd";

/**
 * Message content type.
 */
type MessageContentType = "text" | "voice" | "file" | "system";

/**
 * Message status for delivery indication.
 */
type MessageStatus = "sending" | "sent" | "failed";

/**
 * Sender information attached to each message.
 */
interface MessageSender {
  _id: Id<"users">;
  name: string;
  avatarUrl?: string;
  status: UserStatus;
}

/**
 * Lesson information attached to messages linked to a course lesson.
 */
interface MessageLesson {
  _id: Id<"lessons">;
  title: string;
}

/**
 * Channel message with sender information.
 */
export interface ChannelMessage {
  _id: Id<"messages">;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
  senderId: Id<"users">;
  sender: MessageSender;
  content: string;
  contentType?: MessageContentType;
  parentId?: Id<"messages">;
  threadReplyCount?: number;
  threadLastReplyAt?: number;
  lessonId?: Id<"lessons">;
  lesson?: MessageLesson;
  createdAt: number;
  updatedAt?: number;
  isEdited?: boolean;
  deletedAt?: number;
  reactionCount?: number;
  status?: MessageStatus;
  /** Whether this message has file attachments. */
  hasAttachments?: boolean;
}

// ============================================================================
// useChannelMessages Hook
// ============================================================================

interface UseChannelMessagesOptions {
  channelId: Id<"channels"> | undefined;
  limit?: number;
}

interface UseChannelMessagesReturn {
  messages: ChannelMessage[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<Id<"messages">>;
  editMessage: (messageId: Id<"messages">, content: string) => Promise<void>;
  deleteMessage: (messageId: Id<"messages">) => Promise<void>;
}

/**
 * Attachment data for a completed upload (UploadThing).
 * Contains the URL and metadata needed to store the attachment.
 */
export interface AttachmentData {
  /** The URL where the file is stored (UploadThing URL) */
  url: string;
  /** The original file name */
  name: string;
  /** The file size in bytes */
  size: number;
  /** The MIME type of the file */
  type: string;
}

interface SendMessageOptions {
  parentId?: Id<"messages">;
  lessonId?: Id<"lessons">;
  /** Attachment data for UploadThing URLs */
  attachments?: AttachmentData[];
  /** Attachment IDs for files uploaded to Convex storage */
  attachmentIds?: Id<"messageAttachments">[];
}

/**
 * Hook for subscribing to channel messages with infinite scroll support.
 *
 * Features:
 * - Real-time updates via Convex subscription
 * - Infinite scroll pagination (load older messages)
 * - Message CRUD operations (send, edit, delete)
 * - Automatic deduplication of messages
 *
 * @param options.channelId - The ID of the channel to subscribe to
 * @param options.limit - Number of messages to fetch per page (default: 50)
 * @returns Messages array and action functions
 *
 * @example
 * ```tsx
 * const {
 *   messages,
 *   hasMore,
 *   isLoading,
 *   loadMore,
 *   sendMessage,
 * } = useChannelMessages({ channelId });
 *
 * // Load more when user scrolls to top
 * const handleScroll = (e: React.UIEvent) => {
 *   if (e.currentTarget.scrollTop === 0 && hasMore) {
 *     loadMore();
 *   }
 * };
 *
 * // Send a message
 * await sendMessage("Hello, world!");
 * ```
 */
export function useChannelMessages(
  options: UseChannelMessagesOptions
): UseChannelMessagesReturn {
  const { channelId, limit = 50 } = options;

  // State for pagination cursor (timestamp to load messages before)
  const [beforeCursor, setBeforeCursor] = useState<number | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Ref to track if we're currently loading to prevent duplicate requests
  const loadingRef = useRef(false);

  // Subscribe to messages - this will automatically update in real-time
  const result = useQuery(
    api.messages.listByChannel,
    channelId ? { channelId, limit, before: beforeCursor } : "skip"
  );

  // Mutations
  const sendMutation = useMutation(api.messages.sendToChannel);
  const editMutation = useMutation(api.messages.editChannelMessage);
  const deleteMutation = useMutation(api.messages.deleteChannelMessage);

  // Reset cursor when channel changes
  useEffect(() => {
    setBeforeCursor(undefined);
    setIsLoadingMore(false);
    loadingRef.current = false;
  }, [channelId]);

  // Load more (older) messages
  const loadMore = useCallback(() => {
    if (loadingRef.current || !result?.messages.length || !result.hasMore) {
      return;
    }

    loadingRef.current = true;
    setIsLoadingMore(true);

    // Get the oldest message's timestamp as the cursor
    const messages = result.messages;
    const oldestMessage = messages[messages.length - 1];
    if (oldestMessage) {
      setBeforeCursor(oldestMessage.createdAt);
    }

    // Reset loading flag after a short delay
    // The actual loading state will be updated when query result changes
    setTimeout(() => {
      loadingRef.current = false;
      setIsLoadingMore(false);
    }, 100);
  }, [result?.messages, result?.hasMore]);

  // Send a new message
  const sendMessage = useCallback(
    async (content: string, sendOptions?: SendMessageOptions): Promise<Id<"messages">> => {
      if (!channelId) {
        throw new Error("Channel ID is required to send a message");
      }
      return await sendMutation({
        channelId,
        content,
        parentId: sendOptions?.parentId,
        lessonId: sendOptions?.lessonId,
        attachments: sendOptions?.attachments,
        attachmentIds: sendOptions?.attachmentIds,
      });
    },
    [channelId, sendMutation]
  );

  // Edit an existing message
  const editMessage = useCallback(
    async (messageId: Id<"messages">, content: string): Promise<void> => {
      await editMutation({ messageId, content });
    },
    [editMutation]
  );

  // Delete a message
  const deleteMessage = useCallback(
    async (messageId: Id<"messages">): Promise<void> => {
      await deleteMutation({ messageId });
    },
    [deleteMutation]
  );

  // Messages come in descending order (newest first) from the query,
  // but we display them in ascending order (oldest first)
  const messages = result?.messages ? [...result.messages].reverse() : [];

  return {
    messages,
    hasMore: result?.hasMore ?? false,
    isLoading: result === undefined,
    isLoadingMore,
    loadMore,
    sendMessage,
    editMessage,
    deleteMessage,
  };
}

// ============================================================================
// useMessageActions Hook
// ============================================================================

interface UseMessageActionsReturn {
  markChannelAsRead: (channelId: Id<"channels">, readAt?: number) => Promise<void>;
}

/**
 * Hook for message-related actions that don't require a specific channel context.
 *
 * @returns Action functions for marking messages as read
 */
export function useMessageActions(): UseMessageActionsReturn {
  const markAsReadMutation = useMutation(api.messages.markChannelAsRead);

  const markChannelAsRead = useCallback(
    async (channelId: Id<"channels">, readAt?: number): Promise<void> => {
      await markAsReadMutation({ channelId, readAt });
    },
    [markAsReadMutation]
  );

  return {
    markChannelAsRead,
  };
}
