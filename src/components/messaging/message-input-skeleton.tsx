"use client";

// ============================================================================
// MessageInputSkeleton Component
// ============================================================================

/**
 * Skeleton loading state for MessageInput.
 * Displays placeholder UI while the editor is initializing.
 */
export function MessageInputSkeleton(): React.ReactElement {
  return (
    <div data-slot="message-input-skeleton" className="flex w-full items-end gap-2">
      <div className="h-10 flex-1 motion-safe:animate-pulse rounded-lg bg-muted" />
      <div className="size-8 motion-safe:animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
