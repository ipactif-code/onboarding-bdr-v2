/**
 * API Contracts: AI Trainer Notifications
 *
 * Feature: 004-ai-trainer-sessions
 * These are TYPE DEFINITIONS only - not the actual implementation.
 * Implementation will be in convex/aiTrainer/*.ts
 */

import { v } from "convex/values";
import type { Id } from "convex/_generated/dataModel";

// =============================================================================
// TYPES
// =============================================================================

export type NotificationType =
  | "evaluation_assigned"
  | "evaluation_deadline_approaching"
  | "evaluation_deadline_passed"
  | "evaluation_extended"
  | "evaluation_closed";

export interface AITrainerNotification {
  _id: Id<"aiTrainerNotifications">;
  userId: Id<"users">;
  type: NotificationType;
  titleKey: string;
  messageKey: string;
  messageParams?: Record<string, unknown>;
  evaluationAssignmentId?: Id<"evaluationAssignments">;
  isRead: boolean;
  readAt?: number;
  createdAt: number;
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get unread AI Trainer notifications for current user
 */
export const listUnreadNotifications = {
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("aiTrainerNotifications"),
      type: v.string(),
      titleKey: v.string(),
      messageKey: v.string(),
      messageParams: v.optional(v.any()),
      evaluationAssignmentId: v.optional(v.id("evaluationAssignments")),
      createdAt: v.number(),
    })
  ),
};

/**
 * Get notification count for badge display
 */
export const getUnreadCount = {
  args: {},
  returns: v.object({
    count: v.number(),
  }),
};

/**
 * Get all notifications with pagination
 */
export const listNotifications = {
  args: {
    paginationOpts: v.object({
      cursor: v.optional(v.string()),
      numItems: v.optional(v.number()), // Default 20
    }),
  },
  returns: v.object({
    notifications: v.array(
      v.object({
        _id: v.id("aiTrainerNotifications"),
        type: v.string(),
        titleKey: v.string(),
        messageKey: v.string(),
        messageParams: v.optional(v.any()),
        evaluationAssignmentId: v.optional(v.id("evaluationAssignments")),
        isRead: v.boolean(),
        readAt: v.optional(v.number()),
        createdAt: v.number(),
      })
    ),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Mark a notification as read
 * @param notificationId - The notification to mark read
 */
export const markAsRead = {
  args: {
    notificationId: v.id("aiTrainerNotifications"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = {
  args: {},
  returns: v.object({
    count: v.number(),
  }),
};

// =============================================================================
// INTERNAL MUTATIONS (Called by other functions)
// =============================================================================

/**
 * Create a notification (internal use only)
 */
export const createNotification = {
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("evaluation_assigned"),
      v.literal("evaluation_deadline_approaching"),
      v.literal("evaluation_deadline_passed"),
      v.literal("evaluation_extended"),
      v.literal("evaluation_closed")
    ),
    titleKey: v.string(),
    messageKey: v.string(),
    messageParams: v.optional(v.any()),
    evaluationAssignmentId: v.optional(v.id("evaluationAssignments")),
  },
  returns: v.object({
    notificationId: v.id("aiTrainerNotifications"),
  }),
};
