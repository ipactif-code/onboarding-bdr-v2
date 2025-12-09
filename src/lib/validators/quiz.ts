import { z } from "zod";

export const quizOptionSchema = z.object({
  text: z.string().min(1, "Option text is required"),
  isCorrect: z.boolean(),
});
export type QuizOption = z.infer<typeof quizOptionSchema>;

export const quizConfigSchema = z.object({
  lessonId: z.string().min(1, "Lesson ID is required"),
  passingScore: z.number().int().min(1).max(100, "Passing score must be between 1 and 100"),
  allowRetry: z.boolean().default(true),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  showAnswers: z.boolean().default(true),
});
export type QuizConfigInput = z.infer<typeof quizConfigSchema>;

export const updateQuizConfigSchema = z.object({
  passingScore: z.number().int().min(1).max(100).optional(),
  allowRetry: z.boolean().optional(),
  maxAttempts: z.number().int().min(1).max(10).optional().nullable(),
  showAnswers: z.boolean().optional(),
});
export type UpdateQuizConfigInput = z.infer<typeof updateQuizConfigSchema>;

export const quizQuestionSchema = z.object({
  quizConfigId: z.string().min(1, "Quiz config ID is required"),
  questionText: z.string().min(1, "Question text is required"),
  options: z
    .array(quizOptionSchema)
    .min(2, "At least 2 options required")
    .max(6, "At most 6 options allowed")
    .refine(
      (options) => options.some((o) => o.isCorrect),
      "At least one option must be correct"
    ),
  explanation: z.string().optional(),
  points: z.number().int().min(1).default(1),
});
export type QuizQuestionInput = z.infer<typeof quizQuestionSchema>;

export const updateQuizQuestionSchema = z.object({
  questionText: z.string().min(1).optional(),
  options: z
    .array(quizOptionSchema)
    .min(2)
    .max(6)
    .refine((options) => options.some((o) => o.isCorrect))
    .optional(),
  explanation: z.string().optional(),
  points: z.number().int().min(1).optional(),
});
export type UpdateQuizQuestionInput = z.infer<typeof updateQuizQuestionSchema>;

export const submitQuizSchema = z.object({
  quizConfigId: z.string().min(1, "Quiz config ID is required"),
  answers: z.record(z.string(), z.array(z.number())),
});
export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;
