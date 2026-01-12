"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Send, Paperclip, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Id } from "../../../convex/_generated/dataModel";
import { VoiceRecorder } from "@/components/messaging/voice-recorder";
import { useVoiceSender } from "@/hooks/voice";
import { useFileUpload } from "@/hooks/use-file-upload";
import { toast } from "sonner";

/**
 * Attachment data structure for file uploads (UploadThing URLs).
 */
export interface AttachmentData {
  url: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Options for sending a message with attachments.
 */
export interface SendMessageOptions {
  /** Attachment URLs from UploadThing */
  attachments?: AttachmentData[];
  /** Attachment IDs from Convex storage */
  attachmentIds?: Id<"messageAttachments">[];
}

export interface MessageInputProps {
  /** Callback when message is sent - content is string (plain text for now) */
  onSend?: (content: string, options?: SendMessageOptions) => Promise<void> | void;
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
 * TODO: Enhance with rich text formatting capabilities
 */
export function MessageInput({
  onSend,
  onSubmit,
  placeholder = "Type a message...",
  className,
  disabled = false,
  autoFocus = false,
  channelId,
  conversationId,
  lessonId,
  parentId,
  onSent,
  onTyping,
}: MessageInputProps): React.ReactElement {
  const [value, setValue] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isVoiceMode, setIsVoiceMode] = React.useState(false);
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Voice message sender hook
  const { sendVoice, isUploading: isVoiceUploading } = useVoiceSender({
    channelId,
    conversationId,
    lessonId,
    parentId,
    onSuccess: () => {
      setIsVoiceMode(false);
      onSent?.();
    },
    onError: () => {
      // Error toast is already shown by useVoiceSender
    },
  });

  // File upload hook for attachments
  const { upload: uploadFile, isUploading: isFileUploading } = useFileUpload({
    onError: (error) => {
      toast.error(error);
    },
  });

  const handleSubmit = async (): Promise<void> => {
    const trimmedValue = value.trim();
    const hasContent = trimmedValue.length > 0;
    const hasAttachments = pendingFiles.length > 0;

    // Allow sending if there's text OR attachments
    if ((!hasContent && !hasAttachments) || isSubmitting || disabled || isFileUploading) return;

    setIsSubmitting(true);
    try {
      // Upload all pending files first
      const uploadedAttachmentIds: Id<"messageAttachments">[] = [];
      if (hasAttachments) {
        for (const file of pendingFiles) {
          const attachmentId = await uploadFile(file);
          if (attachmentId) {
            uploadedAttachmentIds.push(attachmentId);
          } else {
            // Upload failed - error toast already shown by useFileUpload
            // Stop sending if any upload fails
            return;
          }
        }
      }

      // Convert plain text to Slate/Plate JSON format for backend compatibility
      // Use empty paragraph if no text content (attachments-only message)
      const slateContent = JSON.stringify([
        {
          type: "p",
          children: [{ text: trimmedValue }],
        },
      ]);

      if (onSend) {
        await onSend(slateContent, {
          attachmentIds: uploadedAttachmentIds.length > 0 ? uploadedAttachmentIds : undefined,
        });
      } else if (onSubmit) {
        await onSubmit(slateContent);
      }
      setValue("");
      setPendingFiles([]); // Clear pending files after successful send
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

  // Handle file selection from input
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const selectedFiles = Array.from(files);
    // For now, just show a toast - full implementation needs upload integration
    toast.info(`Selected ${selectedFiles.length} file(s): ${selectedFiles.map(f => f.name).join(", ")}`);
    setPendingFiles((prev) => [...prev, ...selectedFiles]);

    // Reset the input so the same file can be selected again
    e.target.value = "";
  };

  // Handle attachment button click
  const handleAttachmentClick = (): void => {
    fileInputRef.current?.click();
  };

  // Handle voice recording send
  const handleVoiceSend = async (
    blob: Blob,
    mimeType: string,
    duration: number,
    waveformData: number[]
  ): Promise<void> => {
    await sendVoice(blob, mimeType, duration, waveformData);
  };

  // Handle voice recording cancel
  const handleVoiceCancel = (): void => {
    setIsVoiceMode(false);
  };

  // Toggle voice recording mode
  const handleVoiceToggle = (): void => {
    setIsVoiceMode((prev) => !prev);
  };

  // Show voice recorder when in voice mode
  if (isVoiceMode) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <VoiceRecorder
          onSend={handleVoiceSend}
          onCancel={handleVoiceCancel}
          disabled={disabled || isVoiceUploading}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-md">
        <AlertTriangle className="size-3" />
        <span>Rich text editor upgrading - plain text only</span>
      </div>

      {/* Pending files indicator */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2">
          {pendingFiles.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
            >
              <Paperclip className="size-3" />
              {file.name}
              <button
                type="button"
                onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
                className="ml-1 text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${file.name}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-lg border bg-background p-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />

        {/* Attachment button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleAttachmentClick}
          disabled={disabled || isSubmitting}
          title="Add attachment"
          aria-label="Add attachment"
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

        {/* Voice recording button - only show when channelId or conversationId is available */}
        {(channelId || conversationId) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleVoiceToggle}
            disabled={disabled || isSubmitting}
            title="Record voice message"
            aria-label="Record voice message"
          >
            <Mic className="size-4" />
          </Button>
        )}

        {/* Send button */}
        <Button
          onClick={handleSubmit}
          disabled={(!value.trim() && pendingFiles.length === 0) || isSubmitting || isFileUploading || disabled}
          size="icon"
          className="size-8 shrink-0"
          aria-label="Send message"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default MessageInput;
