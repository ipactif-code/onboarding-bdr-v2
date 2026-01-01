'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Plate, usePlateEditor } from 'platejs/react';
import { Loader2, Mic, Send, X } from 'lucide-react';
import { toast } from 'sonner';

import { MessageInputPlugins } from './message-input-plugins';
import { MessageFixedToolbar } from './message-fixed-toolbar';
import { VoiceRecorder } from './voice-recorder';
import { FileUploadButton, type UploadResult } from './file-upload-button';
import { FileAttachment } from './file-attachment';
import { ImageAttachment } from './image-attachment';
import { Id } from '../../../convex/_generated/dataModel';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui-plate/tooltip';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { createEmptyEditorValue, getTextFromValue, serializeEditorValue } from './message-input-utils';
import { MessageInputSkeleton } from './message-input-skeleton';
import { useVoiceSender } from '@/hooks/voice/use-voice-sender';

/**
 * Attachment data for a completed upload (UploadThing).
 * Contains the URL and metadata needed to store the attachment.
 */
export interface AttachmentData {
  /** The URL where the file is stored (UploadThing URL) */
  url: string;
  /** The original file name */
  name: string;
  /** The file size in bytes */
  size: number;
  /** The MIME type of the file */
  type: string;
}

export interface MessageInputProps {
  /** Callback when user sends a message (with optional attachments) */
  onSend: (content: string, attachments?: AttachmentData[]) => void;
  /** Callback when user is typing (debounced) */
  onTyping?: () => void;
  /** Placeholder text for empty editor */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Maximum character limit (default: 4000) */
  maxLength?: number;
  /** Parent message ID for thread replies (optional) */
  parentId?: Id<'messages'>;
  /** Callback after message is sent (optional) */
  onSent?: () => void;
  /** Channel ID for voice message context (mutually exclusive with conversationId) */
  channelId?: Id<'channels'>;
  /** Conversation ID for DM voice message context (mutually exclusive with channelId) */
  conversationId?: Id<'conversations'>;
  /** Lesson ID for lesson-specific discussions (only used with channelId) */
  lessonId?: Id<'lessons'>;
  /** Callback after voice message is sent (optional) */
  onVoiceSent?: () => void;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a pending attachment with instant preview support.
 * Uses blob URLs for instant image preview before upload completes.
 */
interface PendingAttachment {
  /** Unique ID for React key (generated on file select) */
  id: string;
  /** The original file object */
  file: File;
  /** Blob URL for instant preview (created with URL.createObjectURL) */
  previewUrl: string;
  /** Upload result from UploadThing (set after upload completes) */
  uploadResult?: UploadResult;
  /** Whether the file is currently uploading */
  isUploading: boolean;
  /** Upload error message if failed */
  error?: string;
}

// ============================================================================
// PendingAttachmentPreview Component
// ============================================================================

interface PendingAttachmentPreviewProps {
  /** Pending attachment data with file and preview URL */
  pending: PendingAttachment;
  /** Callback to remove this attachment */
  onRemove: () => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Preview a single pending attachment with remove button.
 * Uses blob URLs for instant image preview before upload completes.
 */
function PendingAttachmentPreview({
  pending,
  onRemove,
  disabled,
}: PendingAttachmentPreviewProps): React.ReactElement {
  const { file, previewUrl, isUploading, error } = pending;
  const isImage = file.type.startsWith('image/');

  // Error state
  if (error) {
    return (
      <div className="relative inline-flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2">
        <span className="text-xs text-destructive">{error}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          className="h-6 w-6 shrink-0"
          aria-label="Remove attachment"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group relative inline-block">
      {isImage ? (
        <div className="relative max-w-[200px]">
          <ImageAttachment
            fileName={file.name}
            fileSize={file.size}
            fileType={file.type}
            downloadUrl={previewUrl}
            className="max-h-24"
          />
          {/* Uploading overlay for images */}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </div>
      ) : (
        <div className="relative max-w-[250px]">
          <FileAttachment
            fileName={file.name}
            fileSize={file.size}
            fileType={file.type}
            downloadUrl={previewUrl}
          />
          {/* Uploading overlay for files */}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </div>
      )}
      {/* Remove button overlay */}
      <Button
        type="button"
        variant="destructive"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        className={cn(
          'absolute -right-2 -top-2 h-6 w-6 rounded-full shadow-md',
          'opacity-0 group-hover:opacity-100 focus:opacity-100',
          'transition-opacity'
        )}
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ============================================================================
// MessageInput Component
// ============================================================================

/**
 * Rich text message input component using Plate.js.
 * Supports basic formatting (bold, italic, code, strikethrough) with keyboard shortcuts.
 *
 * Features:
 * - Enter to send, Shift+Enter for new line
 * - Character count warning when approaching limit
 * - Debounced typing indicator
 * - Auto-resize based on content
 * - @mentions with user search combobox
 * - Markdown autoformat shortcuts (**, *, _, ~~, `)
 * - Bullet and numbered lists
 * - Voice message recording (when channelId or conversationId is provided)
 */
export function MessageInput({
  onSend,
  onTyping,
  placeholder,
  disabled = false,
  maxLength = 4000,
  parentId,
  onSent,
  channelId,
  conversationId,
  lessonId,
  onVoiceSent,
}: MessageInputProps): React.ReactElement {
  const defaultPlaceholder = parentId ? 'Reply to thread...' : 'Type a message...';
  const resolvedPlaceholder = placeholder ?? defaultPlaceholder;
  const [editorValue, setEditorValue] = useState<unknown[]>(createEmptyEditorValue);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Voice recording state
  const [isVoiceMode, setIsVoiceMode] = useState(false);

  // File attachment state - track pending attachments with blob URLs for instant preview
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  // Voice recording is enabled when either channelId or conversationId is provided
  const isVoiceEnabled = Boolean(channelId || conversationId);

  // Voice sending hook - handles upload and send mutations
  const { sendVoice, isUploading: isUploadingVoice } = useVoiceSender({
    channelId,
    conversationId,
    lessonId,
    parentId,
    onSuccess: () => {
      setIsVoiceMode(false);
      onVoiceSent?.();
    },
  });

  const editor = usePlateEditor({
    plugins: MessageInputPlugins,
    value: editorValue as NonNullable<Parameters<typeof usePlateEditor>[0]>['value'],
  });

  const textContent = useMemo(() => getTextFromValue(editorValue), [editorValue]);
  const characterCount = textContent.length;
  const isOverLimit = characterCount >= maxLength;
  const isApproachingLimit = characterCount >= maxLength - 200 && characterCount < maxLength;
  const isTextEmpty = textContent.trim().length === 0;
  const hasAttachments = pendingAttachments.length > 0;
  // Get only completed attachments (uploaded successfully to UploadThing)
  const completedAttachments = useMemo(
    () =>
      pendingAttachments
        .filter((p) => p.uploadResult)
        .map((p) => p.uploadResult as UploadResult),
    [pendingAttachments]
  );
  // Check if any attachments are still uploading
  const hasUploadingAttachments = pendingAttachments.some((p) => p.isUploading);
  // Allow sending if there's text OR completed attachments (or both), but not while uploading
  const isEmpty = isTextEmpty && completedAttachments.length === 0;
  const showCharacterCount = characterCount >= maxLength - 200;

  const handleTyping = useCallback((): void => {
    if (!onTyping) return;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping();
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 300);
  }, [onTyping]);

  const handleEditorChange = useCallback(
    ({ value }: { value: unknown[] }): void => {
      setEditorValue(value);
      handleTyping();
    },
    [handleTyping]
  );

  const handleSend = useCallback((): void => {
    if (isEmpty || isOverLimit || disabled || hasUploadingAttachments) return;
    const serialized = serializeEditorValue(editorValue);
    // Pass completed attachments as AttachmentData if we have any
    const attachmentsToSend: AttachmentData[] | undefined =
      completedAttachments.length > 0
        ? completedAttachments.map((r) => ({
            url: r.url,
            name: r.name,
            size: r.size,
            type: r.type,
          }))
        : undefined;
    onSend(serialized, attachmentsToSend);
    const emptyValue = createEmptyEditorValue();
    setEditorValue(emptyValue);
    editor.tf.setValue(emptyValue);
    // Clean up blob URLs before clearing attachments
    pendingAttachments.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPendingAttachments([]);
    onSent?.();
  }, [isEmpty, isOverLimit, disabled, hasUploadingAttachments, editorValue, completedAttachments, onSend, editor, pendingAttachments, onSent]);

  // Handle voice message send - delegate to useVoiceSender hook
  const handleVoiceSend = useCallback(
    async (blob: Blob, mimeType: string, duration: number, waveformData: number[]): Promise<void> => {
      if (disabled || isUploadingVoice) return;
      await sendVoice(blob, mimeType, duration, waveformData);
    },
    [disabled, isUploadingVoice, sendVoice]
  );

  // Handle voice recording cancel
  const handleVoiceCancel = useCallback((): void => {
    setIsVoiceMode(false);
  }, []);

  // Toggle voice recording mode
  const handleVoiceToggle = useCallback((): void => {
    setIsVoiceMode((prev) => !prev);
  }, []);

  // Handle file selection - create blob URL for instant preview
  const handleFileSelect = useCallback((file: File): void => {
    const previewUrl = URL.createObjectURL(file);
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setPendingAttachments((prev) => [
      ...prev,
      {
        id: pendingId,
        file,
        previewUrl,
        isUploading: true,
      },
    ]);
  }, []);

  // Handle file upload complete - update attachment with UploadThing result
  const handleUploadComplete = useCallback((uploadResult: UploadResult): void => {
    // Find the first pending attachment that is still uploading
    // We match by order rather than filename because UploadThing may modify filenames
    setPendingAttachments((prev) => {
      const uploadingIndex = prev.findIndex((p) => p.isUploading);
      if (uploadingIndex === -1) return prev;

      return prev.map((p, i) =>
        i === uploadingIndex
          ? { ...p, uploadResult, isUploading: false }
          : p
      );
    });
  }, []);

  // Handle file upload error - mark attachment as failed
  const handleUploadError = useCallback((error: string, file: File): void => {
    setPendingAttachments((prev) =>
      prev.map((p) =>
        p.file === file ? { ...p, isUploading: false, error } : p
      )
    );
  }, []);

  // Handle removing a pending attachment - clean up blob URL
  const handleRemoveAttachment = useCallback((pendingId: string): void => {
    setPendingAttachments((prev) => {
      const toRemove = prev.find((p) => p.id === pendingId);
      if (toRemove) {
        URL.revokeObjectURL(toRemove.previewUrl);
      }
      return prev.filter((p) => p.id !== pendingId);
    });
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (isOverLimit) {
          toast.error(`Message exceeds ${maxLength} character limit`);
          return;
        }
        handleSend();
      }
    },
    [handleSend, isOverLimit, maxLength]
  );

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      pendingAttachments.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Only cleanup on unmount, not on every pendingAttachments change
  }, []);

