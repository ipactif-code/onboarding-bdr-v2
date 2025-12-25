import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

/**
 * Sync missing members to an existing channel.
 *
 * For "all_teams" courses, ensures all users are members of the channel.
 * For other visibility types, syncs based on courseAssignments.
 *
 * @param ctx - Mutation context
 * @param channelId - The channel to sync members to
 * @param course - The course document (for visibility info)
 * @param creatorId - The course creator ID (to skip, already owner)
 * @returns Number of members added/reactivated
 */
export async function syncMissingChannelMembers(
  ctx: MutationCtx,
  channelId: Id<"channels">,
  course: Doc<"courses">,
  creatorId: Id<"users">
): Promise<number> {
  const now = Date.now();
  let membersAdded = 0;

  const existingMembers = await ctx.db
    .query("channelMembers")
    .withIndex("by_channel", (q) => q.eq("channelId", channelId))
    .collect();

  const memberMap = new Map<string, Doc<"channelMembers">>();
  for (const member of existingMembers) {
    memberMap.set(member.userId.toString(), member);
  }

  const targetUserIds = new Set<string>();

  if (course.visibility === "all_teams") {
    const allUsers = await ctx.db.query("users").collect();
    for (const user of allUsers) {
      targetUserIds.add(user._id.toString());
    }
  } else if (course.visibility === "specific_teams" || course.visibility === "specific_users") {
    const assignments = await ctx.db
      .query("courseAssignments")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .collect();

    for (const assignment of assignments) {
      if (assignment.userId) targetUserIds.add(assignment.userId.toString());
      if (assignment.teamId) {
        const teamMembers = await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", assignment.teamId!))
          .collect();
        for (const tm of teamMembers) {
          targetUserIds.add(tm.userId.toString());
        }
      }
    }
  }

  targetUserIds.delete(creatorId.toString());

  for (const userIdStr of targetUserIds) {
    const existing = memberMap.get(userIdStr);
    if (!existing) {
      await ctx.db.insert("channelMembers", {
        channelId,
        userId: userIdStr as Id<"users">,
        role: "member",
        joinedAt: now,
        notificationLevel: "all",
        isMuted: false,
        isBanned: false,
      });
      membersAdded++;
    } else if (existing.leftAt !== undefined) {
      await ctx.db.patch(existing._id, { leftAt: undefined, joinedAt: now });
      membersAdded++;
    }
  }

  if (membersAdded > 0) {
    const channel = await ctx.db.get(channelId);
    if (channel) {
      await ctx.db.patch(channelId, { memberCount: channel.memberCount + membersAdded });
    }
  }

  return membersAdded;
}

/**
 * T007: Enroll a newly created user in all "all_teams" course channels.
 *
 * Called when a new user is created to ensure they are automatically added
 * to all course channels that have visibility="all_teams".
 *
 * @param userId - The ID of the newly created user
 * @returns Number of channels the user was added to
 */
export const enrollUserInAllTeamsChannels = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const now = Date.now();
    let channelsEnrolled = 0;

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const allTeamsCourses = await ctx.db
      .query("courses")
      .withIndex("by_visibility", (q) => q.eq("visibility", "all_teams"))
      .collect();

    for (const course of allTeamsCourses) {
      if (course.status !== "published") continue;

      const channel = await ctx.db
        .query("channels")
        .withIndex("by_course", (q) => q.eq("courseId", course._id))
        .unique();

      if (!channel) continue;

      const existingMember = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", channel._id).eq("userId", args.userId)
        )
        .unique();

      if (!existingMember) {
        await ctx.db.insert("channelMembers", {
          channelId: channel._id,
          userId: args.userId,
          role: "member",
          joinedAt: now,
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
        await ctx.db.patch(channel._id, { memberCount: channel.memberCount + 1 });
        channelsEnrolled++;
      } else if (existingMember.leftAt !== undefined) {
        await ctx.db.patch(existingMember._id, { leftAt: undefined, joinedAt: now });
        await ctx.db.patch(channel._id, { memberCount: channel.memberCount + 1 });
        channelsEnrolled++;
      }
    }

    return channelsEnrolled;
  },
});
