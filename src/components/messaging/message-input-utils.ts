/**
 * Utility functions for MessageInput component.
 * Handles Plate.js editor value manipulation.
 */

// ============================================================================
// Types
// ============================================================================

interface EditorNode {
  type?: string;
  text?: string;
  children?: EditorNode[];
}

// ============================================================================
// Editor Value Utilities
// ============================================================================

/**
 * Default editor value for empty state.
 * Plate.js requires at least one paragraph node with text content.
 */
export function createEmptyEditorValue(): { type: string; children: { text: string }[] }[] {
  return [{ type: 'p', children: [{ text: '' }] }];
}

/**
 * Extracts plain text from Plate.js editor value.
 * Used for character counting and empty state detection.
 */
export function getTextFromValue(value: unknown[]): string {
  let text = '';

  function extractText(node: unknown): void {
    if (typeof node === 'object' && node !== null) {
      const nodeObj = node as EditorNode;
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
export function serializeEditorValue(value: unknown[]): string {
  return JSON.stringify(value);
}
