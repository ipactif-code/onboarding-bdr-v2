import { v } from "convex/values";
import { action } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Type workaround: Use require() to avoid TS2589 deep type instantiation on 'internal'
// The actual runtime value is still the properly typed internal API, but TypeScript
// won't try to evaluate the deep FilterApi type
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const { internal } = require("../_generated/api") as { internal: any };

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
      internal.admin.migrationsQueries.getPublishedCoursesWithoutChannels
    ) as Array<{ _id: Id<"courses">; title: string; creatorId: Id<"users"> }>;

    let processed = 0;
    let created = 0;
    const errors: string[] = [];

    for (const course of coursesToMigrate) {
      processed++;

      try {
        // Step 1: Create the course channel
        const channelId = await ctx.runMutation(
          internal.channels.courseMutations.createCourseChannel,
          {
            courseId: course._id,
            creatorId: course.creatorId,
          }
        );

        created++;

        // Step 2: Grant course creator admin rights on the channel
        await ctx.runMutation(
          internal.channels.courseMutations.grantCourseInstructorAdmin,
          {
            courseId: course._id,
            userId: course.creatorId,
          }
        );

        // Step 3: Get all course assignments and add users to the channel
        const enrolledUsers = await ctx.runQuery(
          internal.admin.migrationsQueries.getCourseEnrolledUsers,
          { courseId: course._id }
        ) as Id<"users">[];

        // Add each enrolled user to the channel
        for (const userId of enrolledUsers) {
          try {
            await ctx.runMutation(
              internal.channels.courseMutations.addCourseEnrollee,
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
      internal.admin.migrationsMutations.syncAllTeamsChannelMembers
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
