import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";

// ============================================================================
// Global Search
// ============================================================================

/**
 * Search across courses, lessons, and users.
 * T206: Implement search indexing for courses, lessons, users
 */
export const globalSearch = query({
  args: {
    searchTerm: v.string(),
    types: v.optional(
      v.array(
        v.union(v.literal("courses"), v.literal("lessons"), v.literal("users"))
      )
    ),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    courses: v.array(
      v.object({
        _id: v.id("courses"),
        title: v.string(),
        description: v.optional(v.string()),
        status: v.union(v.literal("draft"), v.literal("published")),
        matchField: v.string(),
      })
    ),
    lessons: v.array(
      v.object({
        _id: v.id("lessons"),
        title: v.string(),
        description: v.optional(v.string()),
        type: v.union(
          v.literal("text"),
          v.literal("embed"),
          v.literal("quiz"),
          v.literal("files")
        ),
        courseId: v.id("courses"),
        courseTitle: v.string(),
        matchField: v.string(),
      })
    ),
    users: v.array(
      v.object({
        _id: v.id("users"),
        name: v.string(),
        email: v.string(),
        avatarUrl: v.optional(v.string()),
        role: v.union(v.literal("user"), v.literal("admin")),
        matchField: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (!args.searchTerm || args.searchTerm.length < 2) {
      return { courses: [], lessons: [], users: [] };
    }

    const searchLower = args.searchTerm.toLowerCase();
    const limit = args.limit ?? 10;
    const types = args.types ?? ["courses", "lessons", "users"];

    const result: {
      courses: Array<{
        _id: Id<"courses">;
        title: string;
        description?: string;
        status: "draft" | "published";
        matchField: string;
      }>;
      lessons: Array<{
        _id: Id<"lessons">;
        title: string;
        description?: string;
        type: "text" | "embed" | "quiz" | "files";
        courseId: Id<"courses">;
        courseTitle: string;
        matchField: string;
      }>;
      users: Array<{
        _id: Id<"users">;
        name: string;
        email: string;
        avatarUrl?: string;
        role: "user" | "admin";
        matchField: string;
      }>;
    } = {
      courses: [],
      lessons: [],
      users: [],
    };

    // Search courses
    if (types.includes("courses")) {
      const courses = await ctx.db.query("courses").collect();

      // For non-admins, only show published courses
      const filteredCourses =
        user.role === "admin"
          ? courses
          : courses.filter((c) => c.status === "published");

      for (const course of filteredCourses) {
        let matchField = "";

        if (course.title.toLowerCase().includes(searchLower)) {
          matchField = "title";
        } else if (course.description?.toLowerCase().includes(searchLower)) {
          matchField = "description";
        }

        if (matchField) {
          result.courses.push({
            _id: course._id,
            title: course.title,
            description: course.description,
            status: course.status,
            matchField,
          });

          if (result.courses.length >= limit) break;
        }
      }
    }

    // Search lessons
    if (types.includes("lessons")) {
      const lessons = await ctx.db.query("lessons").collect();

      // Get course info for each lesson
      const sectionIds = [...new Set(lessons.map((l) => l.sectionId))];
      const sections = await Promise.all(
        sectionIds.map((id) => ctx.db.get(id))
      );
      const sectionMap = new Map(
        sections.filter(Boolean).map((s) => [s!._id.toString(), s!])
      );

      const courseIds = [
        ...new Set(
          sections.filter(Boolean).map((s) => s!.courseId.toString())
        ),
      ];
      const courses = await Promise.all(
        courseIds.map((id) =>
          ctx.db
            .query("courses")
            .filter((q) => q.eq(q.field("_id"), id as never))
            .first()
        )
      );
      const courseMap = new Map(
        courses.filter(Boolean).map((c) => [c!._id.toString(), c!])
      );

      for (const lesson of lessons) {
        const section = sectionMap.get(lesson.sectionId.toString());
        if (!section) continue;

        const course = courseMap.get(section.courseId.toString());
        if (!course) continue;

        // For non-admins, only show lessons from published courses
        if (user.role !== "admin" && course.status !== "published") {
          continue;
        }

        let matchField = "";

        if (lesson.title.toLowerCase().includes(searchLower)) {
          matchField = "title";
        } else if (lesson.description?.toLowerCase().includes(searchLower)) {
          matchField = "description";
        }

        if (matchField) {
          result.lessons.push({
            _id: lesson._id,
            title: lesson.title,
            description: lesson.description,
            type: lesson.type,
            courseId: course._id,
            courseTitle: course.title,
            matchField,
          });

          if (result.lessons.length >= limit) break;
        }
      }
    }

    // Search users (admin only for full search, regular users can only search by name)
    if (types.includes("users")) {
      const users = await ctx.db.query("users").collect();

      for (const u of users) {
        let matchField = "";

        if (u.name.toLowerCase().includes(searchLower)) {
          matchField = "name";
        } else if (
          user.role === "admin" &&
          u.email.toLowerCase().includes(searchLower)
        ) {
          matchField = "email";
        }

        if (matchField) {
          result.users.push({
            _id: u._id,
            name: u.name,
            email: user.role === "admin" ? u.email : "", // Hide email for non-admins
            avatarUrl: u.avatarUrl,
            role: u.role,
            matchField,
          });

          if (result.users.length >= limit) break;
        }
      }
    }

    return result;
  },
});

/**
 * Quick search suggestions (for autocomplete).
 */
export const suggestions = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      type: v.union(
        v.literal("course"),
        v.literal("lesson"),
        v.literal("user")
      ),
      id: v.string(),
      title: v.string(),
      subtitle: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (!args.searchTerm || args.searchTerm.length < 2) {
      return [];
    }

    const searchLower = args.searchTerm.toLowerCase();
    const limit = args.limit ?? 5;

    const suggestions: Array<{
      type: "course" | "lesson" | "user";
      id: string;
      title: string;
      subtitle?: string;
    }> = [];

    // Search courses first
    const courses = await ctx.db.query("courses").collect();
    const filteredCourses =
      user.role === "admin"
        ? courses
        : courses.filter((c) => c.status === "published");

    for (const course of filteredCourses) {
      if (course.title.toLowerCase().includes(searchLower)) {
        suggestions.push({
          type: "course",
          id: course._id,
          title: course.title,
          subtitle: `Course • ${course.status}`,
        });

        if (suggestions.length >= limit) break;
      }
    }

    // Search lessons if we have room
    if (suggestions.length < limit) {
      const lessons = await ctx.db.query("lessons").collect();

      for (const lesson of lessons) {
        if (lesson.title.toLowerCase().includes(searchLower)) {
          // Get course info
          const section = await ctx.db.get(lesson.sectionId);
          if (!section) continue;

          const course = await ctx.db.get(section.courseId);
          if (!course) continue;

          // Check access
          if (user.role !== "admin" && course.status !== "published") {
            continue;
          }

          suggestions.push({
            type: "lesson",
            id: lesson._id,
            title: lesson.title,
            subtitle: `Lesson in ${course.title}`,
          });

          if (suggestions.length >= limit) break;
        }
      }
    }

    // Search users if we have room and user is admin
    if (suggestions.length < limit && user.role === "admin") {
      const users = await ctx.db.query("users").collect();

      for (const u of users) {
        if (
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
        ) {
          suggestions.push({
            type: "user",
            id: u._id,
            title: u.name,
            subtitle: u.email,
          });

          if (suggestions.length >= limit) break;
        }
      }
    }

    return suggestions;
  },
});
