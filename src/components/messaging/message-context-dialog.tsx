"use client";

import * as React from "react";
import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Hash, ExternalLink, MessageSquare, Loader2 } from "lucide-react";

// Import api using require to completely bypass TypeScript type inference
// eslint-disable-next-line @typescript-eslint/no-require-imports
const convexApi = require("../../../convex/_generated/api");
const api = convexApi.api;

import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { getInitials, formatTimestamp } from "@/lib/message-utils";

// ============================================================================
// Types
// ============================================================================

export interface MessageContextDialogProps {
  /** The message ID to show context for, or null if not open */
  messageId: Id<"messages"> | null;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog should close */
  onClose: () => void;
}

interface ContextMessage {
  _id: Id<"messages">;
  senderId: Id<"users">;
  senderName: string;
  senderAvatarUrl?: string;
  content: string;
  contentType?: "text" | "voice" | "file" | "system";
  createdAt: number;
  isEdited?: boolean;
}

interface MessageContextResponse {
  before: ContextMessage[];
  target: ContextMessage;
  after: ContextMessage[];
  channelId?: Id<"channels">;
  channelName?: string;
  conversationId?: Id<"conversations">;
}

// ============================================================================
// ContextMessageItem Component
// ============================================================================

interface ContextMessageItemProps {
  message: ContextMessage;
  isTarget: boolean;
}

function ContextMessageItem({
  message,
  isTarget,
}: ContextMessageItemProps): React.ReactElement {
  return (
    <div
      data-message-id={message._id}
      className={cn(
        "flex gap-3 px-4 py-2 transition-colors",
        isTarget && "bg-yellow-200 dark:bg-yellow-800/40 border-l-4 border-yellow-500"
      )}
    >
      {/* Avatar */}
      <Avatar size="sm" className="mt-0.5 shrink-0">
        {message.senderAvatarUrl ? (
          <AvatarImage src={message.senderAvatarUrl} alt={message.senderName} />
        ) : null}
        <AvatarFallback>{getInitials(message.senderName)}</AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header: sender name and timestamp */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {message.senderName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(message.createdAt)}
          </span>
          {message.isEdited && (
            <span className="text-xs text-muted-foreground italic">
              (edited)
            </span>
          )}
          {isTarget && (
            <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
              Matched message
            </span>
          )}
        </div>

        {/* Message body */}
        <div className="mt-1 text-sm break-words whitespace-pre-wrap">
          {message.contentType === "voice" ? (
            <span className="text-muted-foreground italic">
              [Voice message]
            </span>
          ) : message.contentType === "file" ? (
            <span className="text-muted-foreground italic">
              [File attachment]
            </span>
          ) : message.contentType === "system" ? (
            <span className="text-muted-foreground italic">
              {message.content}
            </span>
          ) : (
            message.content
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MessageContextDialog Component
// ============================================================================

/**
 * MessageContextDialog displays a message in its original context.
 *
 * Features:
 * - Shows up to 10 messages before and after the target message
 * - Target message is highlighted with a yellow background
 * - Auto-scrolls to the target message on open
 * - "Jump to Channel" button to navigate to the full conversation
 * - Loading state while fetching context
 * - Accessible dialog with proper focus management
 *
 * @example
 * ```tsx
 * <MessageContextDialog
 *   messageId={selectedMessageId}
 *   isOpen={isContextDialogOpen}
 *   onClose={() => setIsContextDialogOpen(false)}
 * />
 * ```
 */
export function MessageContextDialog({
  messageId,
  isOpen,
  onClose,
}: MessageContextDialogProps): React.ReactElement {
  const router = useRouter();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  // ========================================================================
  // Data Fetching
  // ========================================================================

  // Fetch message context when dialog is open and messageId is set
  const contextData = useQuery(
    api.messages.channelMessageQueries.getMessageContext,
    messageId && isOpen ? { messageId, contextSize: 10 } : "skip"
  ) as MessageContextResponse | null | undefined;

  const isLoading = messageId && isOpen && contextData === undefined;
  const hasData = contextData !== null && contextData !== undefined;

  // ========================================================================
  // Auto-scroll to target message
  // ========================================================================

  useEffect(() => {
    if (hasData && targetRef.current) {
      // Wait for DOM to update, then scroll to target
      requestAnimationFrame(() => {
        targetRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    }
  }, [hasData, contextData?.target._id]);

  // ========================================================================
  // Handlers
  // ========================================================================

  const handleJumpToChannel = useCallback(() => {
    if (!contextData) return;

    if (contextData.channelId) {
      router.push(`/messages/${contextData.channelId}`);
    } else if (contextData.conversationId) {
      router.push(`/messages/dm/${contextData.conversationId}`);
    }

    onClose();
  }, [contextData, router, onClose]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose]
  );

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-2 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-5" />
            Message Context
          </DialogTitle>
          <DialogDescription>
            {hasData && contextData.channelName && (
              <span className="flex items-center gap-1">
                <Hash className="size-3" aria-hidden="true" />
                {contextData.channelName}
              </span>
            )}
            {hasData && contextData.conversationId && !contextData.channelName && (
              <span>Direct message</span>
            )}
            {!hasData && !isLoading && (
              <span>Message not found or access denied</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Loading state */}
          {isLoading && (
            <div className="p-4">
              <MessageContextSkeleton />
            </div>
          )}

          {/* Error/Not found state */}
          {!isLoading && contextData === null && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="size-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">
                Message not found
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                This message may have been deleted or you don&apos;t have access to
                view it.
              </p>
            </div>
          )}

          {/* Messages */}
          {hasData && (
            <div ref={scrollAreaRef} className="h-[50vh] overflow-y-auto">
              <div className="divide-y divide-border/50">
                {/* Messages before target */}
                {contextData.before.map((message) => (
                  <ContextMessageItem
                    key={message._id}
                    message={message}
                    isTarget={false}
                  />
                ))}

                {/* Target message (highlighted) */}
                <div ref={targetRef}>
                  <ContextMessageItem
                    message={contextData.target}
                    isTarget={true}
                  />
                </div>

                {/* Messages after target */}
                {contextData.after.map((message) => (
                  <ContextMessageItem
                    key={message._id}
                    message={message}
                    isTarget={false}
                  />
                ))}
              </div>

              {/* Empty context hint */}
              {contextData.before.length === 0 &&
                contextData.after.length === 0 && (
                  <div className="px-4 py-2 text-center text-xs text-muted-foreground">
                    This is the only message in view
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasData && (
          <DialogFooter className="shrink-0" showCloseButton>
            <Button onClick={handleJumpToChannel} className="gap-2">
              <ExternalLink className="size-4" />
              {contextData.channelName
                ? `Go to #${contextData.channelName}`
                : "Go to conversation"}
            </Button>
          </DialogFooter>
        )}

        {/* Error footer */}
        {!isLoading && contextData === null && (
          <DialogFooter className="shrink-0" showCloseButton />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MessageContextSkeleton
// ============================================================================

function MessageContextSkeleton(): React.ReactElement {
  return (
    <div
      data-slot="message-context-skeleton"
      className="space-y-2"
      role="status"
      aria-busy="true"
    >
      {/* Loading indicator */}
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>

      {/* Skeleton messages */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-4 py-2">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            {i === 2 && <Skeleton className="h-4 w-3/4" />}
          </div>
        </div>
      ))}

      <span className="sr-only">Loading message context</span>
    </div>
  );
}

export { MessageContextSkeleton };
