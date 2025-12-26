"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { ChevronDown, ChevronUp, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../convex/_generated/api").api;
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

import type { CourseDiscussionPanelProps, DiscussionMessage } from "./types";
import { DiscussionMessageItem } from "./discussion-message-item";
import { DiscussionMessageSkeleton } from "./skeletons";
import { EmptyDiscussionState, NoChannelState } from "./empty-state";

// Re-export types and skeleton for external use
export type { CourseDiscussionPanelProps, DiscussionMessage } from "./types";
export { CourseDiscussionPanelSkeleton } from "./skeletons";

// Re-export the inline discussion content component
export { InlineDiscussionContent } from "./inline-discussion-content";
export type { InlineDiscussionContentProps } from "./inline-discussion-content";

/**
 * CourseDiscussionPanel displays lesson-linked discussions in a collapsible panel.
 *
 * Features:
 * - Real-time updates via Convex subscription
 * - Collapsible panel with toggle button
 * - Message list with sender avatars and relative timestamps
 * - Thread reply count indicators
 * - Input area for new messages
 * - Empty state when no discussions exist
 *
 * @param courseId - The ID of the current course
 * @param lessonId - The ID of the current lesson being viewed
 */
export function CourseDiscussionPanel({
  courseId,
  lessonId,
}: CourseDiscussionPanelProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Query lesson discussion messages
  const discussionData = useQuery(api.messages.getLessonDiscussion, {
    courseId,
    lessonId,
  });

  // Mutation to send a message
  const sendToChannel = useMutation(api.messages.sendToChannel);

  // Handle sending a new message
  const handleSendMessage = useCallback(async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !discussionData?.channelId) {
      return;
    }

    setIsSending(true);
    try {
      await sendToChannel({
        channelId: discussionData.channelId,
        content: trimmedMessage,
        lessonId,
      });
      setNewMessage("");
      toast.success("Message posted");
    } catch {
      toast.error("Failed to post message. Please try again.");
    } finally {
      setIsSending(false);
    }
  }, [newMessage, discussionData?.channelId, lessonId, sendToChannel]);

  // Handle Enter key to send (Shift+Enter for new line)
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // Toggle panel open/closed
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Loading state
  const isLoading = discussionData === undefined;
  const messages = (discussionData?.messages ?? []) as DiscussionMessage[];
  const messageCount = messages.length;
  const hasChannel = discussionData?.channelId !== null;

  return (
    <div
      data-slot="course-discussion-panel"
      className="border-t border-border bg-background"
    >
      {/* Toggle Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex w-full items-center justify-between px-6 py-3 transition-colors hover:bg-muted/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        )}
        aria-expanded={isOpen}
        aria-controls="discussion-panel-content"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Discussion
            {!isLoading && messageCount > 0 && (
              <span className="ml-1.5 text-muted-foreground">
                ({messageCount})
              </span>
            )}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div id="discussion-panel-content" className="border-t border-border">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-0">
              <DiscussionMessageSkeleton />
              <DiscussionMessageSkeleton />
              <DiscussionMessageSkeleton />
            </div>
          )}

          {/* No Channel State */}
          {!isLoading && !hasChannel && <NoChannelState />}

          {/* Messages List */}
          {!isLoading && hasChannel && (
            <>
              <ScrollArea className="max-h-[300px]">
                {messages.length === 0 ? (
                  <EmptyDiscussionState />
                ) : (
                  <div className="divide-y divide-border/50">
                    {messages.map((message) => (
                      <DiscussionMessageItem
                        key={message._id}
                        message={message}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="border-t border-border p-4">
                <div className="flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add to the discussion... (Enter to send)"
                    disabled={isSending}
                    className="min-h-[40px] max-h-[120px] resize-none text-sm"
                    aria-label="Discussion message input"
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                    aria-label="Send message"
                    className="shrink-0"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
