import { z } from "zod";

export const courseStatusSchema = z.enum(["draft", "published"]);
export type CourseStatus = z.infer<typeof courseStatusSchema>;

export const courseVisibilitySchema = z.enum([
  "all_teams",
  "specific_teams",
  "specific_users",
]);
export type CourseVisibility = z.infer<typeof courseVisibilitySchema>;

export const createCourseSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional(),
  visibility: courseVisibilitySchema.default("all_teams"),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters")
    .optional(),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional(),
  visibility: courseVisibilitySchema.optional(),
});
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

export const courseAssignmentSchema = z.object({
  courseId: z.string().min(1, "Course ID is required"),
  teamIds: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional(),
});
export type CourseAssignmentInput = z.infer<typeof courseAssignmentSchema>;

export const reorderCoursesSchema = z.object({
  courseIds: z.array(z.string()).min(1, "At least one course ID is required"),
});
export type ReorderCoursesInput = z.infer<typeof reorderCoursesSchema>;
