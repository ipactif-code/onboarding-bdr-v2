import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import * as apiModule from "./_generated/api";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internal = (apiModule as any).internal;
import { requireAuth, requireAdmin, requireSelfOrAdmin, ensureUser } from "./lib/auth";

// ============================================================================
// Queries
// ============================================================================

/**
 * List users with filtering and pagination. Admin only.
 */
export const list = query({
  args: {
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
    teamId: v.optional(v.id("teams")),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  returns: v.object({
    data: v.array(
      v.object({
        _id: v.id("users"),
        clerkId: v.string(),
        email: v.string(),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
        role: v.union(v.literal("user"), v.literal("admin")),
        status: v.union(v.literal("online"), v.literal("offline"), v.literal("away"), v.literal("dnd")),
        lastActiveAt: v.optional(v.number()),
        teamCount: v.number(),
        overallProgress: v.number(),
      })
    ),
    meta: v.object({
      page: v.number(),
      pageSize: v.number(),
      totalItems: v.number(),
      totalPages: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const page = args.page ?? 1;
    const pageSize = args.pageSize ?? 20;

    // Get all users (we'll filter in memory for now)
    let users = await ctx.db.query("users").collect();

    // Filter by role
    if (args.role) {
      users = users.filter((u) => u.role === args.role);
    }

    // Filter by team
    if (args.teamId) {
      const teamId = args.teamId;
      const teamMemberships = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect();
      const teamUserIds = new Set(teamMemberships.map((m) => m.userId.toString()));
      users = users.filter((u) => teamUserIds.has(u._id.toString()));
    }

    // Search by name or email
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
      );
    }

    const totalItems = users.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedUsers = users.slice(startIndex, startIndex + pageSize);

    // Preload all data for optimized progress calculation
    const allSections = await ctx.db.query("sections").collect();
    const allLessons = await ctx.db.query("lessons").collect();

    // Create Map: sectionId -> courseId
    const sectionToCourse = new Map<string, Id<"courses">>();
    for (const section of allSections) {
      sectionToCourse.set(section._id.toString(), section.courseId);
    }

    // Create Map: courseId -> lesson count
    const courseLessonCount = new Map<string, number>();
    for (const lesson of allLessons) {
      const courseId = sectionToCourse.get(lesson.sectionId.toString());
      if (courseId) {
        const key = courseId.toString();
        courseLessonCount.set(key, (courseLessonCount.get(key) ?? 0) + 1);
      }
    }

    // Create Map: lessonId -> courseId (for finding user's enrolled courses)
    const lessonToCourse = new Map<string, Id<"courses">>();
    for (const lesson of allLessons) {
      const courseId = sectionToCourse.get(lesson.sectionId.toString());
      if (courseId) {
        lessonToCourse.set(lesson._id.toString(), courseId);
      }
    }

    // Get team counts and progress for each user
    const data = await Promise.all(
      paginatedUsers.map(async (user) => {
        const teamMemberships = await ctx.db
          .query("teamMembers")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

        // Calculate overall progress correctly
        const progress = await ctx.db
          .query("progress")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

        // Find unique courses the user has progress in
        const userCourseIds = new Set<string>();
        for (const p of progress) {
          const courseId = lessonToCourse.get(p.lessonId.toString());
          if (courseId) {
            userCourseIds.add(courseId.toString());
          }
        }

        // Sum total lessons across enrolled courses
        let totalLessons = 0;
        for (const courseId of userCourseIds) {
          totalLessons += courseLessonCount.get(courseId) ?? 0;
        }

        const completedLessons = progress.filter((p) => p.status === "completed").length;
        const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        return {
          _id: user._id,
          clerkId: user.clerkId,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          status: user.status,
          lastActiveAt: user.lastActiveAt,
          teamCount: teamMemberships.length,
          overallProgress,
        };
      })
    );

    return {
      data,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  },
});

/**
 * Get user details by ID.
 */
export const get = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("admin")),
      status: v.union(v.literal("online"), v.literal("offline"), v.literal("away"), v.literal("dnd")),
      lastActiveAt: v.optional(v.number()),
      teams: v.array(
        v.object({
          _id: v.id("teams"),
          name: v.string(),
          isLead: v.boolean(),
        })
      ),
      stats: v.object({
        coursesCompleted: v.number(),
        coursesInProgress: v.number(),
        overallProgress: v.number(),
        totalTimeSpent: v.number(),
      }),
      _creationTime: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireSelfOrAdmin(ctx, args.userId);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    // Get team memberships
    const teamMemberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const teams = await Promise.all(
      teamMemberships.map(async (membership) => {
        const team = await ctx.db.get(membership.teamId);
        return {
          _id: membership.teamId,
          name: team?.name ?? "Unknown Team",
          isLead: team?.leadId === user._id,
        };
      })
    );

    // Get progress stats
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const coursesCompleted = progress.filter((p) => p.status === "completed").length;
    const coursesInProgress = progress.filter((p) => p.status === "in_progress").length;
    const totalTimeSpent = progress.reduce((sum, p) => sum + p.timeSpent, 0);

    // Calculate overall progress correctly
    // Find unique courses the user has progress in
    const userCourseIds = new Set<Id<"courses">>();
    for (const p of progress) {
      const lesson = await ctx.db.get(p.lessonId);
      if (lesson) {
        const section = await ctx.db.get(lesson.sectionId);
        if (section) {
          userCourseIds.add(section.courseId);
        }
      }
    }

    // Sum total lessons across enrolled courses
    let totalLessons = 0;
    for (const courseId of userCourseIds) {
      const sections = await ctx.db
        .query("sections")
        .withIndex("by_course", (q) => q.eq("courseId", courseId))
        .collect();

      for (const section of sections) {
        const lessons = await ctx.db
          .query("lessons")
          .withIndex("by_section", (q) => q.eq("sectionId", section._id))
          .collect();
        totalLessons += lessons.length;
      }
    }

    const completedLessons = progress.filter((p) => p.status === "completed").length;
    const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      lastActiveAt: user.lastActiveAt,
      teams,
      stats: {
        coursesCompleted,
        coursesInProgress,
        overallProgress,
        totalTimeSpent,
      },
      _creationTime: user._creationTime,
    };
  },
});

