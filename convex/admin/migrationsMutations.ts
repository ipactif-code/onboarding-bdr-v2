import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// ============================================================================
// Voice Message Duration Migration - Result Validators
// ============================================================================

/**
 * Result validator for the fixVoiceMessageDuration mutation.
 */
const fixVoiceMessageDurationResultValidator = v.union(
  v.object({
    success: v.literal(true),
    oldDuration: v.number(),
    newDuration: v.number(),
    diff: v.number(),
  }),
  v.object({
    success: v.literal(false),
    reason: v.string(),
  })
);

// ============================================================================
// Migration Helper Internal Mutations
// ============================================================================
// These internal mutations support the migration actions.
// No auth checks needed - internal only.
// ============================================================================

/**
 * T005: Sync all users to "all_teams" course channels.
 *
 * This internal mutation finds all courses with visibility="all_teams",
 * finds their associated channels, and ensures ALL users are members.
 *
 * For each user NOT already a member (or who has leftAt set), it:
 * - Adds them as a member if they don't exist
 * - Clears leftAt if they previously left
 * - Updates memberCount on the channel
 *
 * @returns Statistics about the sync operation
 */
export const syncAllTeamsChannelMembers = internalMutation({
  args: {},
  returns: v.object({
    coursesProcessed: v.number(),
    channelsUpdated: v.number(),
    membersAdded: v.number(),
    membersReactivated: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx): Promise<{
    coursesProcessed: number;
    channelsUpdated: number;
    membersAdded: number;
    membersReactivated: number;
    errors: string[];
  }> => {
    const now = Date.now();
    let coursesProcessed = 0;
    let channelsUpdated = 0;
    let membersAdded = 0;
    let membersReactivated = 0;
    const errors: string[] = [];

    // Get all "all_teams" courses
    const allTeamsCourses = await ctx.db
      .query("courses")
      .withIndex("by_visibility", (q) => q.eq("visibility", "all_teams"))
      .collect();

    // Get ALL users in the system
    const allUsers = await ctx.db.query("users").collect();
    const allUserIds = new Set(allUsers.map((u) => u._id.toString()));

    for (const course of allTeamsCourses) {
      coursesProcessed++;

      // Only process published courses (they should have channels)
      if (course.status !== "published") {
        continue;
      }

      try {
        // Find the course channel
        const channel = await ctx.db
          .query("channels")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .unique();

        if (!channel) {
          errors.push(
            `Course "${course.title}" (${course._id}): No channel found for published course`
          );
          continue;
        }

        // Get all existing channel members
        const existingMembers = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
          .collect();

        // Build a map of userId -> member record
        const memberMap = new Map<string, Doc<"channelMembers">>();
        for (const member of existingMembers) {
          memberMap.set(member.userId.toString(), member);
        }

        let channelMembersAdded = 0;
        let channelMembersReactivated = 0;

        // Sync each user
        for (const userId of allUserIds) {
          const existing = memberMap.get(userId);

          if (!existing) {
            // User not in channel - add them
            await ctx.db.insert("channelMembers", {
              channelId: channel._id,
              userId: userId as Id<"users">,
              role: "member",
              joinedAt: now,
              notificationLevel: "all",
              isMuted: false,
              isBanned: false,
            });
            channelMembersAdded++;
            membersAdded++;
          } else if (existing.leftAt !== undefined) {
            // User left previously - reactivate membership
            await ctx.db.patch(existing._id, {
              leftAt: undefined,
              joinedAt: now,
            });
            channelMembersReactivated++;
            membersReactivated++;
          }
          // else: User is already an active member, skip
        }

        // Update member count if we added/reactivated any members
        const totalNewMembers = channelMembersAdded + channelMembersReactivated;
        if (totalNewMembers > 0) {
          await ctx.db.patch(channel._id, {
            memberCount: channel.memberCount + totalNewMembers,
          });
          channelsUpdated++;

          console.log(
            `Synced channel "${channel.name}" for course "${course.title}": ` +
              `added ${channelMembersAdded}, reactivated ${channelMembersReactivated}`
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Course "${course.title}" (${course._id}): ${errorMsg}`);
        console.error(`Error syncing course ${course._id}:`, error);
      }
    }

    console.log(
      `Sync complete: ${coursesProcessed} courses processed, ` +
        `${channelsUpdated} channels updated, ` +
        `${membersAdded} members added, ` +
        `${membersReactivated} members reactivated, ` +
        `${errors.length} errors`
    );

    return {
      coursesProcessed,
      channelsUpdated,
      membersAdded,
      membersReactivated,
      errors,
    };
  },
});

// ============================================================================
// Voice Message Duration Migration Mutations
// ============================================================================

/**
 * Fix the duration of a single voice message.
 *
 * Called by frontend migration scripts after detecting the actual duration
 * using WaveSurfer.js or similar audio library. Only updates if the
 * difference exceeds the threshold (1 second).
 *
 * This mutation is idempotent - running it multiple times with the same
 * correct duration will not cause additional database writes.
 *
 * @param voiceMessageId - The ID of the voice message record to update
 * @param correctDuration - The actual duration detected by the frontend (in seconds)
 * @returns Success status with old/new duration, or failure reason
 */
export const fixVoiceMessageDuration = internalMutation({
  args: {
    // Accept as string to allow flexible lookup (voiceMessages._id or messages._id)
    voiceMessageId: v.string(),
    correctDuration: v.number(),
  },
  returns: fixVoiceMessageDurationResultValidator,
  handler: async (
    ctx,
    args
  ): Promise<
    | { success: true; oldDuration: number; newDuration: number; diff: number }
    | { success: false; reason: string }
  > => {
    // Validate correctDuration is positive
    if (args.correctDuration <= 0) {
      return {
        success: false,
        reason: `Invalid duration: ${args.correctDuration} (must be positive)`,
      };
    }

    // Try multiple lookup strategies to find the voice message
    console.log(
      `[internal:fixVoiceMessageDuration] Looking up voice message: ${args.voiceMessageId}`
    );

    let voiceMessage: Doc<"voiceMessages"> | null = null;

    // Strategy 1: Try as a voiceMessages._id
    try {
      const voiceMessageId = args.voiceMessageId as Id<"voiceMessages">;
      voiceMessage = await ctx.db.get(voiceMessageId);
      if (voiceMessage) {
        console.log(
          `[internal:fixVoiceMessageDuration] Found by voiceMessages._id (duration: ${voiceMessage.duration})`
        );
      }
    } catch {
      // Not a valid voiceMessages ID, try next strategy
    }

    // Strategy 2: Try as a messages._id and find the linked voiceMessage
    if (!voiceMessage) {
      try {
        const messageId = args.voiceMessageId as Id<"messages">;
        voiceMessage = await ctx.db
          .query("voiceMessages")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .unique();
        if (voiceMessage) {
          console.log(
            `[internal:fixVoiceMessageDuration] Found by messages._id lookup (duration: ${voiceMessage.duration})`
          );
        }
      } catch {
        // Not a valid messages ID either
      }
    }

    if (!voiceMessage) {
      console.log(`[internal:fixVoiceMessageDuration] NOT FOUND`);
      return {
        success: false,
        reason: `Voice message not found (id: ${args.voiceMessageId})`,
      };
    }

    const oldDuration = voiceMessage.duration;
    const diff = Math.abs(oldDuration - args.correctDuration);

    // Only update if difference > 1 second (threshold for meaningful change)
    if (diff <= 1) {
      return {
        success: false,
        reason: `Duration difference <= 1s (diff: ${diff.toFixed(2)}s), skipping`,
      };
    }

    // Update the duration in the voiceMessages table
    await ctx.db.patch(voiceMessage._id, {
      duration: args.correctDuration,
    });

    console.warn(
      `[Migration] Fixed voice message ${voiceMessage._id}: ` +
        `${oldDuration.toFixed(2)}s -> ${args.correctDuration.toFixed(2)}s (diff: ${diff.toFixed(2)}s)`
    );

    return {
      success: true,
      oldDuration,
      newDuration: args.correctDuration,
      diff,
    };
  },
});
