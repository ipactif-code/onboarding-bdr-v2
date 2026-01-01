"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { validateUrlForFetch } from "../lib/urlValidation";
import {
  extractMetadata,
  fetchWithTimeout,
  readResponseWithSizeLimit,
  FETCH_TIMEOUT_MS,
} from "../lib/metadataExtractor";

// Type workaround: Use require() to avoid TS2589 deep type instantiation on 'internal'
// The actual runtime value is still the properly typed internal API, but TypeScript
// won't try to evaluate the deep FilterApi type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { internal } = require("../_generated/api") as { internal: any };

/**
 * Link preview result type.
 */
type LinkPreviewResult = {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  error?: string;
};

/**
 * Link preview metadata validator for Convex returns.
 */
const linkPreviewResultValidator = v.object({
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  image: v.optional(v.string()),
  favicon: v.optional(v.string()),
  error: v.optional(v.string()),
});

// =============================================================================
// MAIN ACTION
// =============================================================================

/**
 * Generate a link preview by fetching Open Graph metadata from a URL.
 *
 * This action:
 * 1. Validates the URL format (must be http:// or https://)
 * 2. Blocks private/internal IPs (SSRF protection)
 * 3. Enforces rate limiting (10 requests/minute per user)
 * 4. Fetches the URL with a 5-second timeout
 * 5. Extracts Open Graph metadata (og:title, og:description, og:image)
 * 6. Falls back to basic HTML metadata if OG tags not found
 *
 * @param url - The URL to generate a preview for
 * @returns Object containing title, description, image, favicon, or error
 */
export const generateLinkPreview = action({
  args: { url: v.string() },
  returns: linkPreviewResultValidator,
  handler: async (ctx, args): Promise<LinkPreviewResult> => {
    // Step 1: Get the authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { error: "Authentication required" };
    }

    // Step 2: Validate URL format and check for blocked hosts (cheap operation FIRST)
    // This prevents wasting rate limit tokens on invalid URLs
    const validation = validateUrlForFetch(args.url);
    if (!validation.isValid) {
      return { error: validation.error };
    }

    // Step 3: Get user from database (needed for rate limiting)
    const user: { _id: Id<"users"> } | null = await ctx.runQuery(
      internal.users.getByClerkIdInternal,
      { clerkId: identity.subject }
    );

    if (!user) {
      return { error: "User not found" };
    }

    const userId = user._id;

    // Step 4: Check rate limit (AFTER validation, so invalid URLs don't consume quota)
    const rateLimit: { allowed: boolean; resetAt: number } = await ctx.runMutation(
      internal.rateLimits.consumeLinkPreviewRateLimit,
      { userId }
    );

    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetAt);
      return {
        error: `Rate limit exceeded. Try again after ${resetDate.toISOString()}`,
      };
    }

    // Step 5: Fetch the URL with timeout
    let response: Response;
    try {
      response = await fetchWithTimeout(args.url, FETCH_TIMEOUT_MS);
    } catch (error) {
      // Log detailed error server-side for debugging, return generic message to client
      console.error("[linkPreview] Fetch failed:", error);
      if (error instanceof Error && error.name === "AbortError") {
        return { error: "Request timed out" };
      }
      return { error: "Failed to fetch URL" };
    }

    // Step 6: Check response status
    if (!response.ok) {
      return { error: `HTTP error: ${response.status}` };
    }

    // Step 7: Check content type
    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      return { error: "URL does not return HTML content" };
    }

    // Step 8: Read response body with size limit
    let html: string;
    try {
      html = await readResponseWithSizeLimit(response);
    } catch (error) {
      if (error instanceof Error) {
        return { error: error.message };
      }
      return { error: "Failed to read response body" };
    }

    // Step 9: Extract metadata
    const metadata = extractMetadata(html, args.url);

    // Return result (at least one field should be present)
    if (!metadata.title && !metadata.description && !metadata.image) {
      return {
        ...metadata,
        error: "No metadata found",
      };
    }

    return metadata;
  },
});
