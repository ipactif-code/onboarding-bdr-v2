"use client";

import { useRef, useEffect } from "react";

import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { ThreadView } from "@/components/messaging/thread-view";
import { MessageInput } from "@/components/messaging/message-input";
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

interface ThreadPanelProps {
  /** The parent message ID to display thread for. null = panel closed. */
  parentMessageId: Id<"messages"> | null;
  /** Current user ID to identify own messages. */
  currentUserId: Id<"users">;
  /** The current user's display name for highlighting @mentions. */
  currentUserName?: string;
  /** Channel ID for pin functionality. */
  channelId?: Id<"channels">;
  /** Whether current user is a channel admin (for pin authorization). */
  isChannelAdmin?: boolean;
  /** Callback to close the panel. */
  onClose: () => void;
  /** Callback when user sends a reply (receives serialized content). */
  onSendReply: (content: string) => void;
  /** Optional callback after reply is sent successfully. */
  onReplySent?: () => void;
  /** Callback when user wants to edit a message. */
  onEdit?: (messageId: Id<"messages">) => void;
  /** Callback when user wants to delete a message. */
  onDelete?: (messageId: Id<"messages">) => void;
}

// ============================================================================
// ThreadPanel Component
// ============================================================================

/**
 * Slide-out panel for viewing and replying to a message thread.
 *
 * Uses shadcn Sheet component for accessible dialog behavior with
 * slide-in animation from the right side. The panel includes:
 * - ThreadView component showing parent message and replies
 * - MessageInput for composing thread replies
 * - Keyboard support (Escape to close via Sheet)
 *
 * The parent component is responsible for handling the actual message
 * sending via the `onSendReply` callback.
 *
 * @example
 * ```tsx
 * const [selectedThread, setSelectedThread] = useState<Id<"messages"> | null>(null);
 * const sendReply = useMutation(api.messages.sendThreadReply);
 *
 * <ThreadPanel
 *   parentMessageId={selectedThread}
 *   currentUserId={currentUser._id}
 *   onClose={() => setSelectedThread(null)}
 *   onSendReply={(content) => sendReply({ parentId: selectedThread, content })}
 * />
 * ```
 */
export function ThreadPanel({
  parentMessageId,
  currentUserId,
  currentUserName,
  channelId,
  isChannelAdmin,
  onClose,
  onSendReply,
  onReplySent,
  onEdit,
  onDelete,
}: ThreadPanelProps): React.ReactElement {
  const isOpen = parentMessageId !== null;
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management: move focus to close button when panel opens (WCAG 2.4.3)
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Small delay to ensure Sheet animation has started and content is rendered
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        aria-label="Thread panel"
      >
        {/* Visually hidden title for accessibility */}
        <SheetTitle className="sr-only">Message Thread</SheetTitle>

        {/* Thread content - ThreadView handles its own header */}
        {parentMessageId && (
          <>
            <div
              data-slot="thread-panel-content"
              className="flex min-h-0 flex-1 flex-col"
            >
              <ThreadView
                parentMessageId={parentMessageId}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                channelId={channelId}
                isChannelAdmin={isChannelAdmin}
                onClose={onClose}
                onEdit={onEdit}
                onDelete={onDelete}
                closeButtonRef={closeButtonRef}
              />
            </div>

            {/* Reply input - fixed at bottom */}
            <div
              data-slot="thread-panel-input"
              className="shrink-0 border-t bg-background p-4"
            >
              <MessageInput
                onSend={onSendReply}
                parentId={parentMessageId}
                placeholder="Reply to thread..."
                onSent={onReplySent}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export type { ThreadPanelProps };
