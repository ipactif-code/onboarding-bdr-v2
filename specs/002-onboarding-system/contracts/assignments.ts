/**
 * API Contracts: Track Assignments (UserOnboardings)
 *
 * Convex queries and mutations for assigning and managing user tracks.
 */

import { v } from "convex/values";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get assignments for a specific user.
 *
 * If userId is omitted, returns current user's assignments.
 * Admins can view any user. TLs can view their team members.
 */
export const getForUser = {
  args: {
    userId: v.optional(v.id("users")),
    includeCompleted: v.optional(v.boolean()), // default: false
  },
  returns: v.array(
    v.object({
      _id: v.id("userOnboardings"),
      track: v.object({
        _id: v.id("onboardingTracks"),
        name: v.string(),
        targetDuration: v.number(),
      }),
      assignedBy: v.object({
        _id: v.id("users"),
        name: v.string(),
      }),
      startDate: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("paused")
      ),
      progressPercentage: v.number(),
      dueDate: v.number(), // startDate + track.targetDuration
      isOverdue: v.boolean(),
      completedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
  ),
};

/**
 * Get detailed view of a single assignment.
 *
 * Returns all items with their status.
 */
export const getDetail = {
  args: {
    userOnboardingId: v.id("userOnboardings"),
  },
  returns: v.union(
    v.object({
      _id: v.id("userOnboardings"),
      user: v.object({
        _id: v.id("users"),
        name: v.string(),
        email: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      track: v.object({
        _id: v.id("onboardingTracks"),
        name: v.string(),
        description: v.optional(v.string()),
        targetDuration: v.number(),
      }),
      assignedBy: v.object({
        _id: v.id("users"),
        name: v.string(),
      }),
      startDate: v.number(),
      dueDate: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("paused")
      ),
      progressPercentage: v.number(),
      pausedAt: v.optional(v.number()),
      pausedReason: v.optional(v.string()),
      completedAt: v.optional(v.number()),
      items: v.array(
        v.object({
          _id: v.id("userOnboardingItems"),
          trackItem: v.object({
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
            isMandatory: v.boolean(),
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
          }),
          status: v.union(
            v.literal("pending"),
            v.literal("in_progress"),
            v.literal("completed"),
            v.literal("validation_requested"),
            v.literal("validation_rejected"),
            v.literal("scheduled")
          ),
          dueDate: v.number(), // startDate + dueDayOffset
          isOverdue: v.boolean(),
          completedAt: v.optional(v.number()),
          validator: v.optional(
            v.object({
              _id: v.id("users"),
              name: v.string(),
            })
          ),
          validatedAt: v.optional(v.number()),
          rejectionComment: v.optional(v.string()),
          scheduledAt: v.optional(v.number()),
          // For task type with subtasks
          subtasks: v.optional(
            v.array(
              v.object({
                _id: v.id("userOnboardingSubtasks"),
                subtask: v.object({
                  _id: v.id("onboardingSubtasks"),
                  title: v.string(),
                }),
                isChecked: v.boolean(),
                checkedAt: v.optional(v.number()),
              })
            )
          ),
          // For course type
          courseProgress: v.optional(v.number()), // 0-100
        })
      ),
    }),
    v.null()
  ),
};

/**
 * Get all assignments for a team (TL view).
 *
 * Requires Team Leader role for the team or Admin.
 */
export const getForTeam = {
  args: {
    teamId: v.id("teams"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("paused")
      )
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("userOnboardings"),
      user: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      track: v.object({
        _id: v.id("onboardingTracks"),
        name: v.string(),
      }),
      startDate: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("paused")
      ),
      progressPercentage: v.number(),
      dueDate: v.number(),
      isOverdue: v.boolean(),
      currentWeek: v.number(), // week number of onboarding (1, 2, 3...)
    })
  ),
};

/**
 * Get pending validations for the current user.
 *
 * Returns items where current user can validate (TL of team or Admin).
 */
