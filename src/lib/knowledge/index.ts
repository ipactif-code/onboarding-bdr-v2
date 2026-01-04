/**
 * Knowledge Base Library
 *
 * This module will export configuration and utilities for the Knowledge Base
 * collaborative editor feature once the Potion editor is installed.
 *
 * @module lib/knowledge
 *
 * TODO: Re-export Potion editor configuration once installed
 */

// Placeholder exports - will be replaced with Potion configuration

/**
 * Default empty editor value.
 */
export const DEFAULT_EDITOR_VALUE: unknown[] = [
  {
    type: "p",
    children: [{ text: "" }],
  },
];

/**
 * Check if editor value is empty.
 */
export function isEditorValueEmpty(value: unknown[]): boolean {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return true;
  }

  // Check if it's just an empty paragraph
  if (value.length === 1) {
    const node = value[0] as Record<string, unknown>;
    if (node.type === "p" && Array.isArray(node.children)) {
      const children = node.children as Array<Record<string, unknown>>;
      if (children.length === 1 && children[0]?.text === "") {
        return true;
      }
    }
  }

  return false;
}

/**
 * Create a default editor value with optional initial text.
 */
export function createEditorValue(initialText?: string): unknown[] {
  if (!initialText) {
    return DEFAULT_EDITOR_VALUE;
  }

  return [
    {
      type: "p",
      children: [{ text: initialText }],
    },
  ];
}
