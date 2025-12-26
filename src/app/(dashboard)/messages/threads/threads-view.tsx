"use client";

import Link from "next/link";
import { MessageSquare, Hash } from "lucide-react";
import { useQuery } from "convex/react";

import { Id } from "../../../../../convex/_generated/dataModel";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getInitials, formatTimestamp, getTextContent } from "@/lib/message-utils";

// ============================================================================
// Types
// ============================================================================

interface ThreadWithActivity {
  _id: Id<"messages">;
  channelId: Id<"channels">;
  channel: { _id: Id<"channels">; name: string } | null;
  senderId: Id<"users">;
  sender: { _id: Id<"users">; name: string; avatarUrl?: string };
  content: string;
  contentType?: "text" | "voice" | "file" | "system";
  threadReplyCount: number;
  threadLastReplyAt: number;
  createdAt: number;
}

const MAX_CONTENT_LENGTH = 100;

function truncateContent(content: string, maxLength: number): string {
  const plainText = getTextContent(content);
  return plainText.length <= maxLength
    ? plainText
    : plainText.slice(0, maxLength).trim() + "...";
}

// ============================================================================
// ThreadPreview Component
// ============================================================================

interface ThreadPreviewProps {
  thread: ThreadWithActivity;
}

function ThreadPreview({ thread }: ThreadPreviewProps): React.ReactElement {
  const channelName = thread.channel?.name ?? "Unknown Channel";
  const truncatedContent = truncateContent(thread.content, MAX_CONTENT_LENGTH);

  return (
    <Link
      href={`/messages/${thread.channelId}?thread=${thread._id}`}
      className={cn(
        "block rounded-lg border bg-card p-4 transition-colors",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Hash className="size-4" aria-hidden="true" />
          <span className="font-medium">{channelName}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatTimestamp(thread.threadLastReplyAt)}
        </span>
      </div>

      <div className="flex gap-3">
        <Avatar size="default" className="shrink-0">
          {thread.sender.avatarUrl && (
            <AvatarImage src={thread.sender.avatarUrl} alt={thread.sender.name} />
          )}
          <AvatarFallback>{getInitials(thread.sender.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold">{thread.sender.name}: </span>
            <span className="text-muted-foreground">{truncatedContent}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Badge variant="secondary" className="gap-1.5">
          <MessageSquare className="size-3" aria-hidden="true" />
          <span>
            {thread.threadReplyCount} {thread.threadReplyCount === 1 ? "reply" : "replies"}
          </span>
        </Badge>
      </div>
    </Link>
  );
}

// ============================================================================
// ThreadsViewSkeleton Component
// ============================================================================

function ThreadsViewSkeleton(): React.ReactElement {
  return (
    <div data-slot="threads-view-skeleton" className="space-y-4 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// ThreadsEmptyState Component
// ============================================================================

function ThreadsEmptyState(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <div className="text-center">
        <MessageSquare className="mx-auto mb-4 size-12 opacity-50" />
        <h2 className="text-lg font-medium">No threads yet</h2>
        <p className="text-sm">Threads will appear here when you or others reply to messages</p>
      </div>
    </div>
  );
}

// ============================================================================
// ThreadsView Component
// ============================================================================

/**
 * ThreadsView displays a list of all messages with thread activity.
 * Features real-time updates, thread previews, and navigation to channel with thread panel.
 */
export function ThreadsView(): React.ReactElement {
  const result = useQuery(api.messages.listThreadsWithActivity, {
    limit: 20,
  });

  if (result === undefined) {
    return <ThreadsViewSkeleton />;
  }

  const threads = result.messages as ThreadWithActivity[];

  if (threads.length === 0) {
    return <ThreadsEmptyState />;
  }

  return (
    <div data-slot="threads-view" className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <h1 className="text-lg font-semibold">Threads</h1>
        <p className="text-sm text-muted-foreground">
          Messages with replies from channels you have access to
        </p>
      </div>
      <div className="space-y-3 p-4">
        {threads.map((thread) => (
          <ThreadPreview key={thread._id} thread={thread} />
        ))}
      </div>
    </div>
  );
}
