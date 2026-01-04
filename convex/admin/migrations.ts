import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { parseBuffer } from "music-metadata";

// Type workaround: Use dynamic import pattern to avoid TS2589 deep type instantiation
// The internalApi variable is typed as 'any' which breaks the deep type chain
// This is necessary because Convex's internal API generates very deep types
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
const internalApi: any = require("../_generated/api").internal;

// ============================================================================
// Admin Migration Actions
// ============================================================================

/**
 * Migrate published courses to have linked channels.
 *
 * This migration action finds all published courses that don't have a channel
 * (identified by no matching channel with courseId) and:
 * 1. Creates a course channel for each one
 * 2. Adds all assigned users (from courseAssignments) to the channel
 * 3. Grants admin rights to course creators (instructors)
 *
 * Run via: npx convex run admin/migrations:migratePublishedCoursesToChannels
 */
export const migratePublishedCoursesToChannels = action({
  args: {},
  returns: v.object({
    processed: v.number(),
    created: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx): Promise<{
    processed: number;
    created: number;
    errors: string[];
  }> => {
    // Use an internal query to get all published courses without channels
    const coursesToMigrate = await ctx.runQuery(
      internalApi.admin.migrationsQueries.getPublishedCoursesWithoutChannels
    ) as Array<{ _id: Id<"courses">; title: string; creatorId: Id<"users"> }>;

    let processed = 0;
    let created = 0;
    const errors: string[] = [];

    for (const course of coursesToMigrate) {
      processed++;

      try {
        // Step 1: Create the course channel
        const channelId = await ctx.runMutation(
          internalApi.channels.courseMutations.createCourseChannel,
          {
            courseId: course._id,
            creatorId: course.creatorId,
          }
        );

        created++;

        // Step 2: Grant course creator admin rights on the channel
        await ctx.runMutation(
          internalApi.channels.courseMutations.grantCourseInstructorAdmin,
          {
            courseId: course._id,
            userId: course.creatorId,
          }
        );

        // Step 3: Get all course assignments and add users to the channel
        const enrolledUsers = await ctx.runQuery(
          internalApi.admin.migrationsQueries.getCourseEnrolledUsers,
          { courseId: course._id }
        ) as Id<"users">[];

        // Add each enrolled user to the channel
        for (const userId of enrolledUsers) {
          try {
            await ctx.runMutation(
              internalApi.channels.courseMutations.addCourseEnrollee,
              {
                courseId: course._id,
                userId: userId as Id<"users">,
              }
            );
          } catch {
            // Individual user failures shouldn't stop migration - continue silently
          }
        }

        console.warn(
          `[Migration] Migrated course "${course.title}" (${course._id}): ` +
            `created channel ${channelId}, added ${enrolledUsers.length} users`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Course ${course._id} ("${course.title}"): ${errorMsg}`);
      }
    }

    console.warn(
      `[Migration] Complete: processed ${processed} courses, created ${created} channels, ${errors.length} errors`
    );

    return {
      processed,
      created,
      errors,
    };
  },
});

/**
 * T006: Sync all users to "all_teams" course channels.
 *
 * This migration action finds all courses with visibility="all_teams" and
 * ensures ALL users in the system are members of their associated channels.
 *
 * Use this migration to:
 * - Fix missing channel memberships for newly created users
 * - Reactivate memberships for users who were previously enrolled
 * - Ensure consistent state for "all_teams" course channels
 *
 * Run via: npx convex run admin/migrations:syncAllTeamsChannelMembersMigration
 */
export const syncAllTeamsChannelMembersMigration = action({
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
    console.warn("[Migration] Starting syncAllTeamsChannelMembersMigration...");

    const result = await ctx.runMutation(
      internalApi.admin.migrationsMutations.syncAllTeamsChannelMembers
    ) as {
      coursesProcessed: number;
      channelsUpdated: number;
      membersAdded: number;
      membersReactivated: number;
      errors: string[];
    };

    console.warn(
      `[Migration] Complete: ${result.coursesProcessed} courses processed, ` +
        `${result.channelsUpdated} channels updated, ` +
        `${result.membersAdded} members added, ` +
        `${result.membersReactivated} members reactivated, ` +
        `${result.errors.length} errors`
    );

    if (result.errors.length > 0) {
      console.warn("[Migration] Errors encountered:");
      for (const error of result.errors) {
        console.warn(`[Migration]   - ${error}`);
      }
    }

    return result;
  },
});

// ============================================================================
// Voice Message Duration Migration
// ============================================================================

/**
 * Audit voice message durations and prepare data for frontend correction.
 *
 * This internal action lists all voice messages with their stored durations
 * and URLs. Since accurate audio duration detection requires browser APIs
 * (Web Audio API, WaveSurfer.js), the actual correction must be done from
 * a frontend script.
 *
 * **Workflow:**
 * 1. Run this action to get all voice messages needing audit
 * 2. Use the returned URLs in a frontend script with WaveSurfer.js
 * 3. For each audio, detect actual duration
 * 4. Call fixVoiceMessageDuration mutation for mismatches > 1 second
 *
 * Run via: npx convex run admin/migrations:auditVoiceMessageDurations
 *
 * @returns Statistics and details for all voice messages
 */
export const auditVoiceMessageDurations = internalAction({
  args: {},
  returns: v.object({
    total: v.number(),
    details: v.array(
      v.object({
        voiceMessageId: v.string(),
        messageId: v.string(),
        storageId: v.string(),
        storedDuration: v.number(),
        audioUrl: v.union(v.string(), v.null()),
        transcriptionStatus: v.string(),
      })
    ),
  }),
  handler: async (ctx): Promise<{
    total: number;
    details: Array<{
      voiceMessageId: string;
      messageId: string;
      storageId: string;
      storedDuration: number;
      audioUrl: string | null;
      transcriptionStatus: string;
    }>;
  }> => {
    console.warn("[Migration] Starting voice message duration audit...");

    // Get all voice messages
    const voiceMessages = (await ctx.runQuery(
      internalApi.admin.migrationsQueries.listVoiceMessagesForAudit,
      {}
    )) as Array<{
      _id: Id<"voiceMessages">;
      messageId: Id<"messages">;
      storageId: Id<"_storage">;
      storedDuration: number;
      transcriptionStatus: string;
    }>;

    console.warn(`[Migration] Found ${voiceMessages.length} voice messages to audit`);

    const details: Array<{
      voiceMessageId: string;
      messageId: string;
      storageId: string;
      storedDuration: number;
      audioUrl: string | null;
      transcriptionStatus: string;
    }> = [];

    // Fetch audio URLs for each voice message
    for (const vm of voiceMessages) {
      const audioUrl = (await ctx.runQuery(
        internalApi.admin.migrationsQueries.getVoiceMessageAudioUrl,
        { storageId: vm.storageId }
      )) as string | null;

      details.push({
        voiceMessageId: vm._id,
        messageId: vm.messageId,
        storageId: vm.storageId,
        storedDuration: vm.storedDuration,
        audioUrl,
        transcriptionStatus: vm.transcriptionStatus,
      });
    }

    console.warn("[Migration] Audit complete. Use frontend script to verify durations.");

    return {
      total: voiceMessages.length,
      details,
    };
  },
});

// ============================================================================
// Automated Voice Message Duration Fix
// ============================================================================

/**
 * Result detail for a single voice message processing.
 */
const voiceDurationDetailValidator = v.object({
  messageId: v.string(),
  status: v.string(),
  oldDuration: v.optional(v.number()),
  newDuration: v.optional(v.number()),
});

/**
 * Summary result for the voice duration fix migration.
 */
const voiceDurationFixResultValidator = v.object({
  total: v.number(),
  fixed: v.number(),
  skipped: v.number(),
  errors: v.number(),
  details: v.array(voiceDurationDetailValidator),
});

/**
 * Fix ALL voice message durations using server-side audio parsing.
 *
 * This internal action:
 * 1. Lists all voice messages from the database
 * 2. For each message, fetches the audio file via storage URL
 * 3. Parses the audio metadata using music-metadata to get actual duration
 * 4. Updates the database if duration differs by > 1 second
 *
 * This is idempotent - running multiple times will only update messages
 * that still have incorrect durations.
 *
 * Run via: npx convex run admin/migrations:fixAllVoiceDurations
 *
 * @returns Summary with total/fixed/skipped/errors counts and details
 */
export const fixAllVoiceDurations = internalAction({
  args: {},
  returns: voiceDurationFixResultValidator,
  handler: async (ctx): Promise<{
    total: number;
    fixed: number;
    skipped: number;
    errors: number;
    details: Array<{
      messageId: string;
      status: string;
      oldDuration?: number;
      newDuration?: number;
    }>;
  }> => {
    console.warn("[Migration] Starting fixAllVoiceDurations...");

    // 1. Get all voice messages
    const messages = (await ctx.runQuery(
      internalApi.admin.migrationsQueries.listVoiceMessagesForAudit,
      {}
    )) as Array<{
      _id: Id<"voiceMessages">;
      messageId: Id<"messages">;
      storageId: Id<"_storage">;
      storedDuration: number;
      transcriptionStatus: string;
    }>;

    console.warn(`[Migration] Found ${messages.length} voice messages to process`);

    const results: {
      total: number;
      fixed: number;
      skipped: number;
      errors: number;
      details: Array<{
        messageId: string;
        status: string;
        oldDuration?: number;
        newDuration?: number;
      }>;
    } = {
      total: messages.length,
      fixed: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    // 2. Process each message
    for (const msg of messages) {
      try {
        // Get audio URL from storage
        const url = (await ctx.runQuery(
          internalApi.admin.migrationsQueries.getVoiceMessageAudioUrl,
          { storageId: msg.storageId }
        )) as string | null;

        if (!url) {
          results.errors++;
          results.details.push({
            messageId: msg._id,
            status: "error: no URL from storage",
          });
          console.warn(`[Migration] ${msg._id}: Failed to get storage URL`);
          continue;
        }

        // Fetch audio file
        const response = await fetch(url);
        if (!response.ok) {
          results.errors++;
          results.details.push({
            messageId: msg._id,
            status: `error: fetch failed (HTTP ${response.status})`,
          });
          console.warn(`[Migration] ${msg._id}: Fetch failed with status ${response.status}`);
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Parse metadata with music-metadata (using Uint8Array - Buffer is not available in Convex runtime)
        const metadata = await parseBuffer(uint8Array);
        const actualDuration = metadata.format.duration;

        if (!actualDuration || !isFinite(actualDuration)) {
          results.skipped++;
          results.details.push({
            messageId: msg._id,
            status: "skipped: no duration in metadata",
          });
          console.warn(`[Migration] ${msg._id}: No duration found in audio metadata`);
          continue;
        }

        // Check if update needed (diff > 1 second)
        const diff = Math.abs(msg.storedDuration - actualDuration);
        if (diff <= 1) {
          results.skipped++;
          results.details.push({
            messageId: msg._id,
            status: `skipped: diff <= 1s (${diff.toFixed(2)}s)`,
            oldDuration: msg.storedDuration,
            newDuration: actualDuration,
          });
          continue;
        }

        // Update DB via mutation
        const updateResult = (await ctx.runMutation(
          internalApi.admin.migrationsMutations.fixVoiceMessageDuration,
          {
            voiceMessageId: msg._id,
            correctDuration: actualDuration,
          }
        )) as
          | { success: true; oldDuration: number; newDuration: number; diff: number }
          | { success: false; reason: string };

        if (updateResult.success) {
          results.fixed++;
          results.details.push({
            messageId: msg._id,
            status: "fixed",
            oldDuration: updateResult.oldDuration,
            newDuration: updateResult.newDuration,
          });
          console.warn(
            `[Migration] ${msg._id}: Fixed duration ${updateResult.oldDuration.toFixed(2)}s -> ${updateResult.newDuration.toFixed(2)}s`
          );
        } else {
          // Mutation returned failure (e.g., diff check failed at mutation level)
          const failureResult = updateResult as { success: false; reason: string };
          results.skipped++;
          results.details.push({
            messageId: msg._id,
            status: `skipped: ${failureResult.reason}`,
            oldDuration: msg.storedDuration,
            newDuration: actualDuration,
          });
        }
      } catch (error) {
        results.errors++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.details.push({
          messageId: msg._id,
          status: `error: ${errorMessage}`,
        });
        console.warn(`[Migration] ${msg._id}: Error - ${errorMessage}`);
      }
    }

    console.warn(
      `[Migration] Complete: ${results.fixed} fixed, ${results.skipped} skipped, ${results.errors} errors out of ${results.total} total`
    );

    return results;
  },
});
