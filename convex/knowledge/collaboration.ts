import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

/**
 * Color palette for cursor identification.
 * 10 distinct colors that are visible on both light and dark backgrounds.
 */
const CURSOR_COLORS = [
  "#FF5733", // Red-Orange
  "#33FF57", // Green
  "#3357FF", // Blue
  "#FF33F5", // Magenta
  "#33FFF5", // Cyan
  "#FFB833", // Orange
  "#B833FF", // Purple
  "#FF3366", // Pink
  "#33FFB8", // Mint
  "#FFE033", // Yellow
] as const;

/**
 * Maximum number of concurrent editors per document.
 */
const MAX_CONCURRENT_EDITORS = 25;

/**
 * Maximum length for connection IDs.
 * UUIDs are 36 characters, this provides buffer for other ID formats.
 */
const MAX_CONNECTION_ID_LENGTH = 64;

// ============ SLATE TYPE VALIDATORS ============

/**
 * Slate Point validator - represents a position in the document.
 * A point has a path (array of indices into the tree) and an offset (character position).
 */
const slatePointValidator = v.object({
  path: v.array(v.number()),
  offset: v.number(),
});

/**
 * Slate Range validator - represents a selection range.
 * A range has an anchor point (start) and focus point (end).
 */
const slateRangeValidator = v.object({
  anchor: slatePointValidator,
  focus: slatePointValidator,
});

// ============ QUERIES ============

/**
 * Get all active collaborators for a document.
 * Returns users currently editing with their cursor positions and colors.
 */
export const getActiveCollaborators = query({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbDocumentCollaborators"),
      userId: v.id("users"),
      cursorColor: v.string(),
      cursorPosition: v.optional(slatePointValidator),
      selectionRange: v.optional(slateRangeValidator),
      isTyping: v.boolean(),
      lastActiveAt: v.number(),
      user: v.union(
        v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        }),
        v.null()
      ),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const collaborators = await ctx.db
      .query("kbDocumentCollaborators")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Fetch user details for each collaborator
    const collaboratorsWithUsers = await Promise.all(
      collaborators.map(async (collab) => {
        const user = await ctx.db.get(collab.userId);
        return {
          _id: collab._id,
          userId: collab.userId,
          cursorColor: collab.cursorColor,
          cursorPosition: collab.cursorPosition,
          selectionRange: collab.selectionRange,
          isTyping: collab.isTyping,
          lastActiveAt: collab.lastActiveAt,
          user: user
            ? {
                _id: user._id,
                name: user.name,
                avatarUrl: user.avatarUrl,
              }
            : null,
        };
      })
    );

    return collaboratorsWithUsers;
  },
});

/**
 * Get the count of active collaborators for a document.
 * Useful for checking against the 25-editor limit.
 */
export const getCollaboratorCount = query({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const activeSessions = await ctx.db
      .query("kbCollaborationSessions")
      .withIndex("by_document_active", (q) =>
        q.eq("documentId", args.documentId).eq("leftAt", undefined)
      )
      .collect();

    return activeSessions.length;
  },
});

/**
 * Check if the current user is an active collaborator on a document.
 */
