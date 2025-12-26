"use client";

import { MessageSquare } from "lucide-react";

/**
 * Empty state when no discussions exist for a lesson.
 */
export function EmptyDiscussionState(): React.ReactElement {
  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-8 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="mb-3 rounded-full bg-muted p-3">
        <MessageSquare className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h4 className="mb-1 text-sm font-medium text-foreground">
        No discussions yet
      </h4>
      <p className="max-w-[200px] text-xs text-muted-foreground">
        Be the first to start a discussion about this lesson!
      </p>
    </div>
  );
}

/**
 * State when course does not have a discussion channel.
 */
export function NoChannelState(): React.ReactElement {
  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-8 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="mb-3 rounded-full bg-muted p-3">
        <MessageSquare className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h4 className="mb-1 text-sm font-medium text-foreground">
        Discussions not available
      </h4>
      <p className="max-w-[200px] text-xs text-muted-foreground">
        This course does not have a discussion channel configured.
      </p>
    </div>
  );
}
