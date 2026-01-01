"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";
import { useQuery } from "convex/react";
import * as apiModule from "../../../../../../../convex/_generated/api";

import type { Id } from "../../../../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { RichTextRenderer } from "@/components/messaging/rich-text-renderer";
import { MessageActionButtons } from "@/components/messaging/message-action-buttons";
import { FileAttachment } from "@/components/messaging/file-attachment";
import { ImageAttachment } from "@/components/messaging/image-attachment";
import { Skeleton } from "@/components/ui/skeleton";
import { isImage } from "@/lib/file-type-utils";

// Type workaround: Convex's API has excessively deep type nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (apiModule as any).api;

/** Attachment type returned from getMessageAttachments query. */
interface MessageAttachment {
  _id: Id<"messageAttachments">;
  fileName: string;
  fileSize: number;
  fileType: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  uploadedAt: number;
  downloadUrl: string | null;
}

export interface Message {
  _id: Id<"messages">;
  senderId: Id<"users">;
  senderName: string;
  senderAvatarUrl?: string;
  content: string;
  createdAt: number;
  isOwn: boolean;
  /** Number of replies in the thread (0 if no replies). */
  threadReplyCount?: number;
  /** Whether this message has file attachments. */
  hasAttachments?: boolean;
}

export interface DMMessageListProps {
  messages: Message[];
  /** The conversation ID for pin functionality. */
  conversationId: Id<"conversations">;
  isAtBottom: boolean;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  onScrollToBottom: () => void;
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  /** Handler called when reply button is clicked on a message (opens thread panel). */
  onReply?: (messageId: Id<"messages">) => void;
  /** Handler called when edit button is clicked on a message. */
  onEdit?: (messageId: Id<"messages">) => void;
  /** Handler called when delete button is clicked on a message. */
  onDelete?: (messageId: Id<"messages">) => void;
}

/** Generates initials from a display name. */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const firstWord = words[0];
  const secondWord = words[1];

  if (!firstWord) {
    return "?";
  }

  if (!secondWord) {
    return firstWord.length >= 2
      ? firstWord.slice(0, 2).toUpperCase()
      : firstWord.toUpperCase();
  }

  const first = firstWord[0] ?? "";
  const second = secondWord[0] ?? "";
  return (first + second).toUpperCase();
}

/** Formats a timestamp into a human-readable time string. */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return "Just now";
  }

  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

interface DMMessageItemProps {
  message: Message;
  /** The conversation ID for pin functionality. */
  conversationId: Id<"conversations">;
  ariaPosinset: number;
  ariaSetsize: number;
  /** Handler called when reply button is clicked. */
  onReply?: () => void;
  /** Handler called when edit button is clicked. */
  onEdit?: () => void;
  /** Handler called when delete button is clicked. */
  onDelete?: () => void;
}

