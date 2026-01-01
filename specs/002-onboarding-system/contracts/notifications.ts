/**
 * API Contracts: Onboarding Notifications
 *
 * In-app notifications and email delivery for onboarding events.
 */

import { v } from "convex/values";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get notifications for current user.
 *
 * Paginated, sorted by most recent first.
 */
export const list = {
  args: {
    limit: v.optional(v.number()), // default: 20
    cursor: v.optional(v.string()),
    unreadOnly: v.optional(v.boolean()), // default: false
  },
  returns: v.object({
    notifications: v.array(
      v.object({
        _id: v.id("onboardingNotifications"),
        type: v.union(
          v.literal("track_assigned"),
          v.literal("deadline_reminder"),
          v.literal("overdue"),
          v.literal("validation_requested"),
          v.literal("validation_approved"),
          v.literal("validation_rejected"),
          v.literal("track_completed")
        ),
        message: v.string(),
        isRead: v.boolean(),
        createdAt: v.number(),
        // Context for navigation
        userOnboardingId: v.optional(v.id("userOnboardings")),
        userOnboardingItemId: v.optional(v.id("userOnboardingItems")),
      })
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
  }),
};

/**
 * Get unread notification count.
 *
 * For badge display.
 */
export const getUnreadCount = {
  args: {},
  returns: v.number(),
};

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Mark a notification as read.
 */
export const markAsRead = {
  args: {
    notificationId: v.id("onboardingNotifications"),
  },
  returns: v.null(),
};

/**
 * Mark all notifications as read.
 */
export const markAllAsRead = {
  args: {},
  returns: v.number(), // count marked
};

// ============================================================================
// INTERNAL MUTATIONS (called by crons/actions)
// ============================================================================

/**
 * Create notification and optionally send email.
 *
 * Internal function called by other mutations.
 */
export const create = {
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("track_assigned"),
      v.literal("deadline_reminder"),
      v.literal("overdue"),
      v.literal("validation_requested"),
      v.literal("validation_approved"),
      v.literal("validation_rejected"),
      v.literal("track_completed")
    ),
    message: v.string(),
    userOnboardingId: v.optional(v.id("userOnboardings")),
    userOnboardingItemId: v.optional(v.id("userOnboardingItems")),
    sendEmail: v.boolean(),
  },
  returns: v.id("onboardingNotifications"),
};

/**
 * Check and send deadline reminders.
 *
 * Called by cron job. Checks all active tracks for items due within reminder window.
 */
export const checkDeadlineReminders = {
  args: {},
  returns: v.object({
    checked: v.number(),
    notified: v.number(),
  }),
};

/**
 * Check and send overdue notifications.
 *
 * Called by cron job. Sends daily notifications for overdue items.
 */
export const checkOverdueItems = {
  args: {},
  returns: v.object({
    checked: v.number(),
    notified: v.number(),
  }),
};

// ============================================================================
// EMAIL ACTION
// ============================================================================

/**
 * Send email via Resend.
 *
 * Convex action with external API call.
 */
export const sendEmail = {
  args: {
    to: v.string(),
    subject: v.string(),
    template: v.union(
      v.literal("track_assigned"),
      v.literal("deadline_reminder"),
      v.literal("overdue"),
      v.literal("validation_requested"),
      v.literal("validation_approved"),
      v.literal("validation_rejected"),
      v.literal("track_completed")
    ),
    data: v.object({
      recipientName: v.string(),
      // Template-specific fields
      trackName: v.optional(v.string()),
      taskTitle: v.optional(v.string()),
      dueDate: v.optional(v.string()),
      assignedBy: v.optional(v.string()),
      validatorName: v.optional(v.string()),
      rejectionComment: v.optional(v.string()),
      progressPercentage: v.optional(v.number()),
      dashboardUrl: v.string(),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    emailId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
};
