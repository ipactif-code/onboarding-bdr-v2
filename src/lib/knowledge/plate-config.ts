/**
 * Plate.js Configuration for Knowledge Base
 *
 * This module provides EditorKit plugin assembly and configuration helpers
 * for the Knowledge Base collaborative editor. It builds upon the existing
 * editor infrastructure while adding YJS collaboration support.
 *
 * @module lib/knowledge/plate-config
 */

import type { Value } from 'platejs';

// Re-export the base editor kit from existing infrastructure
import { BaseEditorKit } from '@/components/editor/editor-base-kit';
import { BasicMarksKit } from '@/components/editor/plugins/basic-marks-kit';
import { SlashKit } from '@/components/editor/plugins/slash-kit';
import { DndKit } from '@/components/editor/plugins/dnd-kit';
import { BlockMenuKit } from '@/components/editor/plugins/block-menu-kit';
import { AutoformatKit } from '@/components/editor/plugins/autoformat-kit';
import { ExitBreakKit } from '@/components/editor/plugins/exit-break-kit';
import { DiscussionKit } from '@/components/editor/plugins/discussion-kit';
import { FloatingToolbarKit } from '@/components/editor/plugins/floating-toolbar-kit';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/**
 * Editor plugin configuration for knowledge base documents.
 * Defines which plugin kits to include in the editor.
 */
export interface KnowledgeEditorPluginConfig {
  /** Include drag-and-drop functionality */
  enableDnd: boolean;
  /** Include slash command menu */
  enableSlashCommands: boolean;
  /** Include block context menu */
  enableBlockMenu: boolean;
  /** Include floating toolbar */
  enableFloatingToolbar: boolean;
  /** Include markdown shortcuts (autoformat) */
  enableMarkdownShortcuts: boolean;
  /** Include discussion/comment features */
  enableDiscussion: boolean;
}

/**
 * Default editor value - an empty paragraph.
 * Plate.js requires at least one node for proper initialization.
 */
export const DEFAULT_EDITOR_VALUE: Value = [
  { type: 'p', children: [{ text: '' }] },
];

// --------------------------------------------------------------------------
// Plugin Assembly
// --------------------------------------------------------------------------

/**
 * Default plugin configuration for knowledge base documents.
 * Enables all collaborative features by default.
 */
export const DEFAULT_PLUGIN_CONFIG: KnowledgeEditorPluginConfig = {
  enableDnd: true,
  enableSlashCommands: true,
  enableBlockMenu: true,
  enableFloatingToolbar: true,
  enableMarkdownShortcuts: true,
  enableDiscussion: true,
};

/**
 * Creates the default plugin array for knowledge base editors.
 *
 * This assembles all editor plugins from the existing infrastructure,
 * configured for collaborative document editing. The YjsPlugin should
 * be added separately by the editor component after this array.
 *
 * @param config - Optional configuration to enable/disable specific features
 * @returns Array of configured Plate.js plugins
 *
 * @example
 * ```typescript
 * const editor = usePlateEditor({
 *   plugins: [
 *     ...createDefaultPlugins(),
 *     YjsPlugin.configure({ ... }),
 *   ],
 * });
 * ```
 */
export function createDefaultPlugins(
  config: Partial<KnowledgeEditorPluginConfig> = {}
): unknown[] {
  const mergedConfig: KnowledgeEditorPluginConfig = {
    ...DEFAULT_PLUGIN_CONFIG,
    ...config,
  };

  const plugins: unknown[] = [
    // Base editor features (blocks, tables, media, etc.)
    ...BaseEditorKit,
    // Text formatting marks (bold, italic, etc.)
    ...BasicMarksKit,
    // Exit break handling
    ...ExitBreakKit,
  ];

  // Optional features based on configuration
  if (mergedConfig.enableDnd) {
    plugins.push(...DndKit);
  }

  if (mergedConfig.enableSlashCommands) {
    plugins.push(...SlashKit);
  }

  if (mergedConfig.enableBlockMenu) {
    plugins.push(...BlockMenuKit);
  }

  if (mergedConfig.enableFloatingToolbar) {
    plugins.push(...FloatingToolbarKit);
  }

  if (mergedConfig.enableMarkdownShortcuts) {
    plugins.push(...AutoformatKit);
  }

  if (mergedConfig.enableDiscussion) {
    plugins.push(...DiscussionKit);
  }

  return plugins;
}

/**
 * Creates a minimal plugin array for read-only document rendering.
 * Does not include interactive features like slash commands or toolbars.
 *
 * @returns Array of configured Plate.js plugins for read-only mode
 */
export function createReadOnlyPlugins(): unknown[] {
  return [
    ...BaseEditorKit,
    ...BasicMarksKit,
  ];
}

// --------------------------------------------------------------------------
// Editor Value Helpers
// --------------------------------------------------------------------------

/**
 * Creates a valid editor value, ensuring minimum structure requirements.
 *
 * @param value - Optional initial value
 * @returns A valid Value array for Plate.js
 *
 * @example
 * ```typescript
 * const editor = usePlateEditor({
 *   value: createEditorValue(documentContent),
 * });
 * ```
 */
export function createEditorValue(value?: Value | null): Value {
  if (!value || value.length === 0) {
    return [...DEFAULT_EDITOR_VALUE];
  }
  return value;
}

/**
 * Checks if an editor value is empty (only contains empty paragraphs).
 *
 * @param value - The editor value to check
 * @returns True if the value is considered empty
 */
export function isEditorValueEmpty(value: Value | null | undefined): boolean {
  if (!value || value.length === 0) {
    return true;
  }

  // Check if all nodes are empty paragraphs
  return value.every((node) => {
    if (typeof node !== 'object' || node === null) {
      return true;
    }

    const typedNode = node as { type?: string; children?: unknown[] };

    // Only paragraph nodes count as potentially empty
    if (typedNode.type !== 'p') {
      return false;
    }

    // Check if children are all empty text nodes
    const children = typedNode.children;
    if (!children || children.length === 0) {
      return true;
    }

    return children.every((child) => {
      if (typeof child !== 'object' || child === null) {
        return true;
      }
      const textChild = child as { text?: string };
      return !textChild.text || textChild.text.trim() === '';
    });
  });
}

// --------------------------------------------------------------------------
// Plugin Constants (for reference)
// --------------------------------------------------------------------------

/**
 * Available plugin kits in the knowledge base editor.
 * These are re-exported from the editor infrastructure.
 */
export const PLUGIN_KITS = {
  BaseEditorKit,
  BasicMarksKit,
  SlashKit,
  DndKit,
  BlockMenuKit,
  AutoformatKit,
  ExitBreakKit,
  DiscussionKit,
  FloatingToolbarKit,
} as const;

/**
 * Plugin kit names for documentation and debugging.
 */
export type PluginKitName = keyof typeof PLUGIN_KITS;
