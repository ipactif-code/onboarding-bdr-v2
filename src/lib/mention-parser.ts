/**
 * Mention Parser Utility
 *
 * Parses @mentions from message content for the messaging feature.
 * Supports: @username, @here, @everyone
 */

/**
 * Represents a parsed mention from message content.
 */
export interface ParsedMention {
  /** Type of mention: user (individual), here (present users), or everyone (all users) */
  type: "user" | "here" | "everyone";
  /** User ID - only populated for type: "user" after lookup */
  userId?: string;
  /** The text after @ (for display, e.g., "john.doe" from "@john.doe") */
  username: string;
  /** Start index of the mention in the original content (includes @) */
  startIndex: number;
  /** End index of the mention in the original content (exclusive) */
  endIndex: number;
}

/**
 * Marker format for replaced mentions in rendered content.
 * Using a format that can be parsed by React components.
 */
export const MENTION_MARKER = {
  start: "[[mention:",
  separator: ":",
  end: "]]",
} as const;

/** Maximum content length to process for mentions (100KB) */
const MAX_CONTENT_LENGTH = 100_000;

/**
 * Regex pattern for matching @mentions.
 * Matches: @word-characters (letters, numbers, underscores, dots, hyphens)
 * Does not match mentions inside URLs (http://, https://, mailto:)
 */
const MENTION_PATTERN = /(?<![:/])@([\w.-]+)/g;

/**
 * Patterns that should prevent mention matching.
 * Used to skip mentions inside URLs or code blocks.
 */
