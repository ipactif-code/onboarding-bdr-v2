/**
 * Export helper utilities for channel message history export.
 *
 * Provides formatting functions for JSON and CSV export formats,
 * including proper CSV escaping for special characters.
 */

/**
 * Interface representing a message for export.
 * Contains all necessary fields for JSON and CSV export formats.
 */
export interface ExportMessage {
  /** Unique message ID */
  id: string;
  /** Author's display name */
  author: string;
  /** Message content (text) */
  content: string;
  /** ISO 8601 formatted timestamp */
  timestamp: string;
  /** Whether the message has attachments */
  hasAttachments: boolean;
  /** Number of attachments */
  attachmentCount: number;
  /** Whether the message was deleted */
  isDeleted: boolean;
  /** Content type (text, voice, file, system) */
  contentType: string;
}

/**
 * Format messages as a pretty-printed JSON string.
 *
 * @param messages - Array of export messages
 * @returns Formatted JSON string with 2-space indentation
 */
export function formatAsJSON(messages: ExportMessage[]): string {
  return JSON.stringify(messages, null, 2);
}

/**
 * Escape a value for safe inclusion in a CSV field.
 *
 * Handles:
 * - Commas in values
 * - Newlines in values
 * - Double quotes (escaped by doubling)
 * - Values wrapped in quotes when containing special characters
 *
 * @param value - The string value to escape
 * @returns The escaped CSV-safe string
 */
function escapeCSV(value: string): string {
  // If value contains comma, newline, or double quote, wrap in quotes
  if (value.includes(",") || value.includes("\n") || value.includes("\r") || value.includes('"')) {
    // Escape double quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return value;
}

/**
 * Format messages as a CSV string.
 *
 * Includes headers and properly escaped values for all fields.
 * Handles special characters in content (commas, quotes, newlines).
 *
 * @param messages - Array of export messages
 * @returns CSV formatted string with headers
 */
export function formatAsCSV(messages: ExportMessage[]): string {
  const headers = [
    "ID",
    "Author",
    "Content",
    "Timestamp",
    "Content Type",
    "Has Attachments",
    "Attachment Count",
    "Is Deleted",
  ];

  const rows = messages.map((m) => [
    escapeCSV(m.id),
    escapeCSV(m.author),
    escapeCSV(m.content),
    escapeCSV(m.timestamp),
    escapeCSV(m.contentType),
    m.hasAttachments ? "Yes" : "No",
    m.attachmentCount.toString(),
    m.isDeleted ? "Yes" : "No",
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Generate a suggested filename for the export.
 *
 * @param channelName - The name of the channel
 * @param format - The export format ("json" or "csv")
 * @returns A sanitized filename with timestamp
 */
export function generateExportFilename(channelName: string, format: "json" | "csv"): string {
  // Sanitize channel name (remove/replace invalid filename characters)
  const sanitized = channelName
    .replace(/[<>:"/\\|?*]/g, "-") // Replace invalid chars
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/-+/g, "-") // Collapse multiple dashes
    .substring(0, 50); // Limit length

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
  return `channel-export_${sanitized}_${timestamp}.${format}`;
}
