"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";

import type { Id } from "../../../../../convex/_generated/dataModel";
import type { AttachmentData } from "@/hooks/use-messages";
import type { SendMessageOptions } from "@/components/messaging/message-input";

// ============================================================================
// Types
// ============================================================================

interface UseChannelActionsOptions {
  /** Send message mutation function. */
  sendMessage: (content: string, options?: { lessonId?: Id<"lessons">; parentId?: Id<"messages">; attachments?: AttachmentData[]; attachmentIds?: Id<"messageAttachments">[] }) => Promise<unknown>;
  /** Delete message mutation function. */
  deleteMessage: (messageId: Id<"messages">) => Promise<void>;
  /** Join channel mutation function. */
  join: () => Promise<void>;
  /** Currently selected lesson ID for course channels. */
  selectedLessonId: Id<"lessons"> | null;
  /** Currently open thread ID. */
  openThreadId: Id<"messages"> | null;
  /** Setter for open thread ID. */
  setOpenThreadId: (id: Id<"messages"> | null) => void;
}

interface UseChannelActionsReturn {
  /** Ref to track the element that triggered thread panel open. */
  threadTriggerRef: React.RefObject<HTMLElement | null>;
  /** Handle sending a message in the main channel (with optional attachments). */
  handleSendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  /** Handle opening a thread for a message. */
  handleReply: (messageId: Id<"messages">) => void;
  /** Handle closing the thread panel. */
  handleCloseThread: () => void;
  /** Handle sending a reply in a thread (with optional attachments). */
  handleSendThreadReply: (content: string, options?: SendMessageOptions) => Promise<void>;
  /** Handle editing a message (placeholder). */
  handleEdit: (messageId: Id<"messages">) => Promise<void>;
  /** Handle deleting a message. */
  handleDelete: (messageId: Id<"messages">) => Promise<void>;
  /** Handle joining the channel. */
  handleJoinChannel: () => Promise<void>;
}

// ============================================================================
// useChannelActions Hook
// ============================================================================

/**
 * Custom hook that encapsulates all channel message action handlers.
 * Extracts action logic from ChannelView for better separation of concerns.
 */
export function useChannelActions({
  sendMessage,
  deleteMessage,
  join,
  selectedLessonId,
  openThreadId,
  setOpenThreadId,
}: UseChannelActionsOptions): UseChannelActionsReturn {
  const threadTriggerRef = useRef<HTMLElement | null>(null);

  const handleSendMessage = useCallback(
    async (content: string, options?: SendMessageOptions) => {
      try {
        await sendMessage(content, {
          lessonId: selectedLessonId ?? undefined,
          attachments: options?.attachments,
          attachmentIds: options?.attachmentIds,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send message";
        toast.error(message);
      }
    },
    [sendMessage, selectedLessonId]
  );

  const handleReply = useCallback((messageId: Id<"messages">) => {
    threadTriggerRef.current = document.activeElement as HTMLElement;
    setOpenThreadId(messageId);
  }, [setOpenThreadId]);

  const handleCloseThread = useCallback(() => {
    setOpenThreadId(null);
    requestAnimationFrame(() => {
      threadTriggerRef.current?.focus();
      threadTriggerRef.current = null;
    });
  }, [setOpenThreadId]);

  const handleSendThreadReply = useCallback(
    async (content: string, options?: SendMessageOptions) => {
      if (!openThreadId) return;
      try {
        await sendMessage(content, {
          parentId: openThreadId,
          attachments: options?.attachments,
          attachmentIds: options?.attachmentIds,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send reply";
        toast.error(message);
      }
    },
    [openThreadId, sendMessage]
  );

  const handleEdit = useCallback(async (_messageId: Id<"messages">) => {
    toast.info("Edit UI coming soon!");
  }, []);

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

  const handleJoinChannel = useCallback(async () => {
    try {
      await join();
      toast.success("Joined channel successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to join channel";
      toast.error(message);
    }
  }, [join]);

  return {
    threadTriggerRef,
    handleSendMessage,
    handleReply,
    handleCloseThread,
    handleSendThreadReply,
    handleEdit,
    handleDelete,
    handleJoinChannel,
  };
}
