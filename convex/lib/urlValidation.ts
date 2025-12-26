/**
 * URL validation and SSRF protection utilities.
 *
 * This module provides security-focused URL validation to prevent:
 * - Server-Side Request Forgery (SSRF) attacks
 * - Access to private/internal networks
 * - Access to cloud metadata endpoints
 * - Protocol injection attacks
 *
 * @module convex/lib/urlValidation
 */

/**
 * Private IP ranges that must be blocked (SSRF protection).
 * These patterns match IPv4 and IPv6 private/reserved addresses.
 */
export const PRIVATE_IP_PATTERNS: RegExp[] = [
  // IPv4 private ranges
  /^127\./, // Loopback
  /^10\./, // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
  /^192\.168\./, // Class C private
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  /^224\./, // Multicast
  /^240\./, // Reserved
  /^255\./, // Broadcast
  // IPv6 private ranges
  /^::1$/, // Loopback
  /^fe80:/i, // Link-local
  /^fc00:/i, // Unique local
  /^fd[0-9a-f]{2}:/i, // Unique local
];

/**
 * Blocked hostnames for SSRF protection.
 * Includes localhost variants and cloud metadata endpoints.
 */
export const BLOCKED_HOSTNAMES: string[] = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal", // GCP metadata
  "169.254.169.254", // Cloud metadata (AWS, GCP, Azure)
  "metadata.azure.com", // Azure metadata
];

/**
 * Result of URL validation.
 */
export type UrlValidationResult = {
  isValid: boolean;
  error?: string;
  parsedUrl?: URL;
};

/**
 * Validate URL format and protocol.
 *
 * Checks:
 * - URL is not empty
 * - URL has valid format
 * - Only HTTP/HTTPS protocols allowed
 * - No dangerous protocol injection
 *
 * @param urlString - The URL string to validate
 * @returns Error message if invalid, null if valid
 *
 * @example
 * ```typescript
 * const error = validateUrl("https://example.com");
 * if (error) {
 *   return { error };
 * }
 * ```
 */
export function validateUrl(urlString: string): string | null {
  // Check for empty or whitespace-only input
  if (!urlString || !urlString.trim()) {
    return "URL is required";
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return "Invalid URL format";
  }

  // Only allow HTTPS (and HTTP for development, but HTTPS preferred)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "Only HTTP and HTTPS URLs are allowed";
  }

  // Block dangerous protocols that might be encoded
  const lowerUrl = urlString.toLowerCase();
  if (
    lowerUrl.includes("javascript:") ||
    lowerUrl.includes("data:") ||
    lowerUrl.includes("file:") ||
    lowerUrl.includes("ftp:") ||
    lowerUrl.includes("gopher:")
  ) {
    return "Protocol not allowed";
  }

  return null;
}

/**
 * Check if hostname is a private/internal IP or blocked hostname.
 *
 * This function provides SSRF protection by blocking:
 * - Private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)
 * - Loopback addresses (127.x, ::1)
 * - Link-local addresses (169.254.x, fe80::)
 * - Cloud metadata endpoints (169.254.169.254, metadata.google.internal)
 * - Localhost variants (.localhost, .local, .internal)
 *
 * @param hostname - The hostname to check
 * @returns true if blocked (dangerous), false if allowed (safe)
 *
 * @example
 * ```typescript
 * if (isBlockedHost(parsedUrl.hostname)) {
 *   return { error: "Access to this host is not allowed" };
 * }
 * ```
 */
export function isBlockedHost(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();

  // Check against blocked hostnames
  if (BLOCKED_HOSTNAMES.includes(lowerHostname)) {
    return true;
  }

  // Check against private IP patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return true;
    }
  }

  // Check for localhost variants
  if (
    lowerHostname.endsWith(".localhost") ||
    lowerHostname.endsWith(".local") ||
    lowerHostname.endsWith(".internal")
  ) {
    return true;
  }

  return false;
}

/**
 * Fully validate a URL for safe fetching.
 *
 * Combines format validation and SSRF protection into a single check.
 *
 * @param urlString - The URL string to validate
 * @returns Validation result with parsed URL if valid
 *
 * @example
 * ```typescript
 * const result = validateUrlForFetch("https://example.com");
 * if (!result.isValid) {
 *   return { error: result.error };
 * }
 * const { parsedUrl } = result;
 * ```
 */
export function validateUrlForFetch(urlString: string): UrlValidationResult {
  // Step 1: Validate URL format
  const formatError = validateUrl(urlString);
  if (formatError) {
    return { isValid: false, error: formatError };
  }

  // Step 2: Parse and check host
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return { isValid: false, error: "Invalid URL format" };
  }

  // Step 3: Check for blocked hosts (SSRF protection)
  if (isBlockedHost(parsedUrl.hostname)) {
    return { isValid: false, error: "Access to this host is not allowed" };
  }

  return { isValid: true, parsedUrl };
}