export const getPendingValidations = {
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("userOnboardingItems"),
      user: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      trackItem: v.object({
        title: v.string(),
        description: v.optional(v.string()),
      }),
      track: v.object({
        _id: v.id("onboardingTracks"),
        name: v.string(),
      }),
      requestedAt: v.number(), // when status changed to validation_requested
    })
  ),
};

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Assign a track to one or more users.
 *
 * Admins can assign to anyone. TLs can only assign to their team members.
 */
export const assign = {
  args: {
    trackId: v.id("onboardingTracks"),
    userIds: v.array(v.id("users")),
    startDate: v.union(
      v.literal("today"),
      v.literal("first_login"),
      v.number() // custom timestamp
    ),
  },
  returns: v.object({
    assigned: v.number(),
    skipped: v.number(), // already has same track
  }),
};

/**
 * Pause an active track.
 */
export const pause = {
  args: {
    userOnboardingId: v.id("userOnboardings"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
};

/**
 * Resume a paused track.
 */
export const resume = {
  args: {
    userOnboardingId: v.id("userOnboardings"),
  },
  returns: v.null(),
};

// ============================================================================
// TASK COMPLETION MUTATIONS
// ============================================================================

/**
 * Mark a simple task as complete.
 *
 * For type="task" without subtasks.
 */
export const completeTask = {
  args: {
    itemId: v.id("userOnboardingItems"),
  },
  returns: v.null(),
};

/**
 * Toggle a subtask checkbox.
 *
 * Auto-completes parent task when all subtasks are checked.
 */
export const toggleSubtask = {
  args: {
    subtaskId: v.id("userOnboardingSubtasks"),
  },
  returns: v.object({
    isChecked: v.boolean(),
    parentCompleted: v.boolean(),
  }),
};

/**
 * Mark a document as read.
 */
export const markDocumentRead = {
  args: {
    itemId: v.id("userOnboardingItems"),
  },
  returns: v.null(),
};

/**
 * Request validation for a validation-type task.
 */
export const requestValidation = {
  args: {
    itemId: v.id("userOnboardingItems"),
  },
  returns: v.null(),
};

/**
 * Approve a validation request.
 *
 * Requires TL (for team member) or Admin.
 */
export const approveValidation = {
  args: {
    itemId: v.id("userOnboardingItems"),
  },
  returns: v.null(),
};

/**
 * Reject a validation request.
 *
 * Requires comment explaining rejection.
 */
export const rejectValidation = {
  args: {
    itemId: v.id("userOnboardingItems"),
    comment: v.string(),
  },
  returns: v.null(),
};

/**
 * Proactively validate a task (without request).
 *
 * TL/Admin can approve tasks without waiting for request.
 */
export const proactiveValidate = {
  args: {
    itemId: v.id("userOnboardingItems"),
  },
  returns: v.null(),
};

/**
 * Schedule a meeting.
 *
 * Creates calendar event via Microsoft Graph API.
 */
export const scheduleMeeting = {
  args: {
    itemId: v.id("userOnboardingItems"),
    scheduledAt: v.number(), // timestamp
    accessToken: v.string(), // Microsoft Graph access token
  },
  returns: v.object({
    success: v.boolean(),
    calendarEventId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
};

/**
 * Mark a scheduled meeting as completed.
 */
export const completeMeeting = {
  args: {
    itemId: v.id("userOnboardingItems"),
  },
  returns: v.null(),
};

// ============================================================================
// TEMPLATE UPDATE SYNC
// ============================================================================

/**
 * Sync active tracks with template changes.
 *
 * Called when template is modified and user chooses to update active tracks.
 */
export const syncWithTemplate = {
  args: {
    trackId: v.id("onboardingTracks"),
    changes: v.object({
      addedItemIds: v.array(v.id("onboardingTrackItems")),
      removedItemIds: v.array(v.id("onboardingTrackItems")),
      modifiedItemIds: v.array(v.id("onboardingTrackItems")),
    }),
  },
  returns: v.object({
    tracksUpdated: v.number(),
    itemsAdded: v.number(),
    itemsRemoved: v.number(),
    itemsModified: v.number(),
  }),
};
