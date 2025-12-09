import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireAdmin } from "./lib/auth";

// ============================================================================
// Queries
// ============================================================================

/**
 * List all tags.
 * T098: Implement tags.list query
 */
export const list = query({
  args: {
    search: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("tags"),
      name: v.string(),
      courseCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    let tags = await ctx.db.query("tags").collect();

    // Filter by search if provided
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      tags = tags.filter((t) => t.name.toLowerCase().includes(searchLower));
    }

    // Get course count for each tag
    const result = await Promise.all(
      tags.map(async (tag) => {
        const courseTags = await ctx.db
          .query("courseTags")
          .withIndex("by_tag", (q) => q.eq("tagId", tag._id))
          .collect();

        return {
          _id: tag._id,
          name: tag.name,
          courseCount: courseTags.length,
        };
      })
    );

    // Sort alphabetically
    result.sort((a, b) => a.name.localeCompare(b.name));

    return result;
  },
});

/**
 * Get a single tag by ID.
 */
export const get = query({
  args: {
    tagId: v.id("tags"),
  },
  returns: v.union(
    v.object({
      _id: v.id("tags"),
      name: v.string(),
      courseCount: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const tag = await ctx.db.get(args.tagId);
    if (!tag) {
      return null;
    }

    const courseTags = await ctx.db
      .query("courseTags")
      .withIndex("by_tag", (q) => q.eq("tagId", args.tagId))
      .collect();

    return {
      _id: tag._id,
      name: tag.name,
      courseCount: courseTags.length,
    };
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new tag.
 */
export const create = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id("tags"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Check if tag already exists
    const existing = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("tags", {
      name: args.name,
    });
  },
});

/**
 * Update a tag.
 */
export const update = mutation({
  args: {
    tagId: v.id("tags"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const tag = await ctx.db.get(args.tagId);
    if (!tag) {
      throw new Error("Tag not found");
    }

    // Check if new name already exists
    const existing = await ctx.db
      .query("tags")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();

    if (existing && existing._id !== args.tagId) {
      throw new Error("Tag with this name already exists");
    }

    await ctx.db.patch(args.tagId, { name: args.name });

    return null;
  },
});

/**
 * Delete a tag.
 */
export const remove = mutation({
  args: {
    tagId: v.id("tags"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const tag = await ctx.db.get(args.tagId);
    if (!tag) {
      throw new Error("Tag not found");
    }

    // Remove all course-tag associations
    const courseTags = await ctx.db
      .query("courseTags")
      .withIndex("by_tag", (q) => q.eq("tagId", args.tagId))
      .collect();

    for (const ct of courseTags) {
      await ctx.db.delete(ct._id);
    }

    // Delete the tag
    await ctx.db.delete(args.tagId);

    return null;
  },
});
