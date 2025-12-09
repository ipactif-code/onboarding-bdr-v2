import { z } from "zod";

export const lessonTypeSchema = z.enum(["text", "embed", "quiz", "files"]);
export type LessonType = z.infer<typeof lessonTypeSchema>;

export const embedProviderSchema = z.enum([
  "youtube",
  "vimeo",
  "loom",
  "figma",
  "other",
]);
export type EmbedProvider = z.infer<typeof embedProviderSchema>;

export const createSectionSchema = z.object({
  courseId: z.string().min(1, "Course ID is required"),
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .optional(),
});
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

export const updateSectionSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters")
    .optional(),
  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .optional(),
});
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

export const createLessonSchema = z.object({
  sectionId: z.string().min(1, "Section ID is required"),
  type: lessonTypeSchema,
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .optional(),
  estimatedDuration: z.number().int().positive().optional(),
});
export type CreateLessonInput = z.infer<typeof createLessonSchema>;

export const updateLessonSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters")
    .optional(),
  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .optional(),
  estimatedDuration: z.number().int().positive().optional(),
});
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

export const setEmbedConfigSchema = z.object({
  lessonId: z.string().min(1, "Lesson ID is required"),
  url: z.string().url("Invalid URL"),
  provider: embedProviderSchema,
});
export type SetEmbedConfigInput = z.infer<typeof setEmbedConfigSchema>;

export const reorderLessonsSchema = z.object({
  sectionId: z.string().min(1, "Section ID is required"),
  lessonIds: z.array(z.string()).min(1, "At least one lesson ID is required"),
});
export type ReorderLessonsInput = z.infer<typeof reorderLessonsSchema>;

export const reorderSectionsSchema = z.object({
  courseId: z.string().min(1, "Course ID is required"),
  sectionIds: z.array(z.string()).min(1, "At least one section ID is required"),
});
export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>;