/**
 * Get user by Clerk ID.
 */
export const getByClerkId = query({
  args: {
    clerkId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      clerkId: v.string(),
      email: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("admin")),
      status: v.union(v.literal("online"), v.literal("offline"), v.literal("away"), v.literal("dnd")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
    };
  },
});

/**
 * Get the current authenticated user.
 */
export const me = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      clerkId: v.string(),
      email: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("admin")),
      status: v.union(v.literal("online"), v.literal("offline"), v.literal("away"), v.literal("dnd")),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
    };
  },
});

/**
 * Search users for mentions and messaging.
 */
export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("admin")),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    if (args.query.length < 2) {
      return [];
    }

    const limit = args.limit ?? 10;
    const searchLower = args.query.toLowerCase();

    const users = await ctx.db.query("users").collect();
    const filtered = users
      .filter(
        (u) =>
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
      )
      .slice(0, limit);

    return filtered.map((u) => ({
      _id: u._id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      role: u.role,
    }));
  },
});

/**
 * Get list of online users for presence display.
 */
export const getOnlineUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      status: v.union(v.literal("online"), v.literal("offline"), v.literal("away"), v.literal("dnd")),
      lastActiveAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    await requireAuth(ctx);

    const users = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "online"))
      .collect();

    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      status: u.status,
      lastActiveAt: u.lastActiveAt,
    }));
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Update user profile.
 */
