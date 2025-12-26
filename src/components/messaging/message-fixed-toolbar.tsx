'use client';

import * as React from 'react';

import { Bold, Code, Italic, Strikethrough } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Toolbar, ToolbarGroup } from '@/components/ui/toolbar';
import { MarkToolbarButton } from '@/components/ui/mark-toolbar-button';

/**
 * Fixed toolbar for MessageInput with basic formatting buttons.
 * Includes Bold, Italic, Code, and Strikethrough marks.
 * Styled compactly to fit within the messaging UI.
 */
export function MessageFixedToolbar({
  className,
  ...props
}: React.ComponentProps<typeof Toolbar>): React.ReactElement {
  return (
    <Toolbar
      data-slot="message-fixed-toolbar"
      className={cn(
        'flex items-center gap-0.5 border-b border-border/40 bg-muted/30 px-1 py-0.5',
        className
      )}
      {...props}
    >
      <ToolbarGroup>
        <MarkToolbarButton
          nodeType="bold"
          tooltip="Bold (Ctrl+B)"
          size="sm"
          aria-label="Bold"
        >
          <Bold className="size-3.5" />
        </MarkToolbarButton>

        <MarkToolbarButton
          nodeType="italic"
          tooltip="Italic (Ctrl+I)"
          size="sm"
          aria-label="Italic"
        >
          <Italic className="size-3.5" />
        </MarkToolbarButton>

        <MarkToolbarButton
          nodeType="strikethrough"
          tooltip="Strikethrough"
          size="sm"
          aria-label="Strikethrough"
        >
          <Strikethrough className="size-3.5" />
        </MarkToolbarButton>

        <MarkToolbarButton
          nodeType="code"
          tooltip="Code (Ctrl+E)"
          size="sm"
          aria-label="Code"
        >
          <Code className="size-3.5" />
        </MarkToolbarButton>
      </ToolbarGroup>
    </Toolbar>
  );
}
