/**
 * HTML metadata extraction utilities for link previews.
 * @module convex/lib/metadataExtractor
 */

/** User-Agent string for link preview requests. */
export const USER_AGENT = "BDR-LMS-LinkPreview/1.0 (+https://bdr-lms.com)";

/** Timeout for fetch requests in milliseconds. */
export const FETCH_TIMEOUT_MS = 5000;

/** Maximum response size to prevent memory exhaustion (1MB). */
export const MAX_RESPONSE_SIZE = 1024 * 1024;

/** Extracted metadata from an HTML page. */
export type ExtractedMetadata = {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
};

/** Common HTML entities mapping for decoding. */
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Decode common HTML entities in text.
 * Handles named entities, decimal numeric (&#123;), and hex (&#x7B;).
 */
export function decodeHtmlEntities(text: string): string {
  let result = text;

  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.replace(new RegExp(entity, "g"), char);
  }

  result = result.replace(/&#(\d+);/g, (_, num) =>
    String.fromCharCode(parseInt(num, 10))
  );
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  return result;
}

/** Resolve a relative URL against a base URL. */
export function resolveUrl(relative: string, base: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

/** Check if a URL string is absolute (starts with http:// or https://). */
export function isAbsoluteUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

/** Extract favicon URL from HTML, falling back to /favicon.ico. */
export function extractFavicon(html: string, baseUrl: string): string | undefined {
  const faviconPatterns = [
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
  ];

  for (const pattern of faviconPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return resolveUrl(match[1], baseUrl);
    }
  }

  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}/favicon.ico`;
  } catch {
    return undefined;
  }
}

/**
 * Extract Open Graph and fallback metadata from HTML.
 * Priority: OG tags > Twitter Card > standard meta > HTML title.
 */
export function extractMetadata(html: string, baseUrl: string): ExtractedMetadata {
  const result: ExtractedMetadata = {};

  const getMetaContent = (nameOrProperty: string): string | undefined => {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:name|property)=["']${nameOrProperty}["'][^>]+content=["']([^"']+)["']`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${nameOrProperty}["']`,
        "i"
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return decodeHtmlEntities(match[1].trim());
      }
    }
    return undefined;
  };

  // OG metadata (preferred)
  result.title = getMetaContent("og:title");
  result.description = getMetaContent("og:description");
  result.image = getMetaContent("og:image");

  // Fallback to Twitter Card
  if (!result.title) result.title = getMetaContent("twitter:title");
  if (!result.description) result.description = getMetaContent("twitter:description");
  if (!result.image) result.image = getMetaContent("twitter:image");

  // Fallback to standard meta
  if (!result.description) result.description = getMetaContent("description");

  // Fallback to HTML title
  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      result.title = decodeHtmlEntities(titleMatch[1].trim());
    }
  }

  result.favicon = extractFavicon(html, baseUrl);

  if (result.image && !isAbsoluteUrl(result.image)) {
    result.image = resolveUrl(result.image, baseUrl);
  }

  return result;
}

/** Fetch a URL with timeout protection using AbortController. */
export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Read response body with size limit protection. Prevents memory exhaustion. */
export async function readResponseWithSizeLimit(
  response: Response,
  maxSize: number = MAX_RESPONSE_SIZE
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to read response body");
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalSize += value.length;
    if (totalSize > maxSize) {
      reader.cancel();
      throw new Error("Response too large");
    }

    chunks.push(value);
  }

  const decoder = new TextDecoder();
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("");
}
