"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactElement,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { useQuery } from "convex/react";
import { Send, AtSign, Loader2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../convex/_generated/api").api;
import type { Id } from "../../../../convex/_generated/dataModel";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
} from "@/components/ui/popover";

// ============================================================================
// Types
// ============================================================================

type CommentType = "page" | "inline";

export interface CommentInputProps {
  /** Document ID to create comment for */
  documentId: Id<"kbDocuments">;
  /** Comment type (page or inline) */
  type?: CommentType;
  /** Parent comment ID for replies */
  parentId?: Id<"kbDocumentComments">;
  /** Selection start position for inline comments */
  selectionStart?: number;
  /** Selection end position for inline comments */
  selectionEnd?: number;
  /** Selected text for inline comments */
  selectedText?: string;
  /** Callback when comment is submitted */
  onSubmit: (content: string) => Promise<void>;
  /** Callback when input is cancelled */
  onCancel?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is in a compact mode */
  compact?: boolean;
  /** Whether to auto-focus the input */
  autoFocus?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface UserSuggestion {
  _id: Id<"users">;
  name: string;
  avatarUrl?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Extract the current mention query from text at cursor position.
 * Returns the text after @ if currently typing a mention.
 */
function getMentionQuery(text: string, cursorPosition: number): string | null {
  // Get text before cursor
  const textBeforeCursor = text.slice(0, cursorPosition);

  // Find the last @ symbol
  const lastAtIndex = textBeforeCursor.lastIndexOf("@");

  if (lastAtIndex === -1) {
    return null;
  }

  // Check if there's a space between @ and cursor (mention completed)
  const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
  if (textAfterAt.includes(" ") || textAfterAt.includes("\n")) {
    return null;
  }

  // Check if @ is at start or preceded by whitespace
  if (lastAtIndex > 0) {
    const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
    if (charBeforeAt && !/\s/.test(charBeforeAt)) {
      return null;
    }
  }

  return textAfterAt;
}

// ============================================================================
// UserMentionList Component
// ============================================================================

interface UserMentionListProps {
  query: string;
  onSelect: (user: UserSuggestion) => void;
  onClose: () => void;
}

function UserMentionList({
  query,
  onSelect,
  onClose,
}: UserMentionListProps): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Query users based on search
  const users = useQuery(api.users.searchByName, {
    query: query || "",
    limit: 5,
  });

  // Filter users by query (client-side additional filtering)
  const filteredUsers = users?.filter(
    (user: UserSuggestion) =>
      user.name.toLowerCase().includes(query.toLowerCase())
  );

  // Reset selection when users change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!filteredUsers || filteredUsers.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % filteredUsers.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(
            (i) => (i - 1 + filteredUsers.length) % filteredUsers.length
          );
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            onSelect(filteredUsers[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredUsers, selectedIndex, onSelect, onClose]
  );

  // Expose keyboard handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent): void => {
      handleKeyDown(e as unknown as KeyboardEvent);
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return (): void => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [handleKeyDown]);

  if (users === undefined) {
    return (
      <div className="p-2 space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (!filteredUsers || filteredUsers.length === 0) {
    return (
      <div className="p-3 text-sm text-muted-foreground text-center">
        No users found
      </div>
    );
  }

  return (
    <div className="py-1" role="listbox">
      {/* Special mentions */}
      {query === "" && (
        <>
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left",
              selectedIndex === -1 && "bg-muted"
            )}
            onClick={() => onSelect({ _id: "here" as Id<"users">, name: "here" })}
          >
            <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center">
              <AtSign className="size-3.5 text-primary" />
            </div>
            <div>
              <span className="font-medium">@here</span>
              <span className="text-muted-foreground ml-2">
                Notify all online users
              </span>
            </div>
          </button>
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left",
              selectedIndex === -2 && "bg-muted"
            )}
            onClick={() =>
              onSelect({ _id: "everyone" as Id<"users">, name: "everyone" })
            }
          >
            <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center">
              <AtSign className="size-3.5 text-primary" />
            </div>
            <div>
              <span className="font-medium">@everyone</span>
              <span className="text-muted-foreground ml-2">
                Notify all users with access
              </span>
            </div>
          </button>
          <div className="border-t my-1" />
        </>
      )}

      {/* User suggestions */}
      {filteredUsers.map((user: UserSuggestion, index: number) => (
        <button
          key={user._id}
          type="button"
          role="option"
          aria-selected={index === selectedIndex}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left",
            index === selectedIndex && "bg-muted"
          )}
          onClick={() => onSelect(user)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <Avatar size="sm">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            ) : null}
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{user.name}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// CommentInput Component
// ============================================================================

