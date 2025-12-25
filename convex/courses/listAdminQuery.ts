import { v } from "convex/values";
import { query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getCurrentUser } from "../lib/auth";
import { checkCourseAccess, getCoverImageUrl } from "./helpers";
import { adminCourseListItemValidator } from "./types";

// ============================================================================
// List Admin Query
// ============================================================================

/**
 * List all courses (admin view with drafts).
 * For US2 - admin course management.
 */
export const list = query({
  args: {
    status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
    tagId: v.optional(v.id("tags")),
    search: v.optional(v.string()),
  },
  returns: v.array(adminCourseListItemValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const isAdmin = user?.role === "admin";

    let courses: Doc<"courses">[];

    if (args.status) {
      courses = await ctx.db
        .query("courses")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      courses = await ctx.db.query("courses").collect();
    }

    // Non-admins only see published courses they have access to
    if (!isAdmin) {
      courses = courses.filter((c) => c.status === "published");
      if (user) {
        const accessible: Doc<"courses">[] = [];
        for (const course of courses) {
          const hasAccess = await checkCourseAccess(ctx, course._id, user);
          if (hasAccess) {
            accessible.push(course);
          }
        }
        courses = accessible;
      }
    }

    // Filter by tag
    if (args.tagId) {
      const courseTagRecords = await ctx.db
        .query("courseTags")
        .withIndex("by_tag", (q) => q.eq("tagId", args.tagId!))
        .collect();
      const courseIdsWithTag = new Set(
        courseTagRecords.map((ct) => ct.courseId.toString())
      );
      courses = courses.filter((c) => courseIdsWithTag.has(c._id.toString()));
    }

    // Search
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      courses = courses.filter(
        (c) =>
          c.title.toLowerCase().includes(searchLower) ||
          c.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by display order
    courses.sort((a, b) => a.displayOrder - b.displayOrder);

    // Build response
    const result = await Promise.all(
      courses.map(async (course) => {
        const coverImageUrl = await getCoverImageUrl(ctx, course.coverImageId);

        // Get tags
        const courseTags = await ctx.db
          .query("courseTags")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();

        const tags = await Promise.all(
          courseTags.map(async (ct) => {
            const tag = await ctx.db.get(ct.tagId);
            return tag ? { _id: tag._id, name: tag.name } : null;
          })
        );

        // Get section and lesson counts
        const sections = await ctx.db
          .query("sections")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();

        let lessonCount = 0;
        for (const section of sections) {
          const lessons = await ctx.db
            .query("lessons")
            .withIndex("by_section", (q) => q.eq("sectionId", section._id))
            .collect();
          lessonCount += lessons.length;
        }

        return {
          _id: course._id,
          title: course.title,
          description: course.description,
          coverImageUrl,
          status: course.status,
          visibility: course.visibility,
          displayOrder: course.displayOrder,
          viewCount: course.viewCount,
          sectionCount: sections.length,
          lessonCount,
          tags: tags.filter(
            (t): t is { _id: Id<"tags">; name: string } => t !== null
          ),
          publishedAt: course.publishedAt,
          _creationTime: course._creationTime,
        };
      })
    );

    return result;
  },
});
