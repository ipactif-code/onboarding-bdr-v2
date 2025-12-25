"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

import type { DiscussionMessage } from "./types";
import { DiscussionMessageItem } from "./discussion-message-item";
import { DiscussionMessageSkeleton } from "./skeletons";
import { EmptyDiscussionState, NoChannelState } from "./empty-state";

export interface InlineDiscussionContentProps {
  /** The current course ID */
  courseId: Id<"courses">;
  /** The current lesson ID being viewed (optional for course-level discussion) */
  lessonId?: Id<"lessons">;
}

/**
 * InlineDiscussionContent displays lesson-linked discussions inline (without collapse).
 *
 * This component is designed to be embedded in a tab or other container,
 * unlike CourseDiscussionPanel which is a standalone collapsible panel.
 *
 * Features:
 * - Real-time updates via Convex subscription (useQuery)
 * - Message list with sender avatars and relative timestamps
 * - Thread reply count indicators
 * - Input area for new messages
 * - Empty state when no discussions exist
 *
 * @param courseId - The ID of the current course
 * @param lessonId - The ID of the current lesson being viewed (optional)
 */
export function InlineDiscussionContent({
  courseId,
  lessonId,
}: InlineDiscussionContentProps): React.ReactElement {
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Query lesson discussion messages - this is a real-time subscription
  // Messages will automatically update when new ones are added to the channel
  const discussionData = useQuery(
    api.messages.getLessonDiscussion,
    lessonId ? { courseId, lessonId } : "skip"
  );

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

  // Loading state
  const isLoading = discussionData === undefined;
  const messages = (discussionData?.messages ?? []) as DiscussionMessage[];
  const hasChannel = discussionData?.channelId !== null;

  // No lesson selected state
  if (!lessonId) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <MessageSquare className="size-8 text-muted-foreground/50 mb-2" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Select a lesson to view its discussion
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 space-y-0">
          <DiscussionMessageSkeleton />
          <DiscussionMessageSkeleton />
          <DiscussionMessageSkeleton />
        </div>
      </div>
    );
  }

  // No Channel State
  if (!hasChannel) {
    return (
      <div className="flex flex-col h-full">
        <NoChannelState />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-slot="inline-discussion-content">
      {/* Messages List */}
      <ScrollArea className="flex-1 min-h-0">
        {messages.length === 0 ? (
          <EmptyDiscussionState />
        ) : (
          <div className="divide-y divide-border/50">
            {messages.map((message) => (
              <DiscussionMessageItem key={message._id} message={message} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t border-border p-3 mt-auto">
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add to the discussion..."
            disabled={isSending}
            className="min-h-[40px] max-h-[100px] resize-none text-sm"
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
        <p className="mt-1 text-xs text-muted-foreground">
          Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
