"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Id } from "../../../convex/_generated/dataModel";

/**
 * Attachment data structure for file uploads.
 */
export interface AttachmentData {
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface MessageInputProps {
  /** Callback when message is sent - content is string (plain text for now) */
  onSend?: (content: string, attachments?: AttachmentData[]) => Promise<void> | void;
  /** Callback for legacy onSubmit API */
  onSubmit?: (content: string) => Promise<void> | void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Disable the input */
  disabled?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Channel ID for context */
  channelId?: Id<"channels">;
  /** Conversation ID for DMs */
  conversationId?: Id<"conversations">;
  /** Lesson ID for context */
  lessonId?: Id<"lessons">;
  /** Parent message ID for thread replies */
  parentId?: Id<"messages">;
  /** Callback when message is successfully sent */
  onSent?: () => void;
  /** Callback when user is typing */
  onTyping?: () => void;
}

/**
 * Temporary simplified message input.
 *
 * This is a basic textarea-based message input used while the rich text
 * editor is being upgraded. It supports plain text messages only.
 *
 * TODO: Replace with Potion-based rich text input once installed
 */
export function MessageInput({
  onSend,
  onSubmit,
  placeholder = "Type a message...",
  className,
  disabled = false,
  autoFocus = false,
  onSent,
  onTyping,
}: MessageInputProps): React.ReactElement {
  const [value, setValue] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (): Promise<void> => {
    const trimmedValue = value.trim();
    if (!trimmedValue || isSubmitting || disabled) return;

    setIsSubmitting(true);
    try {
      // Convert plain text to Slate/Plate JSON format for backend compatibility
      const slateContent = JSON.stringify([
        {
          type: "p",
          children: [{ text: trimmedValue }],
        },
      ]);

      if (onSend) {
        await onSend(slateContent, []);
      } else if (onSubmit) {
        await onSubmit(slateContent);
      }
      setValue("");
      onSent?.();
      textareaRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setValue(e.target.value);
    onTyping?.();
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-md">
        <AlertTriangle className="size-3" />
        <span>Rich text editor upgrading - plain text only</span>
      </div>
      <div className="flex items-end gap-2 rounded-lg border bg-background p-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          disabled
          title="Attachments coming soon"
        >
          <Paperclip className="size-4" />
        </Button>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSubmitting}
          autoFocus={autoFocus}
          className="min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          rows={1}
        />
        <Button
          onClick={handleSubmit}
          disabled={!value.trim() || isSubmitting || disabled}
          size="icon"
          className="size-8 shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default MessageInput;
