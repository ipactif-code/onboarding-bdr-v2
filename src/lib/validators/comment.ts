import { z } from "zod";

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment must be at most 5000 characters"),
  courseId: z.string().optional(),
  lessonId: z.string().optional(),
}).refine(
  (data) => data.courseId || data.lessonId,
  "Either courseId or lessonId must be provided"
);
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const replyToCommentSchema = z.object({
  parentId: z.string().min(1, "Parent comment ID is required"),
  content: z
    .string()
    .min(1, "Reply cannot be empty")
    .max(5000, "Reply must be at most 5000 characters"),
});
export type ReplyToCommentInput = z.infer<typeof replyToCommentSchema>;

export const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment must be at most 5000 characters"),
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