  // Voice recording mode - full-width VoiceRecorder
  if (isVoiceMode) {
    return (
      <div className="relative w-full">
        <VoiceRecorder
          onSend={handleVoiceSend}
          onCancel={handleVoiceCancel}
          disabled={disabled || isUploadingVoice}
          className={cn(isUploadingVoice && 'opacity-70 pointer-events-none')}
        />
        {isUploadingVoice && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg"
            role="status"
            aria-label="Uploading voice message"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Sending voice message...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Text input mode (default)
  return (
    <div className="flex w-full flex-col gap-2">
      {/* Pending attachments preview row */}
      {hasAttachments && (
        <div
          className="flex flex-wrap gap-2 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/30 p-2"
          role="list"
          aria-label="Pending attachments"
        >
          {pendingAttachments.map((pending) => (
            <div key={pending.id} role="listitem">
              <PendingAttachmentPreview
                pending={pending}
                onRemove={() => handleRemoveAttachment(pending.id)}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      )}

      {/* Input row with upload button, editor, and action buttons */}
      <div className="relative flex w-full items-end gap-2">
        {/* File upload button - positioned before the editor */}
        {/* Note: Tooltip removed due to Fragment/asChild incompatibility. */}
        {/* FileUploadButton has aria-label for accessibility. */}
        <FileUploadButton
          onFileSelect={handleFileSelect}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
          disabled={disabled}
        />

        <div
          className={cn(
            'relative flex-1 rounded-lg border bg-background transition-colors',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            disabled && 'cursor-not-allowed opacity-50',
            isOverLimit && 'border-destructive focus-within:ring-destructive'
          )}
        >
          <Plate editor={editor} onChange={handleEditorChange}>
            <div className="flex flex-col">
              <MessageFixedToolbar />
              <EditorContainer className="border-0">
                <Editor
                  ref={editorRef}
                  placeholder={resolvedPlaceholder}
                  disabled={disabled}
                  onKeyDown={handleKeyDown}
                  className={cn(
                    'min-h-[40px] max-h-[160px] overflow-y-auto px-3 py-2 text-sm',
                    'resize-none'
                  )}
                  aria-label="Message input"
                  aria-describedby={showCharacterCount ? 'char-count' : undefined}
                />
              </EditorContainer>
            </div>
          </Plate>

          {showCharacterCount && (
            <div
              id="char-count"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={cn(
                'absolute bottom-1 right-12 text-xs font-medium',
                isOverLimit && 'text-destructive',
                isApproachingLimit && 'text-amber-500 dark:text-amber-400'
              )}
            >
              {characterCount}/{maxLength}
            </div>
          )}
        </div>

        {/* Voice recording button - only shown when voice is enabled */}
        {isVoiceEnabled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={handleVoiceToggle}
                disabled={disabled}
                aria-label="Record voice message"
                className="shrink-0 min-h-11 min-w-11"
              >
                <Mic className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Record voice message</TooltipContent>
          </Tooltip>
        )}

        {/* Send button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                type="button"
                size="icon"
                onClick={handleSend}
                disabled={isEmpty || isOverLimit || disabled || hasUploadingAttachments}
                aria-label={hasUploadingAttachments ? 'Waiting for uploads to complete' : 'Send message'}
                className="shrink-0 min-h-11 min-w-11"
              >
                <Send className="size-4" />
            </Button>
          </span>
        </TooltipTrigger>
        {isOverLimit && (
          <TooltipContent side="top">
            Message exceeds {maxLength} character limit
          </TooltipContent>
        )}
        {hasUploadingAttachments && !isOverLimit && (
          <TooltipContent side="top">
            Waiting for uploads to complete
          </TooltipContent>
        )}
      </Tooltip>
      </div>
    </div>
  );
}

export { MessageInputSkeleton };
