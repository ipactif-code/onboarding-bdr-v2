import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuth, requireAdmin } from "./lib/auth";

// ============================================================================
// Queries
// ============================================================================

/**
 * List all teams with member count.
 * T118: Implement teams.list query
 */
export const list = query({
  args: {
    search: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      name: v.string(),
      description: v.optional(v.string()),
      leadId: v.optional(v.id("users")),
      leadName: v.optional(v.string()),
      memberCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    let teams = await ctx.db.query("teams").collect();

    // Filter by search if provided
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      teams = teams.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower)
      );
    }

    // Get member count and lead info for each team
    const result = await Promise.all(
      teams.map(async (team) => {
        const members = await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .collect();

        let leadName: string | undefined;
        if (team.leadId) {
          const lead = await ctx.db.get(team.leadId);
          leadName = lead?.name;
        }

        return {
          _id: team._id,
          name: team.name,
          description: team.description,
          leadId: team.leadId,
          leadName,
          memberCount: members.length,
        };
      })
    );

    // Sort alphabetically by name
    result.sort((a, b) => a.name.localeCompare(b.name));

    return result;
  },
});

/**
 * Get a single team by ID with full details.
 * T119: Implement teams.get query
 */
export const get = query({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.union(
    v.object({
      _id: v.id("teams"),
      name: v.string(),
      description: v.optional(v.string()),
      leadId: v.optional(v.id("users")),
      lead: v.optional(
        v.object({
          _id: v.id("users"),
          name: v.string(),
          email: v.string(),
          avatarUrl: v.optional(v.string()),
        })
      ),
      memberCount: v.number(),
      assignedCourseCount: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return null;
    }

    // Get member count
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    // Get lead info
    let lead: {
      _id: Id<"users">;
      name: string;
      email: string;
      avatarUrl?: string;
    } | undefined;

    if (team.leadId) {
      const leadUser = await ctx.db.get(team.leadId);
      if (leadUser) {
        lead = {
          _id: leadUser._id,
          name: leadUser.name,
          email: leadUser.email,
          avatarUrl: leadUser.avatarUrl,
        };
      }
    }

    // Get assigned course count
    const assignments = await ctx.db
      .query("courseAssignments")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    return {
      _id: team._id,
      name: team.name,
      description: team.description,
      leadId: team.leadId,
      lead,
      memberCount: members.length,
      assignedCourseCount: assignments.length,
    };
  },
});

/**
 * Get teams for a specific user.
 * T120: Implement teams.getForUser query
 */
export const getForUser = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      name: v.string(),
      description: v.optional(v.string()),
      isLead: v.boolean(),
      joinedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const targetUserId = args.userId ?? user._id;

    // Get all team memberships for the user
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .collect();

    // Get team details for each membership
    const result = await Promise.all(
      memberships.map(async (membership) => {
        const team = await ctx.db.get(membership.teamId);
        if (!team) {
          return null;
        }

        return {
          _id: team._id,
          name: team.name,
          description: team.description,
          isLead: team.leadId === targetUserId,
          joinedAt: membership.joinedAt,
        };
      })
    );

    // Filter out null values and sort by name
    return result
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Get all members of a team.
 * T121: Implement teams.getMembers query
 */
export const getMembers = query({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("admin")),
      status: v.union(
        v.literal("online"),
        v.literal("offline"),
        v.literal("away")
      ),
      isLead: v.boolean(),
      joinedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return [];
    }

    // Get all memberships
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    // Get user details for each membership
    const result = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        if (!user) {
          return null;
        }

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: user.role,
          status: user.status,
          isLead: team.leadId === user._id,
          joinedAt: membership.joinedAt,
        };
      })
    );

    // Filter out null values and sort (lead first, then alphabetically)
    return result
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => {
        if (a.isLead && !b.isLead) return -1;
        if (!a.isLead && b.isLead) return 1;
        return a.name.localeCompare(b.name);
      });
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new team.
 * T122: Implement teams.create mutation
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    leadId: v.optional(v.id("users")),
  },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Validate name
    if (args.name.length < 2 || args.name.length > 100) {
      throw new Error("Team name must be between 2 and 100 characters");
    }

    // Check if team name already exists
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();

    if (existing) {
      throw new Error("A team with this name already exists");
    }

    // Validate lead if provided
    if (args.leadId) {
      const lead = await ctx.db.get(args.leadId);
      if (!lead) {
        throw new Error("Lead user not found");
      }
    }

    // Create the team
    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      description: args.description,
      leadId: args.leadId,
    });

    // If lead is specified, add them as a member
    if (args.leadId) {
      await ctx.db.insert("teamMembers", {
        teamId,
        userId: args.leadId,
        joinedAt: Date.now(),
      });
    }

    return teamId;
  },
});

