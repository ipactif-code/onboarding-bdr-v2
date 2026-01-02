/**
 * Utility functions for the RichTextRenderer component.
 *
 * Contains content parsing, link extraction, and text conversion helpers.
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of characters before truncation is applied.
 */
export const MAX_MESSAGE_CHARS = 500;

/**
 * Default empty content for the editor.
 */
export const EMPTY_VALUE = [{ type: "p", children: [{ text: "" }] }];

/**
 * Regex to match http/https URLs.
 */
export const HTTP_URL_REGEX = /^https?:\/\//i;

/**
 * Maximum number of link previews to show per message.
 */
export const MAX_LINK_PREVIEWS = 3;

// ============================================================================
// Content Parsing
// ============================================================================

/**
 * Attempts to parse content as Plate.js JSON.
 * Returns the parsed value if valid, or null if invalid.
 */
export function parseContent(content: string): unknown[] | null {
  if (!content || content.trim() === "") {
    return null;
  }

  // If it doesn't look like JSON, treat as plain text
  const trimmed = content.trim();
  if (!trimmed.startsWith("[")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);

    // Validate that it's an array with at least one element
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    // Basic validation: each element should have a type or be a text node
    const isValid = parsed.every(
      (node: unknown) =>
        typeof node === "object" &&
        node !== null &&
        ("type" in node || "text" in node)
    );

    if (!isValid) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Converts plain text to Plate.js format.
 * Preserves line breaks as separate paragraphs.
 */
export function textToPlateValue(text: string): unknown[] {
  if (!text || text.trim() === "") {
    return EMPTY_VALUE;
  }

  // Split by line breaks and create paragraph nodes
  const lines = text.split(/\r?\n/);
  return lines.map((line) => ({
    type: "p",
    children: [{ text: line }],
  }));
}

// ============================================================================
// Link Extraction
// ============================================================================

/**
 * Recursively extracts all link URLs from Plate.js content.
 * Only extracts http/https URLs, ignores mailto:, tel:, etc.
 */
export function extractLinkUrls(nodes: unknown[]): string[] {
  const urls: string[] = [];

  function traverse(node: unknown): void {
    if (!node || typeof node !== "object") return;

    const nodeObj = node as Record<string, unknown>;

    // Check if this is a link node
    if (nodeObj.type === "a" && typeof nodeObj.url === "string") {
      const url = nodeObj.url;
      // Only include http/https URLs
      if (HTTP_URL_REGEX.test(url) && !urls.includes(url)) {
        urls.push(url);
      }
    }

    // Recursively traverse children
    if (Array.isArray(nodeObj.children)) {
      for (const child of nodeObj.children) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
    // Stop early if we have enough URLs
    if (urls.length >= MAX_LINK_PREVIEWS) break;
  }

  return urls.slice(0, MAX_LINK_PREVIEWS);
}

// ============================================================================
// Plain Text Extraction
// ============================================================================

/**
 * Recursively extracts plain text from Plate.js content nodes.
 * Used for character counting to determine if truncation is needed.
 *
 * @param nodes - Array of Plate.js content nodes
 * @returns The concatenated plain text from all nodes
 */
export function extractPlainText(nodes: unknown[]): string {
  const textParts: string[] = [];

  function traverse(node: unknown): void {
    if (!node || typeof node !== "object") return;

    const nodeObj = node as Record<string, unknown>;

    // Check if this is a text leaf node
    if (typeof nodeObj.text === "string") {
      textParts.push(nodeObj.text);
      return;
    }

    // Recursively traverse children
    if (Array.isArray(nodeObj.children)) {
      for (const child of nodeObj.children) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return textParts.join("");
}

/**
 * Gets the plain text length from content (JSON or plain text).
 * Used to determine if a message should be truncated.
 *
 * @param content - The content string (Plate.js JSON or plain text)
 * @returns The character count of the rendered text
 */
export function getContentTextLength(content: string): number {
  const parsed = parseContent(content);
  if (parsed) {
    return extractPlainText(parsed).length;
  }
  return content.length;
}
