/**
 * Plate.js Serialization Utilities
 *
 * Provides utilities to extract plain text from Plate.js Value (rich text nodes)
 * for backend processing like mention parsing and search indexing.
 *
 * @module convex/lib/plate-serializer
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Represents a basic Plate.js text node (leaf node).
 * Contains the actual text content.
 */
interface PlateTextNode {
  text: string;
  [key: string]: unknown;
}

/**
 * Represents a Plate.js element node (block or inline).
 * Contains children which can be other elements or text nodes.
 */
interface PlateElementNode {
  type?: string;
  children?: PlateNode[];
  /**
   * For mention nodes, contains the display value (e.g., "@john" displays "john").
   * Used by MentionPlugin to store the mention text.
   */
  value?: string;
  /**
   * For link nodes, contains the URL.
   */
  url?: string;
  [key: string]: unknown;
}

/**
 * Union type for any Plate.js node.
 */
type PlateNode = PlateTextNode | PlateElementNode;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a node is a text node (leaf node with text property).
 *
 * @param node - Node to check
 * @returns True if node is a text node
 */
function isTextNode(node: unknown): node is PlateTextNode {
  return (
    typeof node === "object" &&
    node !== null &&
    "text" in node &&
    typeof (node as PlateTextNode).text === "string"
  );
}

/**
 * Check if a node is an element node (has children array).
 *
 * @param node - Node to check
 * @returns True if node is an element node
 */
function isElementNode(node: unknown): node is PlateElementNode {
  return (
    typeof node === "object" &&
    node !== null &&
    !("text" in node) &&
    ("children" in node || "type" in node)
  );
}

/**
 * Check if a node is a mention element.
 *
 * @param node - Node to check
 * @returns True if node is a mention element
 */
function isMentionNode(node: unknown): node is PlateElementNode {
  return (
    isElementNode(node) &&
    (node.type === "mention" || node.type === "mention_input")
  );
}

// ============================================================================
// SERIALIZATION FUNCTIONS
// ============================================================================

/**
 * Recursively extract text from Plate.js nodes.
 * Handles all standard node types: paragraphs, headings, lists, mentions, links, etc.
 *
 * @param nodes - Array of Plate.js nodes
 * @returns Concatenated plain text content
 */
function extractTextFromNodes(nodes: unknown[]): string {
  const parts: string[] = [];

  for (const node of nodes) {
    if (isTextNode(node)) {
      // Text node - extract the text content
      parts.push(node.text);
    } else if (isMentionNode(node)) {
      // Mention node - use the value field prefixed with @
      // The value contains the mention text (e.g., "john" for @john)
      if (typeof node.value === "string" && node.value.length > 0) {
        parts.push(`@${node.value}`);
      }
    } else if (isElementNode(node)) {
      // Element node - recurse into children
      if (Array.isArray(node.children) && node.children.length > 0) {
        const childText = extractTextFromNodes(node.children);
        if (childText.length > 0) {
          parts.push(childText);
        }
      }

      // Add appropriate spacing based on block type
      if (isBlockElement(node) && parts.length > 0) {
        // Add space after block elements to separate paragraphs
        const lastPart = parts[parts.length - 1];
        if (lastPart && !lastPart.endsWith(" ") && !lastPart.endsWith("\n")) {
          parts.push(" ");
        }
      }
    }
  }

  return parts.join("");
}

/**
 * Check if a node is a block-level element that should have spacing.
 *
 * @param node - Node to check
 * @returns True if node is a block element
 */
function isBlockElement(node: PlateElementNode): boolean {
  const blockTypes = [
    "p",
    "paragraph",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "code_block",
    "li",
    "ul",
    "ol",
    "table",
    "tr",
    "td",
    "th",
  ];

  return typeof node.type === "string" && blockTypes.includes(node.type);
}

/**
 * Extract plain text from Plate.js Value or string content.
 * Used for mention parsing and search indexing.
 *
 * Handles three input types:
 * 1. Plain string - returns as-is
 * 2. Plate.js Value array - extracts text from all nodes recursively
 * 3. null/undefined - returns empty string
 *
 * @param content - Plate.js Value array or plain string
 * @returns Plain text content
 *
 * @example
 * ```typescript
 * // String input (passthrough)
 * serializeToText("Hello @john") // "Hello @john"
 *
 * // Plate.js Value input
 * const value = [
 *   {
 *     type: 'p',
 *     children: [
 *       { text: 'Hello ' },
 *       { type: 'mention', value: 'john', children: [{ text: '' }] },
 *       { text: ' and ' },
 *       { type: 'mention', value: 'everyone', children: [{ text: '' }] },
 *     ],
 *   },
 * ];
 * serializeToText(value) // "Hello @john and @everyone"
 *
 * // Null/undefined input
 * serializeToText(null) // ""
 * serializeToText(undefined) // ""
 * ```
 */
export function serializeToText(content: unknown): string {
  // String passthrough
  if (typeof content === "string") {
    return content;
  }

  // Array (Plate.js Value) - extract text from nodes
  if (Array.isArray(content)) {
    return extractTextFromNodes(content).trim();
  }

  // Fallback for null/undefined/other
  return "";
}

/**
 * Check if content appears to be Plate.js Value (array of nodes).
 * Useful for determining how to process content before serialization.
 *
 * @param content - Content to check
 * @returns True if content looks like Plate.js Value
 */
export function isPlateValue(content: unknown): boolean {
  if (!Array.isArray(content)) {
    return false;
  }

  if (content.length === 0) {
    return true; // Empty array is valid Plate.js Value
  }

  // Check if first element looks like a Plate.js node
  const firstNode = content[0];
  return isTextNode(firstNode) || isElementNode(firstNode);
}
