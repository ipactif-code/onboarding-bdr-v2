/**
 * Utility functions for MessageInput component.
 * Handles Plate.js editor value manipulation.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a text leaf node in Plate.js.
 * Text nodes contain the actual visible text content.
 * Formatting marks (bold, italic, code) are stored as boolean properties.
 *
 * @example
 * { text: "hello" }
 * { text: "bold text", bold: true }
 * { text: "italic", italic: true }
 */
interface TextNode {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

/**
 * Represents an element node in Plate.js (paragraphs, links, lists, etc.).
 * Element nodes contain children which can be other elements or text nodes.
 *
 * @example
 * { type: "p", children: [{ text: "paragraph" }] }
 * { type: "a", url: "https://...", children: [{ text: "link text" }] }
 */
interface ElementNode {
  type: string;
  children: EditorNode[];
  url?: string; // For link nodes
  [key: string]: unknown; // Other element-specific properties
}

/**
 * Union type for any node in a Plate.js editor value.
 * Can be either a text leaf or an element with children.
 */
type EditorNode = TextNode | ElementNode;

/**
 * Type guard to check if a node is a text leaf node.
 * Text nodes have a 'text' property with string value.
 */
function isTextNode(node: unknown): node is TextNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'text' in node &&
    typeof (node as TextNode).text === 'string'
  );
}

/**
 * Type guard to check if a node is an element node.
 * Element nodes have a 'children' array property.
 */
function isElementNode(node: unknown): node is ElementNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'children' in node &&
    Array.isArray((node as ElementNode).children)
  );
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
 * Counts only visible text characters, excluding all formatting metadata.
 *
 * This function traverses the Plate.js node tree and extracts only the
 * text content from leaf nodes. It correctly handles:
 *
 * - Plain text: "hello" -> "hello" (5 chars)
 * - Bold/italic text: { text: "bold", bold: true } -> "bold" (4 chars)
 * - Links: { type: "a", url: "https://...", children: [{ text: "click" }] } -> "click" (5 chars)
 * - Lists: Extracts text from all list items
 * - Nested structures: Recursively extracts from all children
 * - Mixed formatting: Combines all visible text
 *
 * The function explicitly does NOT count:
 * - Formatting marks (bold, italic, code, etc.)
 * - Element type metadata (p, h1, a, ul, etc.)
 * - Link URLs (only the link text is counted)
 * - Any JSON structure overhead
 *
 * @param value - Plate.js editor value (array of nodes)
 * @returns Plain text string containing only visible characters
 *
 * @example
 * // Plain paragraph
 * getTextFromValue([{ type: 'p', children: [{ text: 'Hello' }] }])
 * // Returns: "Hello" (5 chars)
 *
 * @example
 * // Text with formatting (bold + italic)
 * getTextFromValue([{
 *   type: 'p',
 *   children: [
 *     { text: 'Hello ' },
 *     { text: 'world', bold: true, italic: true }
 *   ]
 * }])
 * // Returns: "Hello world" (11 chars, formatting not counted)
 *
 * @example
 * // Link (only text counted, not URL)
 * getTextFromValue([{
 *   type: 'p',
 *   children: [{
 *     type: 'a',
 *     url: 'https://example.com',
 *     children: [{ text: 'Click here' }]
 *   }]
 * }])
 * // Returns: "Click here" (10 chars, URL not counted)
 */
export function getTextFromValue(value: unknown[]): string {
  // Handle null/undefined/non-array input gracefully
  if (!Array.isArray(value)) {
    return '';
  }

  let text = '';

  /**
   * Recursively extracts text from a node and its children.
   * Uses type guards for safe type narrowing.
   */
  function extractText(node: unknown): void {
    // Skip null/undefined nodes
    if (node === null || node === undefined) {
      return;
    }

    // Text leaf node - extract the text content
    if (isTextNode(node)) {
      text += node.text;
      return;
    }

    // Element node - recursively process children
    if (isElementNode(node)) {
      for (const child of node.children) {
        extractText(child);
      }
      return;
    }

    // Unknown node structure - skip silently
    // This handles malformed data gracefully
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
