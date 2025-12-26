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

/**
 * Default editor value to prevent "Cannot resolve a Slate node from DOM node" errors.
 * Plate.js requires at least one paragraph node with text content for proper DOM-to-Slate mapping.
 */
const DEFAULT_EDITOR_VALUE = [
  { type: 'p', children: [{ text: '' }] },
] as const;

/**
 * Returns a valid editor value, falling back to default if undefined or empty.
 */
function getEditorValue(value: unknown[] | undefined): unknown[] {
  return value && value.length > 0 ? value : [...DEFAULT_EDITOR_VALUE];
}

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
    value: getEditorValue(value) as NonNullable<Parameters<typeof usePlateEditor>[0]>['value'],
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
    value: getEditorValue(value) as NonNullable<Parameters<typeof usePlateEditor>[0]>['value'],
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
 * Syncs editor content when value prop changes (e.g., navigating between lessons).
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
    value: getEditorValue(value) as NonNullable<Parameters<typeof usePlateEditor>[0]>['value'],
  });

  // Sync editor content when value prop changes
  // usePlateEditor's value option only sets initial value, not reactive updates
  React.useEffect(() => {
    const newValue = getEditorValue(value);
    // Only update if value actually changed to avoid unnecessary re-renders
    if (JSON.stringify(editor.children) !== JSON.stringify(newValue)) {
      editor.tf.setValue(newValue as Parameters<typeof editor.tf.setValue>[0]);
    }
  }, [value, editor]);

  return (
    <Plate editor={editor}>
      <EditorContainer className={cn(className)}>
        <Editor readOnly className="p-0" />
      </EditorContainer>
    </Plate>
  );
}