/**
 * Comment input with @mention autocomplete.
 *
 * Detects @ character and shows user autocomplete dropdown.
 * Supports both page-level and inline comments.
 *
 * @example
 * ```tsx
 * <CommentInput
 *   documentId={documentId}
 *   type="page"
 *   onSubmit={async (content) => {
 *     await createComment({
 *       documentId,
 *       type: "page",
 *       content,
 *     });
 *   }}
 *   placeholder="Add a comment..."
 * />
 * ```
 */
export function CommentInput({
  documentId: _documentId,
  type: _type = "page",
  parentId: _parentId,
  selectionStart: _selectionStart,
  selectionEnd: _selectionEnd,
  selectedText,
  onSubmit,
  onCancel,
  placeholder = "Write a comment...",
  compact = false,
  autoFocus = false,
  className,
}: CommentInputProps): ReactElement {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionAnchorRef = useRef<HTMLDivElement>(null);

  // Handle text change
  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;

    setContent(value);
    setCursorPosition(position);

    // Check for mention
    const query = getMentionQuery(value, position);
    setMentionQuery(query);
  }, []);

  // Handle cursor position change
  const handleSelect = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const position = e.target.selectionStart || 0;
    setCursorPosition(position);

    const query = getMentionQuery(e.target.value, position);
    setMentionQuery(query);
  }, []);

  // Handle mention selection
  const handleMentionSelect = useCallback(
    (user: UserSuggestion) => {
      if (!textareaRef.current) return;

      const textBeforeCursor = content.slice(0, cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex === -1) return;

      // Replace @query with @username
      const beforeMention = content.slice(0, lastAtIndex);
      const afterCursor = content.slice(cursorPosition);
      const newContent = `${beforeMention}@${user.name} ${afterCursor}`;

      setContent(newContent);
      setMentionQuery(null);

      // Set cursor after the inserted mention
      const newCursorPosition = lastAtIndex + user.name.length + 2;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newCursorPosition;
          textareaRef.current.selectionEnd = newCursorPosition;
          textareaRef.current.focus();
        }
      }, 0);
    },
    [content, cursorPosition]
  );

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent("");
      setMentionQuery(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [content, isSubmitting, onSubmit]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Don't handle if mention popover is open (it handles its own keys)
      if (mentionQuery !== null) return;

      // Submit on Cmd/Ctrl + Enter
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }

      // Cancel on Escape
      if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        onCancel();
      }
    },
    [mentionQuery, handleSubmit, onCancel]
  );

  // Close mention popover
  const closeMentionPopover = useCallback(() => {
    setMentionQuery(null);
  }, []);

  const showMentionPopover = mentionQuery !== null;

  return (
    <div
      data-slot="comment-input"
      className={cn("relative", className)}
      ref={mentionAnchorRef}
    >
      {/* Selected text quote for inline comments */}
      {selectedText && (
        <div className="mb-2 border-l-2 border-primary/50 bg-muted/50 px-3 py-2 rounded-r-md">
          <p className="text-sm text-muted-foreground italic line-clamp-2">
            &ldquo;{selectedText}&rdquo;
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "resize-none pr-12",
            compact ? "min-h-12" : "min-h-20"
          )}
          autoFocus={autoFocus}
          disabled={isSubmitting}
          aria-label="Comment input"
        />

        {/* Submit button */}
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            aria-label="Send comment"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Cancel button for inline comments */}
      {onCancel && (
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Mention popover */}
      <Popover open={showMentionPopover} onOpenChange={closeMentionPopover}>
        <PopoverContent
          className="w-64 p-0"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <UserMentionList
            query={mentionQuery ?? ""}
            onSelect={handleMentionSelect}
            onClose={closeMentionPopover}
          />
        </PopoverContent>
      </Popover>

      {/* Helper text */}
      {!compact && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Type @ to mention someone. Press{" "}
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">
            {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}
          </kbd>
          +
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Enter</kbd>{" "}
          to send.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// CommentInputSkeleton Component
// ============================================================================

export function CommentInputSkeleton(): ReactElement {
  return (
    <div data-slot="comment-input-skeleton" className="space-y-2">
      <Skeleton className="h-20 w-full" />
      <div className="flex justify-end">
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}
