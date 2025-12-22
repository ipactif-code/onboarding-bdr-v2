'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  BoldPlugin,
  CodePlugin,
  ItalicPlugin,
} from '@platejs/basic-nodes/react';
import { Plate, usePlateEditor } from 'platejs/react';
import { Send } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { CodeLeaf } from '@/components/ui/code-node';

/**
 * Default editor value for empty state.
 * Plate.js requires at least one paragraph node with text content.
 */
function createEmptyEditorValue(): { type: string; children: { text: string }[] }[] {
  return [{ type: 'p', children: [{ text: '' }] }];
}

/**
 * Minimal plugins for messaging - only basic text formatting.
 * Keeps the message input lightweight compared to the full editor.
 */
const MessageInputPlugins = [
  BoldPlugin,
  ItalicPlugin,
  CodePlugin.configure({
    node: { component: CodeLeaf },
    shortcuts: { toggle: { keys: 'mod+e' } },
  }),
];

/**
 * Extracts plain text from Plate.js editor value.
 * Used for character counting and empty state detection.
 */
function getTextFromValue(value: unknown[]): string {
  let text = '';

  function extractText(node: unknown): void {
    if (typeof node === 'object' && node !== null) {
      const nodeObj = node as Record<string, unknown>;
      if (typeof nodeObj.text === 'string') {
        text += nodeObj.text;
      }
      if (Array.isArray(nodeObj.children)) {
        for (const child of nodeObj.children) {
          extractText(child);
        }
      }
    }
  }

  for (const node of value) {
    extractText(node);
  }

  return text;
}

/**
 * Serializes Plate.js editor value to a JSON string for sending.
 * The backend can deserialize and render this rich text content.
 */
function serializeEditorValue(value: unknown[]): string {
  return JSON.stringify(value);
}

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
}

/**
 * Rich text message input component using Plate.js.
 * Supports basic formatting (bold, italic, code) with keyboard shortcuts.
 *
 * Features:
 * - Enter to send, Shift+Enter for new line
 * - Character count warning when approaching limit
 * - Debounced typing indicator
 * - Auto-resize based on content
 */
export function MessageInput({
  onSend,
  onTyping,
  placeholder = 'Type a message...',
  disabled = false,
  maxLength = 4000,
}: MessageInputProps): React.ReactElement {
  const [editorValue, setEditorValue] = useState<unknown[]>(
    createEmptyEditorValue
  );
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Create the Plate editor instance
  const editor = usePlateEditor({
    plugins: MessageInputPlugins,
    value: editorValue as NonNullable<
      Parameters<typeof usePlateEditor>[0]
    >['value'],
  });

  // Calculate current text content and character count
  const textContent = useMemo(
    () => getTextFromValue(editorValue),
    [editorValue]
  );
  const characterCount = textContent.length;
  const isOverLimit = characterCount > maxLength;
  const isEmpty = textContent.trim().length === 0;
  const showCharacterCount = characterCount > maxLength - 200; // Show when within 200 chars of limit

  // Debounced typing indicator
  const handleTyping = useCallback((): void => {
    if (!onTyping) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Trigger typing callback
    onTyping();

    // Set new timeout to prevent rapid-fire calls
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 300);
  }, [onTyping]);

  // Handle editor value changes
  const handleEditorChange = useCallback(
    ({ value }: { value: unknown[] }): void => {
      setEditorValue(value);
      handleTyping();
    },
    [handleTyping]
  );

  // Send message handler
  const handleSend = useCallback((): void => {
    if (isEmpty || isOverLimit || disabled) return;

    const serialized = serializeEditorValue(editorValue);
    onSend(serialized);

    // Reset editor to empty state
    const emptyValue = createEmptyEditorValue();
    setEditorValue(emptyValue);
    editor.tf.setValue(emptyValue);
  }, [isEmpty, isOverLimit, disabled, editorValue, onSend, editor]);

  // Handle keyboard events for send (Enter) and new line (Shift+Enter)
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
      // Shift+Enter is handled by Plate.js default behavior (insertSoftBreak)
    },
    [handleSend]
  );

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative flex w-full items-end gap-2">
      {/* Editor container */}
      <div
        className={cn(
          'relative flex-1 rounded-lg border bg-background transition-colors',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50',
          isOverLimit && 'border-destructive focus-within:ring-destructive'
        )}
      >
        <Plate editor={editor} onChange={handleEditorChange}>
          <EditorContainer className="border-0">
            <Editor
              ref={editorRef}
              placeholder={placeholder}
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
        </Plate>

        {/* Character count indicator */}
        {showCharacterCount && (
          <div
            id="char-count"
            className={cn(
              'absolute bottom-1 right-12 text-xs',
              isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'
            )}
          >
            {characterCount}/{maxLength}
          </div>
        )}
      </div>

      {/* Send button */}
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
    </div>
  );
}

/**
 * Skeleton loading state for MessageInput.
 */
export function MessageInputSkeleton(): React.ReactElement {
  return (
    <div className="flex w-full items-end gap-2">
      <div className="h-10 flex-1 animate-pulse rounded-lg bg-muted" />
      <div className="size-8 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
