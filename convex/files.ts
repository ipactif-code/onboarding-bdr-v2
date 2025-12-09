import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth, requireAdmin } from "./lib/auth";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user has access to a lesson's course.
 */
async function checkLessonAccess(
  ctx: { db: { get: (id: Id<"lessons"> | Id<"sections"> | Id<"courses">) => Promise<Doc<"lessons"> | Doc<"sections"> | Doc<"courses"> | null>; query: (table: string) => unknown } },
  lessonId: Id<"lessons">,
  user: Doc<"users">
): Promise<boolean> {
  const lesson = await ctx.db.get(lessonId);
  if (!lesson) return false;

  const section = await ctx.db.get((lesson as Doc<"lessons">).sectionId);
  if (!section) return false;

  const course = await ctx.db.get((section as Doc<"sections">).courseId);
  if (!course) return false;

  const courseDoc = course as Doc<"courses">;

  // Admins can access all
  if (user.role === "admin") return true;

  // Only published courses for regular users
  if (courseDoc.status !== "published") return false;

  // All teams visibility
  if (courseDoc.visibility === "all_teams") return true;

  // Check specific assignments
  const db = ctx.db as unknown as {
    query: (table: "courseAssignments" | "teamMembers") => {
      withIndex: (
        name: string,
        fn: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
      ) => { collect: () => Promise<Doc<"courseAssignments">[] | Doc<"teamMembers">[]> };
    };
  };

  const assignments = (await db
    .query("courseAssignments")
    .withIndex("by_course", (q) => q.eq("courseId", courseDoc._id))
    .collect()) as Doc<"courseAssignments">[];

  // Direct user assignment
  if (assignments.some((a) => a.userId === user._id)) {
    return true;
  }

  // Team assignment
  const userTeams = (await db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect()) as Doc<"teamMembers">[];

  const userTeamIds = new Set(userTeams.map((t) => t.teamId.toString()));

  return assignments.some(
    (a) => a.teamId && userTeamIds.has(a.teamId.toString())
  );
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all file attachments for a lesson.
 * T048: Implement files.listForLesson query
 */
export const listForLesson = query({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.array(
    v.object({
      _id: v.id("files"),
      storageId: v.id("_storage"),
      fileName: v.string(),
      fileSize: v.number(),
      fileType: v.string(),
      downloadUrl: v.string(),
      uploadedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check access
    const hasAccess = await checkLessonAccess(ctx, args.lessonId, user);
    if (!hasAccess) {
      return [];
    }

    // Get lesson to verify it's a files type
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson || lesson.type !== "files") {
      return [];
    }

    // Get files
    const files = await ctx.db
      .query("files")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .collect();

    // Get download URLs for each file
    const result = await Promise.all(
      files.map(async (file) => {
        const downloadUrl = await ctx.storage.getUrl(file.storageId);
        return {
          _id: file._id,
          storageId: file.storageId,
          fileName: file.fileName,
          fileSize: file.fileSize,
          fileType: file.fileType,
          downloadUrl: downloadUrl ?? "",
          uploadedAt: file.uploadedAt,
        };
      })
    );

    return result;
  },
});

/**
 * Get public URL for a stored file.
 * T049: Implement files.getUrl query
 */
export const getUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.optional(v.string()),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});

// ============================================================================
// Mutations (for Phase 4: US2)
// ============================================================================

/**
 * Generate a presigned URL for file upload.
 * T094: Implement files.getUploadUrl mutation
 */
export const getUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Allowed file types for attachments
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/zip",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Save file attachment metadata after upload.
 * T095: Implement files.saveAttachment mutation
 */
export const saveAttachment = mutation({
  args: {
    lessonId: v.id("lessons"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Validate file size
    if (args.fileSize > MAX_FILE_SIZE) {
      throw new Error("File too large (max 50MB)");
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(args.fileType)) {
      throw new Error(
        "File type not allowed. Allowed types: pdf, doc, docx, xls, xlsx, ppt, pptx, jpg, jpeg, png, gif, zip"
      );
    }

    // Validate lesson exists and is files type
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new Error("Lesson not found");
    }

    if (lesson.type !== "files") {
      throw new Error("Lesson is not a files type");
    }

    return await ctx.db.insert("files", {
      lessonId: args.lessonId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: args.fileType,
      uploadedAt: Date.now(),
    });
  },
});

/**
 * Remove a file attachment.
 * T096: Implement files.removeAttachment mutation
 */
export const removeAttachment = mutation({
  args: {
    fileId: v.id("files"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Delete from storage
    await ctx.storage.delete(file.storageId);

    // Delete record
    await ctx.db.delete(args.fileId);

    return null;
  },
});

/**
 * Save course cover image.
 * T097: Implement files.saveCoverImage mutation
 */
export const saveCoverImage = mutation({
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

    // Update course with new cover image
    await ctx.db.patch(args.courseId, {
      coverImageId: args.storageId,
    });

    return null;
  },
});

/**
 * Remove course cover image.
 */
export const removeCoverImage = mutation({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    if (course.coverImageId) {
      await ctx.storage.delete(course.coverImageId);
      await ctx.db.patch(args.courseId, {
        coverImageId: undefined,
      });
    }

    return null;
  },
});