const SKIP_PATTERNS = {
  /** URL pattern - matches http://, https://, or domain-like patterns */
  url: /https?:\/\/\S{1,2048}|www\.\S{1,2048}/g,
  /** Inline code pattern - matches `code` blocks */
  inlineCode: /`[^`]+`/g,
  /** Code block pattern - matches ```code``` blocks */
  codeBlock: /```[\s\S]*?```/g,
} as const;

/**
 * Determines if a position is inside a skip zone (URL, code block, etc.)
 *
 * @param content - The full message content
 * @param position - Character position to check
 * @returns True if position should be skipped
 */
function isInsideSkipZone(content: string, position: number): boolean {
  // Check each skip pattern
  for (const pattern of Object.values(SKIP_PATTERNS)) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (position >= start && position < end) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Normalizes a mention type from the matched username.
 * Handles case-insensitive matching for "here" and "everyone".
 *
 * @param username - The matched text after @
 * @returns The normalized mention type
 */
function getMentionType(username: string): ParsedMention["type"] {
  const lowerUsername = username.toLowerCase();

  if (lowerUsername === "here") {
    return "here";
  }

  if (lowerUsername === "everyone") {
    return "everyone";
  }

  return "user";
}

/**
 * Parse @mentions from message content.
 * Supports: @username, @here, @everyone
 *
 * @param content - Raw message content string
 * @returns Array of parsed mentions with positions, sorted by startIndex
 *
 * @example
 * ```typescript
 * const mentions = parseMentions("Hello @john.doe and @everyone!");
 * // Returns:
 * // [
 * //   { type: "user", username: "john.doe", startIndex: 6, endIndex: 15 },
 * //   { type: "everyone", username: "everyone", startIndex: 20, endIndex: 29 }
 * // ]
 * ```
 */
export function parseMentions(content: string): ParsedMention[] {
  if (!content || typeof content !== "string") {
    return [];
  }

  // Prevent processing extremely large inputs (max 100KB)
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.slice(0, MAX_CONTENT_LENGTH);
  }

  const mentions: ParsedMention[] = [];

  // Reset lastIndex for global regex
  MENTION_PATTERN.lastIndex = 0;

  let match;
  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    const startIndex = match.index;
    const fullMatch = match[0];
    const username = match[1];

    // Skip empty usernames
    if (!username) {
      continue;
    }

    // Skip mentions inside URLs or code blocks
    if (isInsideSkipZone(content, startIndex)) {
      continue;
    }

    const mentionType = getMentionType(username);

    mentions.push({
      type: mentionType,
      username: mentionType === "user" ? username : username.toLowerCase(),
      startIndex,
      endIndex: startIndex + fullMatch.length,
    });
  }

  // Sort by startIndex to ensure consistent ordering
  return mentions.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Extract unique user IDs from mentions.
 * Filters to only "user" type mentions that have userId populated.
 *
 * @param mentions - Array of parsed mentions
 * @returns Array of unique user IDs (deduplicated)
 *
 * @example
 * ```typescript
 * const mentions = [
 *   { type: "user", userId: "user_123", username: "john", startIndex: 0, endIndex: 5 },
 *   { type: "everyone", username: "everyone", startIndex: 10, endIndex: 19 },
 *   { type: "user", userId: "user_123", username: "john", startIndex: 20, endIndex: 25 }
 * ];
 * const userIds = extractMentionedUserIds(mentions);
 * // Returns: ["user_123"]
 * ```
 */
export function extractMentionedUserIds(mentions: ParsedMention[]): string[] {
  if (!Array.isArray(mentions)) {
    return [];
  }

  const userIds = new Set<string>();

  for (const mention of mentions) {
    if (mention.type === "user" && mention.userId) {
      userIds.add(mention.userId);
    }
  }

  return Array.from(userIds);
}

/**
 * Replace @mentions with formatted markers for display.
 * Used for rendering mentions with highlighting.
 *
 * The output format is: [[mention:type:username]]
 * This can be parsed by React components to render highlighted mentions.
 *
 * @param content - Raw message content
 * @param mentions - Parsed mentions (must be sorted by startIndex)
 * @returns Content with mentions wrapped in markers
 *
 * @example
 * ```typescript
 * const content = "Hello @john and @everyone!";
 * const mentions = parseMentions(content);
 * const result = replaceMentionsWithLinks(content, mentions);
 * // Returns: "Hello [[mention:user:john]] and [[mention:everyone:everyone]]!"
 * ```
 */
export function replaceMentionsWithLinks(
  content: string,
  mentions: ParsedMention[]
): string {
  if (!content || typeof content !== "string") {
    return content ?? "";
  }

  if (!Array.isArray(mentions) || mentions.length === 0) {
    return content;
  }

  // Build result by processing mentions in reverse order
  // This preserves indices as we replace
  let result = content;

  // Sort by startIndex descending for reverse processing
  const sortedMentions = [...mentions].sort(
    (a, b) => b.startIndex - a.startIndex
  );

  for (const mention of sortedMentions) {
    const marker = `${MENTION_MARKER.start}${mention.type}${MENTION_MARKER.separator}${mention.username}${MENTION_MARKER.end}`;

    result =
      result.slice(0, mention.startIndex) +
      marker +
      result.slice(mention.endIndex);
  }

  return result;
}

/**
 * Check if content contains any broadcast mentions (@here or @everyone).
 * Useful for notification logic - broadcast mentions may trigger different behavior.
 *
 * @param mentions - Array of parsed mentions
 * @returns True if content contains @here or @everyone
 */
export function hasBroadcastMention(mentions: ParsedMention[]): boolean {
  if (!Array.isArray(mentions)) {
    return false;
  }

  return mentions.some(
    (mention) => mention.type === "here" || mention.type === "everyone"
  );
}

/**
 * Strip mention markers from content for plain text display.
 * Converts [[mention:type:username]] back to @username.
 *
 * @param content - Content with mention markers
 * @returns Plain text with @ mentions
 */
export function stripMentionMarkers(content: string): string {
  if (!content || typeof content !== "string") {
    return content ?? "";
  }

  // Pattern to match [[mention:type:username]]
  const markerPattern = /\[\[mention:(user|here|everyone):([^\]]+)\]\]/g;

  return content.replace(markerPattern, (_match, _type, username) => {
    return `@${username}`;
  });
}
