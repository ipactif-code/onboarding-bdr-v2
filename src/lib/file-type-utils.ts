/**
 * File type utilities for messaging attachments.
 * Provides validation, formatting, and type checking for file uploads.
 */

/**
 * Maximum allowed file size in bytes (32MB).
 * Aligned with UploadThing server limits.
 */
export const MAX_FILE_SIZE = 32 * 1024 * 1024;

/**
 * Maximum file size as a formatted string for display.
 */
export const MAX_FILE_SIZE_DISPLAY = "32MB";

/**
 * File extensions that are blocked for security reasons.
 * These executable formats pose security risks and should never be uploaded.
 */
const BLOCKED_EXTENSIONS = [
  // Windows executables
  "exe",
  "dll",
  "msi",
  "scr",
  "pif",
  "com",
  // Scripts
  "bat",
  "cmd",
  "sh",
  "bash",
  "ps1",
  "vbs",
  "vbe",
  "js", // When sent as standalone file (not in code context)
  "jse",
  "wsf",
  "wsh",
  // Other dangerous formats
  "hta",
  "cpl",
  "msc",
  "jar",
  "gadget",
  "inf",
  "reg",
  "lnk",
];

/**
 * MIME types that are blocked for security reasons.
 */
const BLOCKED_MIME_TYPES = [
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-dosexec",
  "application/x-msi",
  "application/x-bat",
  "application/x-sh",
  "application/x-shellscript",
];

/**
 * Result of file validation.
 */
