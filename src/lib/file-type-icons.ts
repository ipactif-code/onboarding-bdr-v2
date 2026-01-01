/**
 * File type icon utilities for messaging attachments.
 * Maps MIME types and file extensions to appropriate Lucide icons.
 */

import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FileArchive,
  File,
  type LucideIcon,
} from "lucide-react";

/**
 * Code file extensions that should use the FileCode icon.
 */
const CODE_EXTENSIONS = [
  "js",
  "ts",
  "tsx",
  "jsx",
  "py",
  "java",
  "cpp",
  "c",
  "h",
  "hpp",
  "cs",
  "go",
  "rs",
  "rb",
  "php",
  "swift",
  "kt",
  "scala",
  "css",
  "scss",
  "sass",
  "less",
  "html",
  "htm",
  "xml",
  "json",
  "yaml",
  "yml",
  "md",
  "mdx",
  "sql",
  "sh",
  "bash",
  "zsh",
  "ps1",
  "vue",
  "svelte",
];

/**
 * Archive file extensions that should use the FileArchive icon.
 */
const ARCHIVE_EXTENSIONS = ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz"];

/**
 * Get the file extension from a filename.
 *
 * @param fileName - The filename to extract extension from
 * @returns Lowercase extension without the dot, or empty string if none
 */
function extractExtension(fileName: string | undefined): string {
  if (!fileName) return "";
  const parts = fileName.split(".");
  return parts.length > 1 ? (parts.pop()?.toLowerCase() ?? "") : "";
}

/**
 * Get the appropriate Lucide icon component for a file based on its MIME type and filename.
 *
 * @param mimeType - The MIME type of the file (e.g., "image/png", "application/pdf")
 * @param fileName - Optional filename for extension-based detection
 * @returns The Lucide icon component to use for this file type
 *
 * @example
 * ```tsx
 * const Icon = getFileIcon("image/png");
 * return <Icon className="h-4 w-4" />;
 * ```
 */
export function getFileIcon(mimeType: string, fileName?: string): LucideIcon {
  // Images
  if (mimeType.startsWith("image/")) {
    return FileImage;
  }

  // Videos
  if (mimeType.startsWith("video/")) {
    return FileVideo;
  }

  // Audio
  if (mimeType.startsWith("audio/")) {
    return FileAudio;
  }

  // PDF documents
  if (mimeType === "application/pdf") {
    return FileText;
  }

  // Word documents
  if (
    mimeType === "application/msword" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType.includes("word")
  ) {
    return FileText;
  }

  // Spreadsheets
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel")
  ) {
    return FileSpreadsheet;
  }

  // Presentations
  if (
    mimeType === "application/vnd.ms-powerpoint" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint")
  ) {
    return FileText;
  }

  // Code files - check by extension
  const ext = extractExtension(fileName);
  if (ext && CODE_EXTENSIONS.includes(ext)) {
    return FileCode;
  }

  // Text/code MIME types
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/javascript" ||
    mimeType === "application/typescript"
  ) {
    return FileCode;
  }

  // Archives - check MIME type first
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed" ||
    mimeType === "application/x-rar-compressed" ||
    mimeType === "application/x-7z-compressed" ||
    mimeType === "application/x-tar" ||
    mimeType === "application/gzip" ||
    mimeType.includes("archive") ||
    mimeType.includes("compressed")
  ) {
    return FileArchive;
  }

  // Archives - check by extension as fallback
  if (ext && ARCHIVE_EXTENSIONS.includes(ext)) {
    return FileArchive;
  }

  // Document extension fallbacks (when MIME type is generic/incorrect)
  if (ext === "pdf") {
    return FileText;
  }
  if (ext === "doc" || ext === "docx" || ext === "rtf" || ext === "odt") {
    return FileText;
  }
  if (ext === "xls" || ext === "xlsx" || ext === "csv" || ext === "ods") {
    return FileSpreadsheet;
  }
  if (ext === "ppt" || ext === "pptx" || ext === "odp") {
    return FileText;
  }

  // Default to generic file icon
  return File;
}

/**
 * File category labels for display.
 */
export type FileCategory =
  | "Image"
  | "Video"
  | "Audio"
  | "PDF"
  | "Document"
  | "Spreadsheet"
  | "Presentation"
  | "Code"
  | "Archive"
  | "File";

/**
 * Get a human-readable category label for a file based on its MIME type.
 *
 * @param mimeType - The MIME type of the file
 * @param fileName - Optional filename for extension-based detection
 * @returns A human-readable category string
 *
 * @example
 * ```tsx
 * const category = getFileCategory("application/pdf");
 * // Returns: "PDF"
 * ```
 */
export function getFileCategory(
  mimeType: string,
  fileName?: string
): FileCategory {
  // Images
  if (mimeType.startsWith("image/")) {
    return "Image";
  }

  // Videos
  if (mimeType.startsWith("video/")) {
    return "Video";
  }

  // Audio
  if (mimeType.startsWith("audio/")) {
    return "Audio";
  }

  // PDF
  if (mimeType === "application/pdf") {
    return "PDF";
  }

  // Word documents
  if (
    mimeType === "application/msword" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType.includes("word")
  ) {
    return "Document";
  }

  // Spreadsheets
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel")
  ) {
    return "Spreadsheet";
  }

  // Presentations
  if (
    mimeType === "application/vnd.ms-powerpoint" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint")
  ) {
    return "Presentation";
  }

  // Code files
  const ext = extractExtension(fileName);
  if (ext && CODE_EXTENSIONS.includes(ext)) {
    return "Code";
  }

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/javascript"
  ) {
    return "Code";
  }

  // Archives
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed" ||
    mimeType === "application/x-rar-compressed" ||
    mimeType === "application/x-7z-compressed" ||
    mimeType.includes("archive") ||
    mimeType.includes("compressed")
  ) {
    return "Archive";
  }

  if (ext && ARCHIVE_EXTENSIONS.includes(ext)) {
    return "Archive";
  }

  // Document extension fallbacks (when MIME type is generic/incorrect)
  if (ext === "pdf") {
    return "PDF";
  }
  if (ext === "doc" || ext === "docx" || ext === "rtf" || ext === "odt") {
    return "Document";
  }
  if (ext === "xls" || ext === "xlsx" || ext === "csv" || ext === "ods") {
    return "Spreadsheet";
  }
  if (ext === "ppt" || ext === "pptx" || ext === "odp") {
    return "Presentation";
  }

  return "File";
}
