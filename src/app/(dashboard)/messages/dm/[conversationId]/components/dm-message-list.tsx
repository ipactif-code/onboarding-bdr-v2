"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { RichTextRenderer } from "@/components/messaging/rich-text-renderer";

export interface Message {
  _id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  content: string;
  createdAt: number;
  isOwn: boolean;
}

export interface DMMessageListProps {
  messages: Message[];
  isAtBottom: boolean;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  onScrollToBottom: () => void;
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
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
  ariaPosinset: number;
  ariaSetsize: number;
}

function DMMessageItem({
  message,
  ariaPosinset,
  ariaSetsize,
}: DMMessageItemProps): React.ReactElement {
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
      </div>
    </article>
  );
}

/** Message list for DM conversations - handles rendering and scrolling. */
export function DMMessageList({
  messages,
  isAtBottom,
  onScroll,
  onScrollToBottom,
  scrollAreaRef,
  bottomRef,
  className,
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
              ariaPosinset={index + 1}
              ariaSetsize={messages.length}
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
