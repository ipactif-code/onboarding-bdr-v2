/**
 * API Contracts: Real-Time Collaboration
 *
 * Convex queries and mutations for Liveblocks-powered collaboration.
 * Handles room management, presence, and cursor synchronization.
 * All functions require authentication via requireAuth().
 */

import { v } from "convex/values";

// =============================================================================
// VALIDATORS
// =============================================================================

export const cursorData = v.object({
  name: v.string(),
  color: v.string(), // Hex color
  avatarUrl: v.optional(v.string()),
});

export const presenceData = v.object({
  cursor: v.optional(
    v.object({
      x: v.number(),
      y: v.number(),
    })
  ),
  selection: v.optional(
    v.object({
      start: v.number(),
      end: v.number(),
    })
  ),
  isTyping: v.boolean(),
  lastActiveAt: v.number(),
});

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get Liveblocks room token for a document.
 *
 * Creates or returns existing room for the document.
 * Validates user has at least read permission.
 *
 * @param documentId - Document to get room for
 * @returns Room token and user info for Liveblocks
 *
 * @example
 * const { token, roomId, userInfo } = useQuery(api.knowledge.collaboration.getRoom, {
 *   documentId,
 * });
 */
export const getRoom = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.union(
    v.object({
      token: v.string(), // Liveblocks JWT token
      roomId: v.string(), // Room identifier
      userInfo: v.object({
        id: v.string(),
        name: v.string(),
        color: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      canEdit: v.boolean(), // User has write permission
    }),
    v.null() // If user lacks permission
  ),
};

/**
 * Get current collaborators in a document.
 *
 * Returns users currently viewing or editing.
 *
 * @param documentId - Document to check
 * @returns List of active collaborators
 *
 * @example
 * const collaborators = useQuery(api.knowledge.collaboration.getCollaborators, {
 *   documentId,
 * });
 */
export const getCollaborators = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      color: v.string(),
      isEditing: v.boolean(),
      lastActiveAt: v.number(),
    })
  ),
};

/**
 * Get document editing status.
 *
 * Used to show lock indicator if document is being edited.
 *
 * @param documentId - Document to check
 * @returns Editing status
 *
 * @example
 * const status = useQuery(api.knowledge.collaboration.getEditingStatus, {
 *   documentId,
 * });
 */
export const getEditingStatus = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.object({
    isBeingEdited: v.boolean(),
    editorCount: v.number(),
    editors: v.array(
      v.object({
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      })
    ),
    // Limit check
    atCapacity: v.boolean(), // >= 25 concurrent editors
  }),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Join a document editing session.
 *
 * Updates presence and notifies other collaborators.
 *
 * @param documentId - Document to join
 * @returns Session info
 * @throws Error if document at capacity (25 editors)
 *
 * @example
 * const session = await joinSession({ documentId });
 */
export const joinSession = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.object({
    sessionId: v.string(),
    roomId: v.string(),
    color: v.string(), // Assigned cursor color
    editorCount: v.number(),
  }),
};

/**
 * Leave a document editing session.
 *
 * Cleans up presence data.
 *
 * @param documentId - Document to leave
 *
 * @example
 * await leaveSession({ documentId });
 */
export const leaveSession = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
};

/**
 * Update cursor position.
 *
 * Called frequently during editing to sync cursor.
 * Throttled on client side.
 *
 * @param documentId - Document being edited
 * @param cursor - Cursor position
 *
 * @example
 * await updateCursor({
 *   documentId,
 *   cursor: { x: 100, y: 200 },
 * });
 */
export const updateCursor = {
  args: {
    documentId: v.id("kbDocuments"),
    cursor: v.object({
      x: v.number(),
      y: v.number(),
    }),
  },
  returns: v.null(),
};

/**
 * Update selection range.
 *
 * Shows other users what text is selected.
 *
 * @param documentId - Document being edited
 * @param selection - Selection range (null to clear)
 *
 * @example
 * await updateSelection({
 *   documentId,
 *   selection: { start: 0, end: 50 },
 * });
 */
export const updateSelection = {
  args: {
    documentId: v.id("kbDocuments"),
    selection: v.union(
      v.object({
        start: v.number(),
        end: v.number(),
      }),
      v.null()
    ),
  },
  returns: v.null(),
};

/**
 * Set typing indicator.
 *
 * Shows "user is typing..." to others.
 *
 * @param documentId - Document being edited
 * @param isTyping - Typing state
 *
 * @example
 * await setTyping({ documentId, isTyping: true });
 */
export const setTyping = {
  args: {
    documentId: v.id("kbDocuments"),
    isTyping: v.boolean(),
  },
  returns: v.null(),
};

// =============================================================================
// ACTIONS (Liveblocks API)
// =============================================================================

/**
 * Generate Liveblocks auth token.
 *
 * Called when client needs to authenticate with Liveblocks.
 *
 * @param documentId - Document for room access
 * @returns Liveblocks JWT token
 *
 * @example
 * const { token } = await getLiveblocksToken({ documentId });
 */
export const getLiveblocksToken = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.object({
    token: v.string(),
  }),
};

/**
 * Broadcast a message to all collaborators.
 *
 * Used for notifications like "user saved version".
 *
 * @param documentId - Document room
 * @param event - Event type
 * @param data - Event data
 *
 * @example
 * await broadcastEvent({
 *   documentId,
 *   event: "version_saved",
 *   data: { versionNumber: 5 },
 * });
 */
export const broadcastEvent = {
  args: {
    documentId: v.id("kbDocuments"),
    event: v.string(),
    data: v.optional(v.any()),
  },
  returns: v.null(),
};

// =============================================================================
// INTERNAL
// =============================================================================

/**
 * Clean up stale sessions.
 *
 * Called by scheduled job to remove inactive collaborators.
 *
 * @internal
 */
export const cleanupStaleSessions = {
  args: {},
  returns: v.object({
    cleanedCount: v.number(),
  }),
};

/**
 * Assign cursor color to user.
 *
 * Ensures each user in a room has a unique color.
 *
 * @internal
 */
export const assignCursorColor = {
  args: {
    documentId: v.id("kbDocuments"),
    userId: v.id("users"),
  },
  returns: v.string(), // Hex color
};