export interface FileValidationResult {
  /** Whether the file passed validation */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Check if a file is an image that can be displayed inline.
 *
 * @param mimeType - The MIME type of the file
 * @returns true if the file is an image
 *
 * @example
 * ```ts
 * if (isImage(file.type)) {
 *   // Show inline preview
 * }
 * ```
 */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Check if a file can be previewed inline in the browser.
 * Currently supports images only. PDFs could be added in the future.
 *
 * @param mimeType - The MIME type of the file
 * @returns true if the file can be previewed inline
 *
 * @example
 * ```ts
 * if (isPreviewable(file.type)) {
 *   // Render preview component
 * } else {
 *   // Render download link
 * }
 * ```
 */
export function isPreviewable(mimeType: string): boolean {
  // Currently only images are previewable
  // PDF preview could be added: mimeType === "application/pdf"
  return mimeType.startsWith("image/");
}

/**
 * Check if a file is a video.
 *
 * @param mimeType - The MIME type of the file
 * @returns true if the file is a video
 */
export function isVideo(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

/**
 * Check if a file is audio.
 *
 * @param mimeType - The MIME type of the file
 * @returns true if the file is audio
 */
export function isAudio(mimeType: string): boolean {
  return mimeType.startsWith("audio/");
}

/**
 * Format a file size in bytes to a human-readable string.
 *
 * @param bytes - File size in bytes
 * @returns Formatted size string (e.g., "1.5 MB", "256 KB")
 *
 * @example
 * ```ts
 * formatFileSize(1536000) // "1.5 MB"
 * formatFileSize(256)     // "256 B"
 * formatFileSize(0)       // "0 B"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Ensure we don't exceed our units array
  const unitIndex = Math.min(i, units.length - 1);
  const size = bytes / Math.pow(k, unitIndex);

  // Use 1 decimal place, but remove trailing zero
  const formatted = size.toFixed(1).replace(/\.0$/, "");

  return `${formatted} ${units[unitIndex]}`;
}

/**
 * Get the file extension from a filename.
 *
 * @param fileName - The filename to extract extension from
 * @returns Lowercase extension without the dot, or empty string if none
 *
 * @example
 * ```ts
 * getFileExtension("document.pdf")  // "pdf"
 * getFileExtension("no-extension")  // ""
 * getFileExtension(".gitignore")    // "gitignore"
 * ```
 */
export function getFileExtension(fileName: string): string {
  if (!fileName) return "";

  const parts = fileName.split(".");

  // Handle files with no extension or hidden files like ".gitignore"
  if (parts.length <= 1) return "";

  return parts.pop()?.toLowerCase() ?? "";
}

/**
 * Validate that a file size is within the allowed limit.
 *
 * @param size - File size in bytes
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```ts
 * const result = validateFileSize(file.size);
 * if (!result.valid) {
 *   toast.error(result.error);
 * }
 * ```
 */
export function validateFileSize(size: number): FileValidationResult {
  if (size <= 0) {
    return {
      valid: false,
      error: "File appears to be empty",
    };
  }

  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE_DISPLAY} limit`,
    };
  }

  return { valid: true };
}

/**
 * Check for double extension attacks (e.g., malware.exe.png).
 * This catches attempts to disguise executable files with safe-looking extensions.
 *
 * @param fileName - The filename to check
 * @returns true if a double extension attack is detected
 *
 * @example
 * ```ts
 * hasDoubleExtensionAttack("document.pdf")       // false
 * hasDoubleExtensionAttack("malware.exe.png")    // true
 * hasDoubleExtensionAttack("script.bat.jpg")     // true
 * ```
 */
export function hasDoubleExtensionAttack(fileName: string): boolean {
  if (!fileName) return false;

  const lowerName = fileName.toLowerCase();
  const parts = lowerName.split(".");

  // Need at least 3 parts for a double extension (name.ext1.ext2)
  if (parts.length < 3) return false;

  // Check if any extension (except the last one) is a blocked extension
  // This catches: malware.exe.png, script.bat.jpg, etc.
  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part && BLOCKED_EXTENSIONS.includes(part)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitize a filename for safe storage and display.
 * Removes dangerous characters and normalizes the name.
 *
 * @param fileName - The filename to sanitize
 * @returns Sanitized filename safe for storage
 *
 * @example
 * ```ts
 * sanitizeFileName("my file (1).pdf")           // "my-file-1.pdf"
 * sanitizeFileName("../../../etc/passwd")       // "etc-passwd"
 * sanitizeFileName("<script>alert.js")          // "scriptalert.js"
 * ```
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) return "unnamed-file";

  // Preserve extension
  const ext = getFileExtension(fileName);
  const nameWithoutExt = ext
    ? fileName.slice(0, fileName.length - ext.length - 1)
    : fileName;

  // Remove path traversal attempts
  let sanitized = nameWithoutExt.replace(/\.\./g, "");

  // Remove dangerous characters (HTML, paths, control chars)
  sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, "");

  // Replace spaces and problematic chars with hyphens
  sanitized = sanitized.replace(/[\s()[\]{}]+/g, "-");

  // Remove multiple consecutive hyphens
  sanitized = sanitized.replace(/-+/g, "-");

  // Remove leading/trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, "");

  // Ensure we have a valid name
  if (!sanitized) {
    sanitized = "unnamed-file";
  }

  // Limit length to prevent filesystem issues
  const maxNameLength = 200;
  if (sanitized.length > maxNameLength) {
    sanitized = sanitized.slice(0, maxNameLength);
  }

  // Reattach extension
  return ext ? `${sanitized}.${ext}` : sanitized;
}

/**
 * Check if a file type is blocked for security reasons.
 * Blocks executable files, scripts, and other potentially dangerous formats.
 * Also detects double extension attacks (e.g., malware.exe.png).
 *
 * @param fileName - The name of the file (used for extension check)
 * @param mimeType - The MIME type of the file
 * @returns true if the file type is blocked and should not be uploaded
 *
 * @example
 * ```ts
 * if (isBlockedFileType(file.name, file.type)) {
 *   toast.error("This file type is not allowed");
 *   return;
 * }
 * ```
 */
export function isBlockedFileType(fileName: string, mimeType: string): boolean {
  // Check for double extension attacks first
  if (hasDoubleExtensionAttack(fileName)) {
    return true;
  }

  // Check extension
  const ext = getFileExtension(fileName);
  if (ext && BLOCKED_EXTENSIONS.includes(ext)) {
    return true;
  }

  // Check MIME type
  const lowerMimeType = mimeType.toLowerCase();
  if (BLOCKED_MIME_TYPES.some((blocked) => lowerMimeType.includes(blocked))) {
    return true;
  }

  return false;
}

/**
 * Comprehensive file validation that checks size and type.
 *
 * @param file - The File object to validate
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```ts
 * const result = validateFile(file);
 * if (!result.valid) {
 *   toast.error(result.error);
 *   return;
 * }
 * // Proceed with upload
 * ```
 */
export function validateFile(file: File): FileValidationResult {
  // Check if file type is blocked
  if (isBlockedFileType(file.name, file.type)) {
    return {
      valid: false,
      error: "This file type is not allowed for security reasons",
    };
  }

  // Check file size
  const sizeResult = validateFileSize(file.size);
  if (!sizeResult.valid) {
    return sizeResult;
  }

  return { valid: true };
}

/**
 * Truncate a filename if it's too long, preserving the extension.
 *
 * @param fileName - The filename to truncate
 * @param maxLength - Maximum length for the filename (default: 30)
 * @returns Truncated filename with extension preserved
 *
 * @example
 * ```ts
 * truncateFileName("very-long-filename-that-needs-truncation.pdf", 20)
 * // "very-long-filen....pdf"
 * ```
 */
export function truncateFileName(fileName: string, maxLength = 30): string {
  if (fileName.length <= maxLength) {
    return fileName;
  }

  const ext = getFileExtension(fileName);
  const extWithDot = ext ? `.${ext}` : "";
  const nameWithoutExt = ext
    ? fileName.slice(0, fileName.length - extWithDot.length)
    : fileName;

  // Reserve space for extension and ellipsis
  const availableLength = maxLength - extWithDot.length - 3; // 3 for "..."

  if (availableLength <= 0) {
    // Extension itself is too long, just truncate everything
    return fileName.slice(0, maxLength - 3) + "...";
  }

  return nameWithoutExt.slice(0, availableLength) + "..." + extWithDot;
}