export const isUserCollaborating = query({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.union(
    v.object({
      isCollaborating: v.literal(true),
      collaboratorId: v.id("kbDocumentCollaborators"),
      cursorColor: v.string(),
    }),
    v.object({
      isCollaborating: v.literal(false),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const collaborator = await ctx.db
      .query("kbDocumentCollaborators")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", user._id)
      )
      .first();

    if (collaborator) {
      return {
        isCollaborating: true as const,
        collaboratorId: collaborator._id,
        cursorColor: collaborator.cursorColor,
      };
    }

    return { isCollaborating: false as const };
  },
});

// ============ MUTATIONS ============

/**
 * Join a collaboration session for a document.
 * Assigns a unique cursor color and creates session/collaborator records.
 * Enforces 25-editor limit.
 */
export const joinSession = mutation({
  args: {
    documentId: v.id("kbDocuments"),
    connectionId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    cursorColor: v.optional(v.string()),
    collaboratorId: v.optional(v.id("kbDocumentCollaborators")),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate connectionId length to prevent memory exhaustion
    if (args.connectionId.length > MAX_CONNECTION_ID_LENGTH) {
      return {
        success: false,
        message: `Connection ID exceeds maximum length of ${MAX_CONNECTION_ID_LENGTH} characters.`,
      };
    }

    // Validate document exists
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      return {
        success: false,
        message: "Document not found.",
      };
    }

    // Check 25-editor limit
    const activeSessions = await ctx.db
      .query("kbCollaborationSessions")
      .withIndex("by_document_active", (q) =>
        q.eq("documentId", args.documentId).eq("leftAt", undefined)
      )
      .collect();

    if (activeSessions.length >= MAX_CONCURRENT_EDITORS) {
      return {
        success: false,
        message: `Document has reached the maximum of ${MAX_CONCURRENT_EDITORS} concurrent editors.`,
      };
    }

    // Check if user already has an active session
    const existingSession = activeSessions.find((s) => s.userId === user._id);
    if (existingSession) {
      // Return existing collaborator
      const existingCollab = await ctx.db
        .query("kbDocumentCollaborators")
        .withIndex("by_document_user", (q) =>
          q.eq("documentId", args.documentId).eq("userId", user._id)
        )
        .first();

      if (existingCollab) {
        return {
          success: true,
          cursorColor: existingCollab.cursorColor,
          collaboratorId: existingCollab._id,
        };
      }
    }

    // Get used colors for this document
    const currentCollaborators = await ctx.db
      .query("kbDocumentCollaborators")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const usedColors = new Set(currentCollaborators.map((c) => c.cursorColor));

    // Assign first available color
    let cursorColor: string = CURSOR_COLORS[0]!;
    for (const color of CURSOR_COLORS) {
      if (!usedColors.has(color)) {
        cursorColor = color;
        break;
      }
    }
    // If all colors used, cycle back with index
    if (usedColors.size >= CURSOR_COLORS.length) {
      const colorIndex = activeSessions.length % CURSOR_COLORS.length;
      cursorColor = CURSOR_COLORS[colorIndex] ?? CURSOR_COLORS[0]!;
    }

    const now = Date.now();

    // Create session record
    await ctx.db.insert("kbCollaborationSessions", {
      documentId: args.documentId,
      userId: user._id,
      connectionId: args.connectionId,
      joinedAt: now,
      leftAt: undefined,
      duration: undefined,
    });

    // Create collaborator record
    const collaboratorId = await ctx.db.insert("kbDocumentCollaborators", {
      documentId: args.documentId,
      userId: user._id,
      cursorColor,
      cursorPosition: undefined,
      selectionRange: undefined,
      isTyping: false,
      lastActiveAt: now,
    });

    return {
      success: true,
      cursorColor,
      collaboratorId,
    };
  },
});

/**
 * Leave a collaboration session.
 * Updates session with end time and duration, removes collaborator record.
 */
export const leaveSession = mutation({
  args: {
    documentId: v.id("kbDocuments"),
    connectionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate connectionId length to prevent memory exhaustion
    if (args.connectionId.length > MAX_CONNECTION_ID_LENGTH) {
      // Silently return for invalid connection IDs on leave
      return null;
    }

    const now = Date.now();

    // Find and update the session
    const session = await ctx.db
      .query("kbCollaborationSessions")
      .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId))
      .first();

    if (session && session.userId === user._id) {
      await ctx.db.patch(session._id, {
        leftAt: now,
        duration: now - session.joinedAt,
      });
    }

    // Remove collaborator record
    const collaborator = await ctx.db
      .query("kbDocumentCollaborators")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", user._id)
      )
      .first();

    if (collaborator) {
      await ctx.db.delete(collaborator._id);
    }

    return null;
  },
});

/**
 * Update cursor position for the current user.
 * Called frequently during editing to sync cursor state.
 */
export const updateCursor = mutation({
  args: {
    documentId: v.id("kbDocuments"),
    cursorPosition: v.optional(slatePointValidator),
    selectionRange: v.optional(slateRangeValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const collaborator = await ctx.db
      .query("kbDocumentCollaborators")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", user._id)
      )
      .first();

    if (collaborator) {
      await ctx.db.patch(collaborator._id, {
        cursorPosition: args.cursorPosition,
        selectionRange: args.selectionRange,
        lastActiveAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Set typing indicator for the current user.
 * Used to show "User is typing..." in the UI.
 */
export const setTyping = mutation({
  args: {
    documentId: v.id("kbDocuments"),
    isTyping: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const collaborator = await ctx.db
      .query("kbDocumentCollaborators")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", user._id)
      )
      .first();

    if (collaborator) {
      await ctx.db.patch(collaborator._id, {
        isTyping: args.isTyping,
        lastActiveAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Heartbeat to update last active time.
 * Called periodically to detect stale collaborators.
 */
export const heartbeat = mutation({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const collaborator = await ctx.db
      .query("kbDocumentCollaborators")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", user._id)
      )
      .first();

    if (collaborator) {
      await ctx.db.patch(collaborator._id, {
        lastActiveAt: Date.now(),
      });
    }

    return null;
  },
});
