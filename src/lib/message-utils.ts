/**
 * Shared utility functions for messaging components.
 * Consolidates duplicated utilities from message-item.tsx and course-discussion/utils.ts.
 */

import { formatDistanceToNow } from "date-fns";

// ============================================================================
// Avatar Utilities
// ============================================================================

/**
 * Generates initials from a display name.
 * Returns up to 2 characters (first letter of first two words).
 *
 * @param name - The display name to extract initials from
 * @returns Uppercase initials (1-2 characters) or "?" if name is empty
 *
 * @example
 * getInitials("John Doe") // "JD"
 * getInitials("Alice") // "AL"
 * getInitials("Bob Smith Jr") // "BS"
 * getInitials("") // "?"
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const firstWord = words[0];
  const secondWord = words[1];

  if (!firstWord) {
    return "?";
  }

  if (!secondWord) {
    return firstWord.length >= 2
      ? firstWord.slice(0, 2).toUpperCase()
      : firstWord.toUpperCase();
  }

  const first = firstWord[0] ?? "";
  const second = secondWord[0] ?? "";
  return (first + second).toUpperCase();
}

// ============================================================================
// Timestamp Utilities
// ============================================================================

/**
 * Formats a timestamp into a human-readable relative time.
 * For recent messages (< 7 days) shows relative time (e.g., "5 minutes ago").
 * For older messages shows date (e.g., "Dec 25" or "Dec 25, 2023").
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string
 *
 * @example
 * formatTimestamp(Date.now() - 60000) // "1 minute ago"
 * formatTimestamp(Date.now() - 86400000 * 2) // "2 days ago"
 * formatTimestamp(Date.now() - 86400000 * 10) // "Dec 15"
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays < 7) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

// ============================================================================
// Content Utilities
// ============================================================================

/**
 * Extracts plain text from Plate.js JSON content or returns content as-is if plain text.
 * Useful for displaying message previews or excerpts.
 *
 * @param content - Message content (either plain text or Plate.js JSON)
 * @returns Plain text content
 *
 * @example
 * getTextContent("Hello world") // "Hello world"
 * getTextContent('[{"children":[{"text":"Hello"}]}]') // "Hello"
 */
export function getTextContent(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      let text = "";
      function extractText(node: unknown): void {
        if (typeof node === "object" && node !== null) {
          const nodeObj = node as Record<string, unknown>;
          if (typeof nodeObj.text === "string") {
            text += nodeObj.text;
          }
          if (Array.isArray(nodeObj.children)) {
            for (const child of nodeObj.children) {
              extractText(child);
            }
          }
        }
      }
      for (const node of parsed) {
        extractText(node);
      }
      return text || content;
    }
    return content;
  } catch {
    // Not JSON, return as plain text
    return content;
  }
}
