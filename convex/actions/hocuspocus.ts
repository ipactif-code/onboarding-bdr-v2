"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

// Type workaround: Use dynamic import pattern to avoid TS2589 deep type instantiation
// The convexApi variable is typed as 'any' which breaks the deep type chain
// This is necessary because Convex's internal API generates very deep types
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
const convexApi: any = require("../_generated/api").api;

/**
 * Maximum number of concurrent editors per document.
 */
const MAX_EDITORS = 25;

/**
 * Result validator for the getHocuspocusToken action.
 * Note: token is not returned from Convex - the client must pass its own Clerk JWT
 * to the Hocuspocus server for authentication.
 */
const hocuspocusTokenResultValidator = v.object({
  canJoin: v.boolean(),
  url: v.optional(v.string()),
  roomName: v.optional(v.string()),
  reason: v.optional(v.string()),
  activeEditors: v.optional(v.number()),
  maxEditors: v.optional(v.number()),
});

/**
 * Result type for the getHocuspocusToken action.
 */
type HocuspocusTokenResult = {
  canJoin: boolean;
  url?: string;
  roomName?: string;
  reason?: string;
  activeEditors?: number;
  maxEditors?: number;
};

/**
 * Get connection details for Hocuspocus collaboration server.
 *
 * This action performs server-side validation before allowing collaboration:
 * 1. Validates user is authenticated via Clerk
 * 2. Checks document exists and user has access
 * 3. Checks 25-editor limit
 * 4. Returns connection details if all checks pass
 *
 * Note: The client must pass its own Clerk JWT token to Hocuspocus for
 * authentication. This action only validates permissions and returns
 * connection details.
 *
 * @param documentId - The document ID to join collaboration for
 * @returns Object with canJoin status, url, roomName, or reason for denial
 */
export const getHocuspocusToken = action({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: hocuspocusTokenResultValidator,
  handler: async (ctx, args): Promise<HocuspocusTokenResult> => {
    // 1. Get user identity from Clerk
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        canJoin: false,
        reason: "Authentication required. Please sign in.",
      };
    }

    // 2. Check document exists (this also checks read permission via kbAuth)
    // The documents.get query returns null if document not found or no access
    const document = await ctx.runQuery(convexApi.knowledge.documents.get, {
      id: args.documentId,
    });

    if (!document) {
      return {
        canJoin: false,
        reason: "Document not found or access denied.",
      };
    }

    // 3. Check 25-editor limit using collaboration query
    const collaboratorCount: number = await ctx.runQuery(
      convexApi.knowledge.collaboration.getCollaboratorCount,
      { documentId: args.documentId }
    );

    if (collaboratorCount >= MAX_EDITORS) {
      return {
        canJoin: false,
        reason: `This document has reached the maximum of ${MAX_EDITORS} concurrent editors. Please try again later.`,
        activeEditors: collaboratorCount,
        maxEditors: MAX_EDITORS,
      };
    }

    // 4. Get Hocuspocus URL from environment
    const hocuspocusUrl = process.env.HOCUSPOCUS_URL;

    if (!hocuspocusUrl) {
      console.error(
        "[getHocuspocusToken] HOCUSPOCUS_URL environment variable not set"
      );
      return {
        canJoin: false,
        reason: "Collaboration server not configured.",
      };
    }

    // 5. Return connection details
    // The client will use its own Clerk JWT token for Hocuspocus authentication
    return {
      canJoin: true,
      url: hocuspocusUrl,
      roomName: `kb-doc-${args.documentId}`,
      activeEditors: collaboratorCount,
      maxEditors: MAX_EDITORS,
    };
  },
});
