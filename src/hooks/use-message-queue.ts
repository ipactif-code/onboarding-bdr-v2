"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import { Id } from "../../convex/_generated/dataModel";
import { useNetworkStatus } from "./use-network-status";
import type { AttachmentData } from "@/components/messaging/message-input";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;

// ============================================================================
// Constants
// ============================================================================

/** Local storage key for persisting the message queue */
const QUEUE_STORAGE_KEY = "lms-message-queue";

/** Maximum number of retry attempts per message */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (in ms) */
const BASE_RETRY_DELAY = 1000;

/** Maximum delay for exponential backoff (in ms) */
const MAX_RETRY_DELAY = 30000;

// ============================================================================
// Types
// ============================================================================

/**
 * Status of a queued message.
 */
export type QueuedMessageStatus = "pending" | "sending" | "failed";

/**
 * A message waiting to be sent.
 */
export interface QueuedMessage {
  /** Unique local ID for the queued message */
  id: string;
  /** Message content (serialized Plate.js content) */
  content: string;
  /** Target channel ID (mutually exclusive with conversationId) */
  channelId?: string;
  /** Target conversation ID for DMs (mutually exclusive with channelId) */
  conversationId?: string;
  /** Parent message ID for thread replies */
  parentId?: string;
  /** Lesson ID for lesson-specific discussions */
  lessonId?: string;
  /** File attachments (if any) */
  attachments?: AttachmentData[];
  /** When the message was queued */
  queuedAt: number;
  /** Number of retry attempts */
  retryCount: number;
  /** Current status */
  status: QueuedMessageStatus;
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Input for adding a message to the queue.
 */
export interface QueueMessageInput {
  content: string;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
  parentId?: Id<"messages">;
  lessonId?: Id<"lessons">;
  attachments?: AttachmentData[];
}

/**
 * Return type for the useMessageQueue hook.
 */
export interface UseMessageQueueReturn {
  /** List of currently queued messages */
  queuedMessages: QueuedMessage[];
  /** Whether there are any pending messages */
  hasPendingMessages: boolean;
  /** Number of pending messages */
  pendingCount: number;
  /** Add a message to the queue */
  addToQueue: (input: QueueMessageInput) => string;
  /** Remove a message from the queue */
  removeFromQueue: (id: string) => void;
  /** Retry sending a specific failed message */
  retryMessage: (id: string) => Promise<void>;
  /** Retry all failed/pending messages */
  retryAll: () => Promise<void>;
  /** Clear all messages from the queue */
  clearQueue: () => void;
  /** Whether the queue is currently being processed */
  isProcessing: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique local ID for queued messages.
 */
function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate exponential backoff delay.
 */
function getRetryDelay(retryCount: number): number {
  const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY);
}

/**
 * Load queue from localStorage.
 */
function loadQueueFromStorage(): QueuedMessage[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as QueuedMessage[];
    // Reset all "sending" statuses to "pending" on load
    // (in case the page was refreshed during send)
    return parsed.map((msg) => ({
      ...msg,
      status: msg.status === "sending" ? "pending" : msg.status,
    }));
  } catch {
    // If storage is corrupted, start fresh
    return [];
  }
}

/**
 * Save queue to localStorage.
 */
function saveQueueToStorage(queue: QueuedMessage[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Storage might be full or unavailable - gracefully degrade
    console.warn("Failed to persist message queue to localStorage");
  }
}

// ============================================================================
// useMessageQueue Hook
// ============================================================================

/**
 * Hook for managing a local message queue with offline support.
 *
 * Features:
 * - Queues messages when offline
 * - Persists queue to localStorage
 * - Automatic retry with exponential backoff
 * - Manual retry for failed messages
 * - Integration with Convex mutations
 *
 * @returns MessageQueue interface for managing queued messages
 *
 * @example
 * ```tsx
 * const { addToQueue, queuedMessages, retryAll } = useMessageQueue();
 *
 * // When offline, queue the message
 * if (!isOnline) {
 *   addToQueue({ content: "Hello", channelId });
 *   toast.info("Message queued - will send when online");
 * }
 *
 * // Retry all when connection restored
 * useEffect(() => {
 *   if (isOnline && hasPendingMessages) {
 *     retryAll();
 *   }
 * }, [isOnline]);
 * ```
 */