export const update = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSelfOrAdmin(ctx, args.userId);

    const updateFields: { name?: string; avatarUrl?: string } = {};

    if (args.name !== undefined) {
      if (args.name.length < 2) {
        throw new Error("Name must be at least 2 characters");
      }
      updateFields.name = args.name;
    }

    if (args.avatarUrl !== undefined) {
      updateFields.avatarUrl = args.avatarUrl;
    }

    if (Object.keys(updateFields).length > 0) {
      await ctx.db.patch(args.userId, updateFields);
    }

    return null;
  },
});

/**
 * Update user role. Admin only.
 */
export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.userId, { role: args.role });
    return null;
  },
});

/**
 * Update user presence status.
 */
export const updateStatus = mutation({
  args: {
    status: v.union(v.literal("online"), v.literal("offline"), v.literal("away"), v.literal("dnd")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await ctx.db.patch(user._id, {
      status: args.status,
      lastActiveAt: Date.now(),
    });
    return null;
  },
});

/**
 * Remove user from system. Admin only.
 */
export const remove = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Remove team memberships
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    // Delete the user (progress history is preserved)
    await ctx.db.delete(args.userId);

    return null;
  },
});

/**
 * Invite a user to the platform. Admin only.
 * This would typically integrate with Clerk's invitation API.
 */
export const invite = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
    teamIds: v.optional(v.array(v.id("teams"))),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existingUser) {
      return {
        success: false,
        message: "A user with this email already exists",
      };
    }

    // In a real implementation, we would call Clerk's invitation API here
    // For now, we just return success (Clerk handles the actual invitation)
    // The user will be created when they accept the invitation via webhook

    return {
      success: true,
      message: `Invitation sent to ${args.email}`,
    };
  },
});

/**
 * Ensure the current user exists in the database.
 * Call this when the app loads to create the user if they don't exist.
 * This handles the case where the Clerk webhook hasn't fired yet.
 */
export const ensureCurrentUser = mutation({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("admin")),
      status: v.union(v.literal("online"), v.literal("offline"), v.literal("away"), v.literal("dnd")),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
    };
  },
});

/**
 * Server-side user creation (called from Next.js Server Components).
 * This is used when a user is authenticated via Clerk but not yet in Convex.
 * Unlike ensureCurrentUser, this doesn't require Convex auth context.
 *
 * T008: After creating a new user, enrolls them in all "all_teams" course channels.
 */
export const createFromClerk = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existingUser) {
      return existingUser._id;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      role: "user",
      status: "online",
      lastActiveAt: Date.now(),
    });

    // T008: Enroll new user in all "all_teams" course channels
    await ctx.scheduler.runAfter(
      0,
      internal.channels.courseChannelCreation.enrollUserInAllTeamsChannels,
      { userId }
    );

    return userId;
  },
});

// ============================================================================
// Internal Queries (called from other server functions)
// ============================================================================

/**
 * Get user by Clerk ID (internal - no auth check).
 * Used by actions that need to look up users by their Clerk identity.
 */
export const getByClerkIdInternal = internalQuery({
  args: { clerkId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      clerkId: v.string(),
      email: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("admin")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) return null;

    return {
      _id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  },
});

// ============================================================================
// Internal Mutations (called from webhooks)
// ============================================================================

/**
 * Sync user from Clerk webhook. Creates or updates user.
 *
 * T008: When creating a new user, schedules enrollment in all "all_teams" course channels.
 */
export const syncFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
      });
      return existing._id;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      role: "user",
      status: "offline",
    });

    // T008: Enroll new user in all "all_teams" course channels
    await ctx.scheduler.runAfter(
      0,
      internal.channels.courseChannelCreation.enrollUserInAllTeamsChannels,
      { userId }
    );

    return userId;
  },
});

/**
 * Remove user by Clerk ID (called when user is deleted from Clerk).
 */
export const removeByClerkId = internalMutation({
  args: {
    clerkId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (user) {
      // Clean up team memberships
      const memberships = await ctx.db
        .query("teamMembers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      for (const membership of memberships) {
        await ctx.db.delete(membership._id);
      }

      await ctx.db.delete(user._id);
    }

    return null;
  },
});
