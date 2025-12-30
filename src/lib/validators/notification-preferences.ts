import { z } from "zod";

/**
 * Schema for notification preferences form
 * Validates all notification settings including Do Not Disturb hours
 */
export const notificationPreferencesSchema = z.object({
  // Notification triggers
  mentions: z.boolean(),
  directMessages: z.boolean(),
  channelMessages: z.boolean(),

  // Notification methods
  desktopNotifications: z.boolean(),
  soundEnabled: z.boolean(),

  // Do Not Disturb schedule
  doNotDisturbEnabled: z.boolean(),
  doNotDisturbStart: z.number().min(0).max(23).nullable(),
  doNotDisturbEnd: z.number().min(0).max(23).nullable(),
});

export type NotificationPreferencesFormValues = z.infer<
  typeof notificationPreferencesSchema
>;

/**
 * Default values for notification preferences form
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesFormValues =
  {
    mentions: true,
    directMessages: true,
    channelMessages: true,
    desktopNotifications: false,
    soundEnabled: true,
    doNotDisturbEnabled: false,
    doNotDisturbStart: null,
    doNotDisturbEnd: null,
  };

/**
 * Hour options for DND time picker (0-23)
 */
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i.toString().padStart(2, "0") + ":00",
}));