/**
 * Update team details.
 * T123: Implement teams.update mutation
 */
export const update = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const updates: { name?: string; description?: string } = {};

    if (args.name !== undefined) {
      const name = args.name;
      if (name.length < 2 || name.length > 100) {
        throw new Error("Team name must be between 2 and 100 characters");
      }

      // Check if new name already exists (excluding current team)
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();

      if (existing && existing._id !== args.teamId) {
        throw new Error("A team with this name already exists");
      }

      updates.name = name;
    }

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.teamId, updates);
    }

    return null;
  },
});

/**
 * Delete a team.
 * T124: Implement teams.remove mutation
 */
export const remove = mutation({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Remove all team members
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Remove all course assignments for this team
    const assignments = await ctx.db
      .query("courseAssignments")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    // Delete the team
    await ctx.db.delete(args.teamId);

    return null;
  },
});

/**
 * Add a member to a team.
 * T125: Implement teams.addMember mutation
 */
export const addMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user is already a member
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_user_team", (q) =>
        q.eq("userId", args.userId).eq("teamId", args.teamId)
      )
      .unique();

    if (existing) {
      // User is already a member, no-op
      return null;
    }

    await ctx.db.insert("teamMembers", {
      teamId: args.teamId,
      userId: args.userId,
      joinedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Remove a member from a team.
 * T126: Implement teams.removeMember mutation
 */
export const removeMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Find membership
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_user_team", (q) =>
        q.eq("userId", args.userId).eq("teamId", args.teamId)
      )
      .unique();

    if (!membership) {
      // User is not a member, no-op
      return null;
    }

    // Remove membership
    await ctx.db.delete(membership._id);

    // If the removed user was the lead, clear the lead
    if (team.leadId === args.userId) {
      await ctx.db.patch(args.teamId, { leadId: undefined });
    }

    return null;
  },
});

/**
 * Add multiple members to a team (bulk operation).
 * T127: Implement teams.addMembers (bulk) mutation
 */
export const addMembers = mutation({
  args: {
    teamId: v.id("teams"),
    userIds: v.array(v.id("users")),
  },
  returns: v.object({
    added: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    let added = 0;
    let skipped = 0;

    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);
      if (!user) {
        skipped++;
        continue;
      }

      // Check if user is already a member
      const existing = await ctx.db
        .query("teamMembers")
        .withIndex("by_user_team", (q) =>
          q.eq("userId", userId).eq("teamId", args.teamId)
        )
        .unique();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("teamMembers", {
        teamId: args.teamId,
        userId,
        joinedAt: Date.now(),
      });

      added++;
    }

    return { added, skipped };
  },
});

/**
 * Set or change the team lead.
 * T128: Implement teams.setLead mutation
 */
export const setLead = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    if (args.userId) {
      const userId = args.userId;
      // Validate user exists
      const user = await ctx.db.get(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Check if user is a member of the team
      const membership = await ctx.db
        .query("teamMembers")
        .withIndex("by_user_team", (q) =>
          q.eq("userId", userId).eq("teamId", args.teamId)
        )
        .unique();

      // If not a member, add them
      if (!membership) {
        await ctx.db.insert("teamMembers", {
          teamId: args.teamId,
          userId: userId,
          joinedAt: Date.now(),
        });
      }
    }

    // Update the lead
    await ctx.db.patch(args.teamId, { leadId: args.userId });

    return null;
  },
});
