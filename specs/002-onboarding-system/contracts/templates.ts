/**
 * API Contracts: Onboarding Templates
 *
 * Convex queries and mutations for template management.
 * All functions require authentication.
 */

import { v } from "convex/values";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List all templates.
 *
 * Admins see all templates. Team Leaders see all templates (read-only for others').
 * Returns sorted by name.
 */
export const list = {
  args: {
    includeArchived: v.optional(v.boolean()), // default: false
    creatorId: v.optional(v.id("users")), // filter by creator
  },
  returns: v.array(
    v.object({
      _id: v.id("onboardingTracks"),
      name: v.string(),
      description: v.optional(v.string()),
      targetDuration: v.number(),
      taskCount: v.number(),
      activeTrackCount: v.number(), // count of non-completed userOnboardings
      creator: v.object({
        _id: v.id("users"),
        name: v.string(),
      }),
      isArchived: v.boolean(),
      isOwner: v.boolean(), // can current user edit?
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
};

/**
 * Get a single template by ID with full details.
 */
export const get = {
  args: {
    trackId: v.id("onboardingTracks"),
  },
  returns: v.union(
    v.object({
      _id: v.id("onboardingTracks"),
      name: v.string(),
      description: v.optional(v.string()),
      targetDuration: v.number(),
      reminderDays: v.array(v.number()),
      creator: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      isArchived: v.boolean(),
      isOwner: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      items: v.array(
        v.object({
          _id: v.id("onboardingTrackItems"),
          title: v.string(),
          description: v.optional(v.string()),
          type: v.union(
            v.literal("course"),
            v.literal("task"),
            v.literal("validation"),
            v.literal("meeting"),
            v.literal("document")
          ),
          dueDayOffset: v.number(),
          displayOrder: v.number(),
          isMandatory: v.boolean(),
          // Type-specific
          course: v.optional(
            v.object({
              _id: v.id("courses"),
              title: v.string(),
              thumbnailUrl: v.optional(v.string()),
            })
          ),
          meetingDuration: v.optional(v.number()),
          meetingContact: v.optional(v.string()),
          documentUrl: v.optional(v.string()),
          // Subtasks (for type="task")
          subtasks: v.optional(
            v.array(
              v.object({
                _id: v.id("onboardingSubtasks"),
                title: v.string(),
                displayOrder: v.number(),
              })
            )
          ),
        })
      ),
    }),
    v.null()
  ),
};

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new template.
 *
 * Admins and Team Leaders can create templates.
 */
export const create = {
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    targetDuration: v.number(),
    reminderDays: v.array(v.number()),
  },
  returns: v.id("onboardingTracks"),
};

/**
 * Update template metadata.
 *
 * Only the creator (or admin) can update.
 */
export const update = {
  args: {
    trackId: v.id("onboardingTracks"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    targetDuration: v.optional(v.number()),
    reminderDays: v.optional(v.array(v.number())),
  },
  returns: v.null(),
};

/**
 * Archive a template (soft delete).
 *
 * Only the creator (or admin) can archive.
 * Active tracks continue but template won't appear in selection lists.
 */
export const archive = {
  args: {
    trackId: v.id("onboardingTracks"),
  },
  returns: v.null(),
};

/**
 * Restore an archived template.
 */
export const restore = {
  args: {
    trackId: v.id("onboardingTracks"),
  },
  returns: v.null(),
};

/**
 * Duplicate a template.
 *
 * Creates a copy owned by the current user.
 */
export const duplicate = {
  args: {
    trackId: v.id("onboardingTracks"),
    newName: v.optional(v.string()), // default: "Copy of [original name]"
  },
  returns: v.id("onboardingTracks"),
};

// ============================================================================
// ITEM MUTATIONS
// ============================================================================

/**
 * Add a task item to a template.
 */
export const addItem = {
  args: {
    trackId: v.id("onboardingTracks"),
    title: v.string(),
    description: v.optional(v.string()),
    type: v.union(
      v.literal("course"),
      v.literal("task"),
      v.literal("validation"),
      v.literal("meeting"),
      v.literal("document")
    ),
    dueDayOffset: v.number(),
    isMandatory: v.boolean(),
    // Type-specific (provide based on type)
    courseId: v.optional(v.id("courses")),
    meetingDuration: v.optional(v.number()),
    meetingContact: v.optional(v.string()),
    documentUrl: v.optional(v.string()),
  },
  returns: v.id("onboardingTrackItems"),
};

/**
 * Update a task item.
 */
export const updateItem = {
  args: {
    itemId: v.id("onboardingTrackItems"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDayOffset: v.optional(v.number()),
    isMandatory: v.optional(v.boolean()),
    // Type-specific
    courseId: v.optional(v.id("courses")),
    meetingDuration: v.optional(v.number()),
    meetingContact: v.optional(v.string()),
    documentUrl: v.optional(v.string()),
  },
  returns: v.null(),
};

/**
 * Remove a task item.
 */
export const removeItem = {
  args: {
    itemId: v.id("onboardingTrackItems"),
  },
  returns: v.null(),
};

/**
 * Reorder task items.
 */
export const reorderItems = {
  args: {
    trackId: v.id("onboardingTracks"),
    itemIds: v.array(v.id("onboardingTrackItems")), // new order
  },
  returns: v.null(),
};

// ============================================================================
// SUBTASK MUTATIONS
// ============================================================================

/**
 * Add a subtask to a task item.
 */
export const addSubtask = {
  args: {
    itemId: v.id("onboardingTrackItems"),
    title: v.string(),
  },
  returns: v.id("onboardingSubtasks"),
};

/**
 * Update a subtask.
 */
export const updateSubtask = {
  args: {
    subtaskId: v.id("onboardingSubtasks"),
    title: v.string(),
  },
  returns: v.null(),
};

/**
 * Remove a subtask.
 */
export const removeSubtask = {
  args: {
    subtaskId: v.id("onboardingSubtasks"),
  },
  returns: v.null(),
};

/**
 * Reorder subtasks.
 */
export const reorderSubtasks = {
  args: {
    itemId: v.id("onboardingTrackItems"),
    subtaskIds: v.array(v.id("onboardingSubtasks")),
  },
  returns: v.null(),
};