function DMMessageItem({
  message,
  conversationId,
  ariaPosinset,
  ariaSetsize,
  onReply,
  onEdit,
  onDelete,
}: DMMessageItemProps): React.ReactElement {
  const threadReplyCount = message.threadReplyCount ?? 0;

  // Fetch attachments when message has them
  const attachments = useQuery(
    api.attachments.getMessageAttachments,
    message.hasAttachments ? { messageId: message._id } : "skip"
  );

  // Separate attachments into images and files for different layouts
  const imageAttachments = (attachments as MessageAttachment[] | undefined)?.filter(
    (att: MessageAttachment) => isImage(att.fileType)
  ) ?? [];
  const fileAttachments = (attachments as MessageAttachment[] | undefined)?.filter(
    (att: MessageAttachment) => !isImage(att.fileType)
  ) ?? [];

  return (
    <article
      role="article"
      aria-posinset={ariaPosinset}
      aria-setsize={ariaSetsize}
      data-message-id={message._id}
      data-created-at={message.createdAt}
      className={cn(
        "group relative flex gap-3 px-4 py-2 transition-colors hover:bg-muted/50",
        message.isOwn && "bg-muted/30"
      )}
    >
      {/* Avatar */}
      <Avatar size="default" className="mt-0.5 shrink-0">
        {message.senderAvatarUrl ? (
          <AvatarImage src={message.senderAvatarUrl} alt={message.senderName} />
        ) : null}
        <AvatarFallback>{getInitials(message.senderName)}</AvatarFallback>
      </Avatar>

      {/* Message content area */}
      <div className="min-w-0 flex-1">
        {/* Header: sender name, timestamp */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {message.senderName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        </div>

        {/* Message body */}
        <div className="mt-1 break-words">
          <RichTextRenderer content={message.content} />
        </div>

        {/* Attachments section */}
        {message.hasAttachments && (
          <div className="mt-2 space-y-2">
            {/* Loading state */}
            {attachments === undefined && (
              <AttachmentsSkeleton />
            )}

            {/* Images in responsive grid */}
            {imageAttachments.length > 0 && (
              <div
                className={cn(
                  "grid gap-2",
                  imageAttachments.length === 1 && "grid-cols-1",
                  imageAttachments.length === 2 && "grid-cols-2",
                  imageAttachments.length >= 3 && "grid-cols-2 md:grid-cols-3"
                )}
              >
                {imageAttachments.map((attachment: MessageAttachment) => (
                  attachment.downloadUrl && (
                    <ImageAttachment
                      key={attachment._id}
                      fileName={attachment.fileName}
                      fileSize={attachment.fileSize}
                      fileType={attachment.fileType}
                      downloadUrl={attachment.downloadUrl}
                      thumbnailUrl={attachment.thumbnailUrl}
                      width={attachment.width}
                      height={attachment.height}
                    />
                  )
                ))}
              </div>
            )}

            {/* Files stacked */}
            {fileAttachments.length > 0 && (
              <div className="space-y-1">
                {fileAttachments.map((attachment: MessageAttachment) => (
                  attachment.downloadUrl && (
                    <FileAttachment
                      key={attachment._id}
                      fileName={attachment.fileName}
                      fileSize={attachment.fileSize}
                      fileType={attachment.fileType}
                      downloadUrl={attachment.downloadUrl}
                    />
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {/* Thread reply count indicator */}
        {threadReplyCount > 0 && (
          <button
            type="button"
            onClick={onReply}
            className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline"
            aria-label={`View ${threadReplyCount} ${threadReplyCount === 1 ? "reply" : "replies"}`}
          >
            <MessageCircle className="size-3" aria-hidden="true" />
            <span>
              {threadReplyCount} {threadReplyCount === 1 ? "reply" : "replies"}
            </span>
          </button>
        )}
      </div>

      {/* Action buttons (visible on hover/focus) - DMs now support threads */}
      <MessageActionButtons
        messageId={message._id}
        isOwn={message.isOwn}
        showThreadButton={true}
        channelId={undefined}
        conversationId={conversationId}
        isChannelAdmin={false}
        onReply={onReply}
        onEdit={message.isOwn ? onEdit : undefined}
        onDelete={message.isOwn ? onDelete : undefined}
      />
    </article>
  );
}

/**
 * Skeleton loader for attachments while they are being fetched.
 */
function AttachmentsSkeleton(): React.ReactElement {
  return (
    <div className="space-y-2" data-slot="attachments-skeleton">
      {/* Skeleton for potential image */}
      <Skeleton className="h-48 w-full max-w-md rounded-lg" />
      {/* Skeleton for potential file */}
      <Skeleton className="h-11 w-full max-w-md rounded-lg" />
    </div>
  );
}

/** Message list for DM conversations - handles rendering and scrolling. */
export function DMMessageList({
  messages,
  conversationId,
  isAtBottom,
  onScroll,
  onScrollToBottom,
  scrollAreaRef,
  bottomRef,
  className,
  onReply,
  onEdit,
  onDelete,
}: DMMessageListProps): React.ReactElement {
  return (
    <div className={cn("relative flex flex-1 flex-col overflow-hidden", className)}>
      <div
        ref={scrollAreaRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto"
      >
        <div
          role="feed"
          aria-label="Conversation messages"
          className="flex flex-col pb-4"
        >
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <MessageCircle className="mb-4 size-12 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">No messages yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Send a message to start the conversation!
              </p>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <DMMessageItem
              key={message._id}
              message={message}
              conversationId={conversationId}
              ariaPosinset={index + 1}
              ariaSetsize={messages.length}
              onReply={onReply ? () => onReply(message._id) : undefined}
              onEdit={onEdit ? () => onEdit(message._id) : undefined}
              onDelete={onDelete ? () => onDelete(message._id) : undefined}
            />
          ))}

          {/* Bottom anchor for auto-scroll */}
          <div ref={bottomRef} className="h-1" aria-hidden="true" />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && messages.length > 0 && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onScrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-lg"
          aria-label="Scroll to latest messages"
        >
          New messages
        </Button>
      )}
    </div>
  );
}
