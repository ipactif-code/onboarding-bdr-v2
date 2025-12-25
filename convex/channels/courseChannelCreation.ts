import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { syncMissingChannelMembers } from "./autoEnrollment";

// Re-export enrollUserInAllTeamsChannels for backward compatibility
export { enrollUserInAllTeamsChannels } from "./autoEnrollment";

/**
 * Slugify a course title for use as a channel name.
 */
function slugifyCourseName(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
}

/** Add a user as channel member if not already added. */
async function addChannelMember(
  ctx: MutationCtx,
  channelId: Id<"channels">,
  userId: Id<"users">,
  now: number,
  addedUserIds: Set<string>
): Promise<boolean> {
  if (addedUserIds.has(userId.toString())) return false;
  await ctx.db.insert("channelMembers", {
    channelId,
    userId,
    role: "member",
    joinedAt: now,
    notificationLevel: "all",
    isMuted: false,
    isBanned: false,
  });
  addedUserIds.add(userId.toString());
  return true;
}

/**
 * Create a course-type channel when a course is published.
 * T059: Creates a channel with type: "course" linked to the courseId.
 *
 * @param courseId - The ID of the course being published
 * @param creatorId - The ID of the course creator (becomes channel owner)
 * @returns The ID of the created channel
 */
export const createCourseChannel = internalMutation({
  args: {
    courseId: v.id("courses"),
    creatorId: v.id("users"),
  },
  returns: v.id("channels"),
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found");

    // Check if a channel already exists for this course
    const existingChannel = await ctx.db
      .query("channels")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .unique();

    if (existingChannel) {
      if (existingChannel.isArchived) {
        await ctx.db.patch(existingChannel._id, {
          isArchived: false,
          archivedAt: undefined,
          archivedBy: undefined,
        });
      }
      await syncMissingChannelMembers(ctx, existingChannel._id, course, args.creatorId);
      return existingChannel._id;
    }

    const creator = await ctx.db.get(args.creatorId);
    if (!creator) throw new Error("Creator user not found");

    const now = Date.now();
    const baseChannelName = slugifyCourseName(course.title);
    let channelName = baseChannelName || "course-channel";

    // Ensure unique channel name
    let suffix = 0;
    while (true) {
      const candidateName = suffix === 0 ? channelName : `${channelName}-${suffix}`;
      const existingByName = await ctx.db
        .query("channels")
        .withIndex("by_name", (q) => q.eq("name", candidateName))
        .unique();
      if (!existingByName) {
        channelName = candidateName;
        break;
      }
      suffix++;
    }

    // Create the channel
    const channelId = await ctx.db.insert("channels", {
      name: channelName,
      description: course.description,
      type: "course",
      courseId: args.courseId,
      creatorId: args.creatorId,
      createdAt: now,
      isArchived: false,
      memberCount: 1,
    });

    // Add creator as owner
    await ctx.db.insert("channelMembers", {
      channelId,
      userId: args.creatorId,
      role: "owner",
      joinedAt: now,
      notificationLevel: "all",
      isMuted: false,
      isBanned: false,
    });

    const addedUserIds = new Set<string>([args.creatorId.toString()]);
    let membersAdded = 0;

    if (course.visibility === "all_teams") {
      const allUsers = await ctx.db.query("users").collect();
      for (const user of allUsers) {
        if (await addChannelMember(ctx, channelId, user._id, now, addedUserIds)) {
          membersAdded++;
        }
      }
    } else if (course.visibility === "specific_teams" || course.visibility === "specific_users") {
      const assignments = await ctx.db
        .query("courseAssignments")
        .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
        .collect();

      for (const assignment of assignments) {
        if (assignment.teamId) {
          const teamMembers = await ctx.db
            .query("teamMembers")
            .withIndex("by_team", (q) => q.eq("teamId", assignment.teamId!))
            .collect();
          for (const tm of teamMembers) {
            if (await addChannelMember(ctx, channelId, tm.userId, now, addedUserIds)) {
              membersAdded++;
            }
          }
        } else if (assignment.userId) {
          if (await addChannelMember(ctx, channelId, assignment.userId, now, addedUserIds)) {
            membersAdded++;
          }
        }
      }
    }

    if (membersAdded > 0) {
      await ctx.db.patch(channelId, { memberCount: 1 + membersAdded });
    }

    return channelId;
  },
});
