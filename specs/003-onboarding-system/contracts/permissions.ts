/**
 * API Contracts: Team Leader Role & Permissions
 *
 * Management of team_leader role and permission checking.
 */

import { v } from "convex/values";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Check if current user has Team Leader role for a specific team.
 */
export const isTeamLeaderOf = {
  args: {
    teamId: v.id("teams"),
  },
  returns: v.boolean(),
};

/**
 * Get teams where current user is a Team Leader.
 */
export const getTeamsAsLeader = {
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      name: v.string(),
      memberCount: v.number(),
    })
  ),
};

/**
 * Check if current user can assign a track to a specific user.
 *
 * Returns true if:
 * - Current user is admin, OR
 * - Current user is TL of a team that contains the target user
 */
export const canAssignToUser = {
  args: {
    userId: v.id("users"),
  },
  returns: v.boolean(),
};

/**
 * Check if current user can validate tasks for a specific user.
 *
 * Same rules as canAssignToUser.
 */
export const canValidateForUser = {
  args: {
    userId: v.id("users"),
  },
  returns: v.boolean(),
};

/**
 * Get assignable users for current user.
 *
 * Admins get all users. TLs get their team members only.
 */
export const getAssignableUsers = {
  args: {
    search: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      avatarUrl: v.optional(v.string()),
      teams: v.array(
        v.object({
          _id: v.id("teams"),
          name: v.string(),
        })
      ),
      hasActiveTrack: v.boolean(),
    })
  ),
};

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Promote a team member to Team Leader.
 *
 * Admin only.
 */
export const promoteToTeamLeader = {
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  returns: v.null(),
};

/**
 * Demote a Team Leader to regular member.
 *
 * Admin only.
 */
export const demoteFromTeamLeader = {
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  returns: v.null(),
};

/**
 * Get team members with their roles.
 *
 * Extended version of teams.getMembers with role info.
 */
export const getTeamMembersWithRoles = {
  args: {
    teamId: v.id("teams"),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.union(v.literal("member"), v.literal("leader")),
      joinedAt: v.number(),
      activeTrackCount: v.number(),
    })
  ),
};