export function useMessageQueue(): UseMessageQueueReturn {
  // Network status for auto-retry
  const { connectionState, isOnline } = useNetworkStatus();

  // Queue state
  const [queue, setQueue] = useState<QueuedMessage[]>(() => loadQueueFromStorage());
  const [isProcessing, setIsProcessing] = useState(false);

  // Ref to track if we're currently auto-retrying (prevent duplicate retries)
  const isAutoRetryingRef = useRef(false);

  // Convex mutations for sending messages
  const sendToChannel = useMutation(api.messages.sendToChannel);
  const sendToConversation = useMutation(api.messages.sendToConversation);

  // Persist queue changes to localStorage
  useEffect(() => {
    saveQueueToStorage(queue);
  }, [queue]);

  // Computed values
  const pendingMessages = queue.filter(
    (m) => m.status === "pending" || m.status === "sending"
  );
  const hasPendingMessages = pendingMessages.length > 0;
  const pendingCount = pendingMessages.length;

  /**
   * Add a message to the queue.
   */
  const addToQueue = useCallback((input: QueueMessageInput): string => {
    const id = generateLocalId();

    const queuedMessage: QueuedMessage = {
      id,
      content: input.content,
      channelId: input.channelId as string | undefined,
      conversationId: input.conversationId as string | undefined,
      parentId: input.parentId as string | undefined,
      lessonId: input.lessonId as string | undefined,
      attachments: input.attachments,
      queuedAt: Date.now(),
      retryCount: 0,
      status: "pending",
    };

    setQueue((prev) => [...prev, queuedMessage]);
    return id;
  }, []);

  /**
   * Remove a message from the queue.
   */
  const removeFromQueue = useCallback((id: string): void => {
    setQueue((prev) => prev.filter((m) => m.id !== id));
  }, []);

  /**
   * Mark a message as sending.
   */
  const markAsSending = useCallback((id: string): void => {
    setQueue((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, status: "sending" as const } : m
      )
    );
  }, []);

  /**
   * Mark a message as failed with error.
   */
  const markAsFailed = useCallback((id: string, error: string): void => {
    setQueue((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: "failed" as const,
              retryCount: m.retryCount + 1,
              errorMessage: error,
            }
          : m
      )
    );
  }, []);

  /**
   * Send a single queued message.
   */
  const sendMessage = useCallback(
    async (message: QueuedMessage): Promise<boolean> => {
      try {
        if (message.channelId) {
          await sendToChannel({
            channelId: message.channelId as Id<"channels">,
            content: message.content,
            parentId: message.parentId as Id<"messages"> | undefined,
            lessonId: message.lessonId as Id<"lessons"> | undefined,
            attachments: message.attachments,
          });
        } else if (message.conversationId) {
          await sendToConversation({
            conversationId: message.conversationId as Id<"conversations">,
            content: message.content,
            parentId: message.parentId as Id<"messages"> | undefined,
            attachments: message.attachments,
          });
        } else {
          throw new Error("Message must have channelId or conversationId");
        }

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to send message";
        throw new Error(errorMessage);
      }
    },
    [sendToChannel, sendToConversation]
  );

  /**
   * Retry a specific failed message.
   */
  const retryMessage = useCallback(
    async (id: string): Promise<void> => {
      const message = queue.find((m) => m.id === id);
      if (!message) {
        return;
      }

      if (message.retryCount >= MAX_RETRIES) {
        toast.error("Maximum retry attempts reached. Please try again later.");
        return;
      }

      if (!isOnline) {
        toast.warning("Cannot retry while offline");
        return;
      }

      markAsSending(id);

      try {
        await sendMessage(message);
        removeFromQueue(id);
        toast.success("Message sent successfully");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to send message";
        markAsFailed(id, errorMessage);
        toast.error(`Failed to send: ${errorMessage}`);
      }
    },
    [queue, isOnline, markAsSending, sendMessage, removeFromQueue, markAsFailed]
  );

  /**
   * Retry all pending/failed messages.
   */
  const retryAll = useCallback(async (): Promise<void> => {
    if (!isOnline || isProcessing) {
      return;
    }

    const messagesToRetry = queue.filter(
      (m) =>
        (m.status === "pending" || m.status === "failed") &&
        m.retryCount < MAX_RETRIES
    );

    if (messagesToRetry.length === 0) {
      return;
    }

    setIsProcessing(true);

    let successCount = 0;
    let failCount = 0;

    for (const message of messagesToRetry) {
      // Add delay between retries using exponential backoff
      if (message.retryCount > 0) {
        const delay = getRetryDelay(message.retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Check if we're still online before each attempt
      if (!navigator.onLine) {
        break;
      }

      markAsSending(message.id);

      try {
        await sendMessage(message);
        removeFromQueue(message.id);
        successCount++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to send message";
        markAsFailed(message.id, errorMessage);
        failCount++;
      }
    }

    setIsProcessing(false);

    // Show summary toast
    if (successCount > 0 && failCount === 0) {
      toast.success(
        `${successCount} queued message${successCount > 1 ? "s" : ""} sent`
      );
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(
        `${successCount} sent, ${failCount} failed. Will retry automatically.`
      );
    } else if (failCount > 0) {
      toast.error(`Failed to send ${failCount} message${failCount > 1 ? "s" : ""}`);
    }
  }, [
    isOnline,
    isProcessing,
    queue,
    markAsSending,
    sendMessage,
    removeFromQueue,
    markAsFailed,
  ]);

  /**
   * Clear all messages from the queue.
   */
  const clearQueue = useCallback((): void => {
    setQueue([]);
  }, []);

  // Auto-retry when connection is restored
  useEffect(() => {
    if (
      connectionState === "connected" &&
      hasPendingMessages &&
      !isProcessing &&
      !isAutoRetryingRef.current
    ) {
      isAutoRetryingRef.current = true;

      // Small delay to ensure connection is stable
      const timeoutId = setTimeout(() => {
        retryAll().finally(() => {
          isAutoRetryingRef.current = false;
        });
      }, 1000);

      return () => {
        clearTimeout(timeoutId);
        isAutoRetryingRef.current = false;
      };
    }
    return undefined;
  }, [connectionState, hasPendingMessages, isProcessing, retryAll]);

  return {
    queuedMessages: queue,
    hasPendingMessages,
    pendingCount,
    addToQueue,
    removeFromQueue,
    retryMessage,
    retryAll,
    clearQueue,
    isProcessing,
  };
}
