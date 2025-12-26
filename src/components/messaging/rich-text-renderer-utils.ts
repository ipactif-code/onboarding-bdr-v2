/**
 * Utility functions for the RichTextRenderer component.
 *
 * Contains content parsing, link extraction, and text conversion helpers.
 */

// ============================================================================
// Constants
// ============================================================================

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
