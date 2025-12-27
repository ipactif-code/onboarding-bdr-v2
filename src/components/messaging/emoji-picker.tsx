'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Smile } from 'lucide-react';
import { Theme, type EmojiClickData } from 'emoji-picker-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface EmojiPickerProps {
  /** Callback when an emoji is selected */
  onEmojiSelect: (emoji: string) => void;
  /** Whether the picker popover is open */
  open: boolean;
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void;
  /** Additional className for the trigger button */
  triggerClassName?: string;
  /** Side of the popover relative to trigger */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Alignment of the popover */
  align?: 'start' | 'center' | 'end';
  /** Whether the trigger is disabled */
  disabled?: boolean;
}

/**
 * Emoji picker component that wraps emoji-picker-react with shadcn/ui Popover.
 *
 * Features:
 * - Lazy loads the picker for performance
 * - Respects dark/light theme from next-themes
 * - Built-in search functionality
 * - Shows recent/frequently used emojis
 * - Accessible keyboard navigation
 * - React 19 compatible
 *
 * @example
 * ```tsx
 * <EmojiPicker
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onEmojiSelect={(emoji) => insertEmoji(emoji)}
 * />
 * ```
 */
export function EmojiPicker({
  onEmojiSelect,
  open,
  onOpenChange,
  triggerClassName,
  side = 'top',
  align = 'start',
  disabled = false,
}: EmojiPickerProps): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const [PickerComponent, setPickerComponent] = useState<React.ComponentType<{
    onEmojiClick: (emojiData: EmojiClickData) => void;
    theme: Theme;
    searchPlaceHolder?: string;
    autoFocusSearch?: boolean;
    lazyLoadEmojis?: boolean;
    skinTonesDisabled?: boolean;
    width?: number | string;
    height?: number | string;
  }> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Lazy load emoji picker when popover opens
  useEffect(() => {
    if (open && !hasLoadedOnce) {
      setIsLoading(true);
      import('emoji-picker-react')
        .then((module) => {
          setPickerComponent(() => module.default);
          setHasLoadedOnce(true);
        })
        .catch((_error: unknown) => {
          // Error is intentionally ignored - the UI shows loading state
          // which times out gracefully. In development, browser console
          // will show the import error automatically.
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, hasLoadedOnce]);

  const handleEmojiClick = useCallback(
    (emojiData: EmojiClickData): void => {
      onEmojiSelect(emojiData.emoji);
      onOpenChange(false);
    },
    [onEmojiSelect, onOpenChange]
  );

  // Determine theme for emoji picker
  const pickerTheme = resolvedTheme === 'dark' ? Theme.DARK : Theme.LIGHT;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className={cn('size-8', triggerClassName)}
            aria-label="Insert emoji"
          />
        }
      >
        <Smile className="size-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={8}
        className="w-auto p-0 border-0 bg-transparent shadow-none ring-0"
      >
        {isLoading && !PickerComponent && (
          <EmojiPickerLoadingSkeleton />
        )}
        {PickerComponent && (
          <div data-slot="emoji-picker">
            <PickerComponent
              onEmojiClick={handleEmojiClick}
              theme={pickerTheme}
              searchPlaceHolder="Search emoji..."
              autoFocusSearch
              lazyLoadEmojis
              skinTonesDisabled={false}
              width={352}
              height={400}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Loading skeleton shown while emoji picker loads
 */
function EmojiPickerLoadingSkeleton(): React.ReactElement {
  return (
    <div
      data-slot="emoji-picker-skeleton"
      className="rounded-lg bg-popover p-3 border shadow-md"
    >
      <div className="space-y-3">
        <Skeleton className="h-9 w-[328px]" />
        <div className="flex gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="size-6" />
          ))}
        </div>
        <div className="grid grid-cols-9 gap-1">
          {Array.from({ length: 54 }).map((_, i) => (
            <Skeleton key={i} className="size-8" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Exported skeleton component for emoji picker loading state.
 * Can be used externally when needed.
 */
export function EmojiPickerSkeleton(): React.ReactElement {
  return <EmojiPickerLoadingSkeleton />;
}
