import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";

// ============================================================================
// Course Create/Update Mutations
// ============================================================================

/**
 * Create a new draft course.
 * T070: Implement courses.create mutation
 */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("courses"),
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    // Validate title
    if (args.title.length < 3 || args.title.length > 200) {
      throw new Error("Title must be between 3 and 200 characters");
    }

    // Validate description
    if (args.description && args.description.length > 2000) {
      throw new Error("Description must be at most 2000 characters");
    }

    // Get next display order
    const allCourses = await ctx.db.query("courses").collect();
    const maxOrder = allCourses.reduce(
      (max, c) => Math.max(max, c.displayOrder),
      0
    );

    return await ctx.db.insert("courses", {
      title: args.title,
      description: args.description,
      creatorId: user._id,
      status: "draft",
      visibility: "all_teams",
      displayOrder: maxOrder + 1,
      viewCount: 0,
    });
  },
});

/**
 * Update course details.
 * T071: Implement courses.update mutation
 */
export const update = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(
      v.union(
        v.literal("all_teams"),
        v.literal("specific_teams"),
        v.literal("specific_users")
      )
    ),
    displayOrder: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    const updates: Partial<Doc<"courses">> = {};

    if (args.title !== undefined) {
      if (args.title.length < 3 || args.title.length > 200) {
        throw new Error("Title must be between 3 and 200 characters");
      }
      updates.title = args.title;
    }

    if (args.description !== undefined) {
      if (args.description.length > 2000) {
        throw new Error("Description must be at most 2000 characters");
      }
      updates.description = args.description;
    }

    if (args.visibility !== undefined) {
      updates.visibility = args.visibility;
    }

    if (args.displayOrder !== undefined) {
      updates.displayOrder = args.displayOrder;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.courseId, updates);
    }

    return null;
  },
});

/**
 * Set course cover image.
 * T072: Implement courses.setCoverImage mutation
 */
export const setCoverImage = mutation({
  args: {
    courseId: v.id("courses"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Delete old cover image if exists
    if (course.coverImageId) {
      await ctx.storage.delete(course.coverImageId);
    }

    await ctx.db.patch(args.courseId, {
      coverImageId: args.storageId,
    });

    return null;
  },
});
