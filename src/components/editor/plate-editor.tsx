'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Plate, usePlateEditor } from 'platejs/react';
import { Editor, EditorContainer } from '@/components/ui/editor';

import { BaseEditorKit } from './editor-base-kit';
import { BasicMarksKit } from './plugins/basic-marks-kit';
import { SlashKit } from './plugins/slash-kit';
import { DndKit } from './plugins/dnd-kit';
import { BlockMenuKit } from './plugins/block-menu-kit';
import { AutoformatKit } from './plugins/autoformat-kit';
import { ExitBreakKit } from './plugins/exit-break-kit';
import { DiscussionKit } from './plugins/discussion-kit';
import { FixedToolbarKit } from './plugins/fixed-toolbar-kit';
import { FloatingToolbarKit } from './plugins/floating-toolbar-kit';

// Combine all plugins
const plugins = [
  ...BaseEditorKit,
  ...BasicMarksKit,
  ...SlashKit,
  ...DndKit,
  ...BlockMenuKit,
  ...AutoformatKit,
  ...ExitBreakKit,
  ...DiscussionKit,
  ...FixedToolbarKit,
  ...FloatingToolbarKit,
];

// Plugins without fixed toolbar (for embedded editors)
const pluginsWithoutFixedToolbar = [
  ...BaseEditorKit,
  ...BasicMarksKit,
  ...SlashKit,
  ...DndKit,
  ...BlockMenuKit,
  ...AutoformatKit,
  ...ExitBreakKit,
  ...DiscussionKit,
  ...FloatingToolbarKit,
];

interface PlateEditorProps {
  value?: unknown[];
  onChange?: (value: unknown[]) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  autoFocus?: boolean;
  showFixedToolbar?: boolean;
}

/**
 * Rich text editor component using Plate.js.
 * Used for creating and editing lesson content.
 */
export function PlateEditor({
  value,
  onChange,
  placeholder = 'Start writing...',
  readOnly = false,
  className,
  autoFocus = false,
  showFixedToolbar = true,
}: PlateEditorProps): React.ReactElement {
  const editor = usePlateEditor({
    plugins: showFixedToolbar ? plugins : pluginsWithoutFixedToolbar,
    value: value as Parameters<typeof usePlateEditor>[0]['value'],
    override: {
      components: {},
    },
  });

  return (
    <Plate
      editor={editor}
      onChange={({ value: newValue }) => {
        onChange?.(newValue);
      }}
    >
      <EditorContainer className={cn('border rounded-lg', className)}>
        <Editor
          placeholder={placeholder}
          readOnly={readOnly}
          autoFocus={autoFocus}
          className="min-h-[200px] p-4"
        />
      </EditorContainer>
    </Plate>
  );
}

/**
 * Simple text editor for basic content editing.
 */
export function SimpleEditor({
  value,
  onChange,
  placeholder = 'Enter text...',
  className,
}: Omit<PlateEditorProps, 'readOnly' | 'autoFocus' | 'showFixedToolbar'>): React.ReactElement {
  const editor = usePlateEditor({
    plugins: [...BasicMarksKit, ...AutoformatKit, ...FloatingToolbarKit],
    value: value as Parameters<typeof usePlateEditor>[0]['value'],
  });

  return (
    <Plate
      editor={editor}
      onChange={({ value: newValue }) => {
        onChange?.(newValue);
      }}
    >
      <EditorContainer className={cn('border rounded-lg', className)}>
        <Editor
          placeholder={placeholder}
          className="min-h-[100px] p-3"
        />
      </EditorContainer>
    </Plate>
  );
}

/**
 * Read-only content renderer.
 */
export function ContentRenderer({
  value,
  className,
}: {
  value?: unknown[];
  className?: string;
}): React.ReactElement {
  const editor = usePlateEditor({
    plugins: pluginsWithoutFixedToolbar,
    value: value as Parameters<typeof usePlateEditor>[0]['value'],
  });

  return (
    <Plate editor={editor}>
      <EditorContainer className={cn(className)}>
        <Editor readOnly className="p-0" />
      </EditorContainer>
    </Plate>
  );
}
