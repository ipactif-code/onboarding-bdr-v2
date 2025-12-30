import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// ============================================================================
// Default Preferences
// ============================================================================

/**
 * Default notification preferences for new users.
 * Applied when no preferences record exists.
 */
const DEFAULT_PREFERENCES = {
  mentions: true,
  directMessages: true,
  channelMessages: true,
  desktopNotifications: false,
  soundEnabled: true,
  doNotDisturbStart: null as number | null,
  doNotDisturbEnd: null as number | null,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert hour number (0-23) to HH:MM format string.
 * Returns undefined if hour is null.
 */
function hourToTimeString(hour: number | null): string | undefined {
  if (hour === null) return undefined;
  const hourStr = hour.toString().padStart(2, "0");
  return `${hourStr}:00`;
}

/**
 * Convert HH:MM format string to hour number (0-23).
 * Returns null if string is undefined or invalid.
 */
function timeStringToHour(time: string | undefined): number | null {
  if (!time) return null;
  const parts = time.split(":");
  const hourStr = parts[0];
  if (!hourStr) return null;
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

/**
 * Validate that a number is a valid hour (0-23) or null.
 * Throws an error if invalid.
 */
function validateHour(value: number | null | undefined, fieldName: string): void {
  if (value === null || value === undefined) return;
  if (!Number.isInteger(value) || value < 0 || value > 23) {
    throw new Error(`${fieldName} must be a valid hour between 0 and 23`);
  }
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get the current user's notification preferences.
 * Returns default values if no preferences have been set.
 */
export const getPreferences = query({
  args: {},
  returns: v.object({
    mentions: v.boolean(),
    directMessages: v.boolean(),
    channelMessages: v.boolean(),
    desktopNotifications: v.boolean(),
    soundEnabled: v.boolean(),
    doNotDisturbStart: v.union(v.number(), v.null()),
    doNotDisturbEnd: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Look up existing preferences
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    // Return defaults if no preferences exist
    if (!prefs) {
      return DEFAULT_PREFERENCES;
    }

    // Map schema fields to response format
    // Schema uses: enablePush, enableDesktop, enableSound, dndEnabled, dndStart, dndEnd
    // defaultChannelLevel, defaultDmLevel, keywords
    return {
      mentions: prefs.defaultChannelLevel === "mentions" || prefs.defaultChannelLevel === "all",
      directMessages: prefs.defaultDmLevel === "all",
      channelMessages: prefs.defaultChannelLevel === "all",
      desktopNotifications: prefs.enableDesktop,
      soundEnabled: prefs.enableSound,
      doNotDisturbStart: prefs.dndEnabled ? timeStringToHour(prefs.dndStart) : null,
      doNotDisturbEnd: prefs.dndEnabled ? timeStringToHour(prefs.dndEnd) : null,
    };
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Update the current user's notification preferences.
 * Only updates fields that are explicitly provided.
 */
export const updatePreferences = mutation({
  args: {
    mentions: v.optional(v.boolean()),
    directMessages: v.optional(v.boolean()),
    channelMessages: v.optional(v.boolean()),
    desktopNotifications: v.optional(v.boolean()),
    soundEnabled: v.optional(v.boolean()),
    doNotDisturbStart: v.optional(v.union(v.number(), v.null())),
    doNotDisturbEnd: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate DND hours if provided
    if (args.doNotDisturbStart !== undefined) {
      validateHour(args.doNotDisturbStart, "doNotDisturbStart");
    }
    if (args.doNotDisturbEnd !== undefined) {
      validateHour(args.doNotDisturbEnd, "doNotDisturbEnd");
    }

    // Look up existing preferences
    const existingPrefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    // Build the update object based on what's provided
    // Map simplified args to schema format
    const updates: {
      enableDesktop?: boolean;
      enableSound?: boolean;
      dndEnabled?: boolean;
      dndStart?: string;
      dndEnd?: string;
      defaultChannelLevel?: "all" | "mentions" | "none";
      defaultDmLevel?: "all" | "none";
    } = {};

    // Desktop notifications
    if (args.desktopNotifications !== undefined) {
      updates.enableDesktop = args.desktopNotifications;
    }

    // Sound
    if (args.soundEnabled !== undefined) {
      updates.enableSound = args.soundEnabled;
    }

    // Do Not Disturb handling
    if (args.doNotDisturbStart !== undefined || args.doNotDisturbEnd !== undefined) {
      const currentDndStart = existingPrefs
        ? timeStringToHour(existingPrefs.dndStart)
        : null;
      const currentDndEnd = existingPrefs
        ? timeStringToHour(existingPrefs.dndEnd)
        : null;

      const newDndStart =
        args.doNotDisturbStart !== undefined ? args.doNotDisturbStart : currentDndStart;
      const newDndEnd =
        args.doNotDisturbEnd !== undefined ? args.doNotDisturbEnd : currentDndEnd;

      // DND is enabled if both start and end are set
      const dndEnabled = newDndStart !== null && newDndEnd !== null;
      updates.dndEnabled = dndEnabled;

      if (newDndStart !== null) {
        updates.dndStart = hourToTimeString(newDndStart);
      }
      if (newDndEnd !== null) {
        updates.dndEnd = hourToTimeString(newDndEnd);
      }
    }

    // Channel messages level (mentions + channelMessages combined)
    if (args.channelMessages !== undefined || args.mentions !== undefined) {
      const currentChannelLevel = existingPrefs?.defaultChannelLevel ?? "all";

      // Determine new channel level based on args
      // If channelMessages is true -> "all"
      // If channelMessages is false and mentions is true -> "mentions"
      // If both are false -> "none"
      let newChannelLevel: "all" | "mentions" | "none" = currentChannelLevel;

      if (args.channelMessages !== undefined) {
        if (args.channelMessages) {
          newChannelLevel = "all";
        } else {
          // Check mentions setting
          const mentionsEnabled =
            args.mentions !== undefined
              ? args.mentions
              : currentChannelLevel === "mentions" || currentChannelLevel === "all";
          newChannelLevel = mentionsEnabled ? "mentions" : "none";
        }
      } else if (args.mentions !== undefined) {
        // Only mentions was changed
        if (args.mentions) {
          // If mentions enabled and channels was all, keep all; otherwise mentions
          newChannelLevel = currentChannelLevel === "all" ? "all" : "mentions";
        } else {
          // Mentions disabled
          newChannelLevel = currentChannelLevel === "all" ? "all" : "none";
        }
      }

      updates.defaultChannelLevel = newChannelLevel;
    }

    // Direct messages level
    if (args.directMessages !== undefined) {
      updates.defaultDmLevel = args.directMessages ? "all" : "none";
    }

    // If no existing preferences, create new record
    if (!existingPrefs) {
      await ctx.db.insert("notificationPreferences", {
        userId: user._id,
        enablePush: true,
        enableSound: updates.enableSound ?? DEFAULT_PREFERENCES.soundEnabled,
        enableDesktop: updates.enableDesktop ?? DEFAULT_PREFERENCES.desktopNotifications,
        dndEnabled: updates.dndEnabled ?? false,
        dndStart: updates.dndStart,
        dndEnd: updates.dndEnd,
        defaultChannelLevel: updates.defaultChannelLevel ?? "all",
        defaultDmLevel: updates.defaultDmLevel ?? "all",
        keywords: [],
      });
    } else {
      // Update existing preferences
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existingPrefs._id, updates);
      }
    }

    return { success: true };
  },
});
