'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Plate, usePlateEditor } from 'platejs/react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

import { MessageInputPlugins } from './message-input-plugins';
import { MessageFixedToolbar } from './message-fixed-toolbar';
import { Id } from '../../../convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui-plate/tooltip';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { createEmptyEditorValue, getTextFromValue, serializeEditorValue } from './message-input-utils';
import { MessageInputSkeleton } from './message-input-skeleton';

export interface MessageInputProps {
  /** Callback when user sends a message */
  onSend: (content: string) => void;
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
}

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
 */
export function MessageInput({
  onSend,
  onTyping,
  placeholder,
  disabled = false,
  maxLength = 4000,
  parentId,
  onSent,
}: MessageInputProps): React.ReactElement {
  const defaultPlaceholder = parentId ? 'Reply to thread...' : 'Type a message...';
  const resolvedPlaceholder = placeholder ?? defaultPlaceholder;
  const [editorValue, setEditorValue] = useState<unknown[]>(createEmptyEditorValue);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const editor = usePlateEditor({
    plugins: MessageInputPlugins,
    value: editorValue as NonNullable<Parameters<typeof usePlateEditor>[0]>['value'],
  });

  const textContent = useMemo(() => getTextFromValue(editorValue), [editorValue]);
  const characterCount = textContent.length;
  const isOverLimit = characterCount >= maxLength;
  const isApproachingLimit = characterCount >= maxLength - 200 && characterCount < maxLength;
  const isEmpty = textContent.trim().length === 0;
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
    if (isEmpty || isOverLimit || disabled) return;
    const serialized = serializeEditorValue(editorValue);
    onSend(serialized);
    const emptyValue = createEmptyEditorValue();
    setEditorValue(emptyValue);
    editor.tf.setValue(emptyValue);
    onSent?.();
  }, [isEmpty, isOverLimit, disabled, editorValue, onSend, editor, onSent]);

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

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative flex w-full items-end gap-2">
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

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={isEmpty || isOverLimit || disabled}
              aria-label="Send message"
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
      </Tooltip>
    </div>
  );
}

export { MessageInputSkeleton };
