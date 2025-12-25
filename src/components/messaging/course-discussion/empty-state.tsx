"use client";

import { MessageSquare } from "lucide-react";

/**
 * Empty state when no discussions exist for a lesson.
 */
export function EmptyDiscussionState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <MessageSquare className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h4 className="text-sm font-medium text-foreground mb-1">
        No discussions yet
      </h4>
      <p className="text-xs text-muted-foreground max-w-[200px]">
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
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <MessageSquare className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h4 className="text-sm font-medium text-foreground mb-1">
        Discussions not available
      </h4>
      <p className="text-xs text-muted-foreground max-w-[200px]">
        This course does not have a discussion channel configured.
      </p>
    </div>
  );
}
