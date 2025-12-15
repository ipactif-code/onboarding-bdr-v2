import { Id } from "../../convex/_generated/dataModel";

/**
 * Course with user progress from courses.getWithProgress
 */
export interface CourseWithProgress {
  _id: Id<"courses">;
  title: string;
  description?: string;
  coverImageUrl?: string;
  creator: {
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
  };
  status: "draft" | "published";
  visibility: "all_teams" | "specific_teams" | "specific_users";
  displayOrder: number;
  viewCount: number;
  tags: Array<{
    _id: Id<"tags">;
    name: string;
  }>;
  sections: SectionWithLessons[];
  publishedAt?: number;
  _creationTime: number;
  userProgress: {
    completedLessons: number;
    totalLessons: number;
    percentage: number;
    lessonStatuses: Array<{
      lessonId: Id<"lessons">;
      status: "not_started" | "in_progress" | "completed";
      completedAt?: number;
    }>;
  };
}

/**
 * Section with lessons array
 */
export interface SectionWithLessons {
  _id: Id<"sections">;
  title: string;
  description?: string;
  displayOrder: number;
  lessons: LessonBasic[];
}

/**
 * Basic lesson info for course listing
 */
export interface LessonBasic {
  _id: Id<"lessons">;
  title: string;
  type: "text" | "embed" | "quiz" | "files";
  estimatedDuration?: number;
  displayOrder: number;
}

/**
 * Lesson with completion status (derived from userProgress)
 */
export interface LessonWithStatus extends LessonBasic {
  isCompleted: boolean;
}

/**
 * Full lesson data from lessons.get API
 */
export interface LessonFull {
  _id: Id<"lessons">;
  sectionId: Id<"sections">;
  courseId: Id<"courses">;
  type: "text" | "embed" | "quiz" | "files";
  title: string;
  description?: string;
  estimatedDuration?: number;
  content?: unknown[];
  displayOrder: number;
  embedConfig?: {
    url: string;
    provider: "youtube" | "vimeo" | "loom" | "figma" | "other";
  };
  quizConfig?: {
    passingScore: number;
    allowRetry: boolean;
    maxAttempts?: number;
    showAnswers: boolean;
    questions: Array<{
      _id: Id<"quizQuestions">;
      questionText: string;
      options: Array<{
        text: string;
        isCorrect: boolean;
      }>;
      explanation?: string;
      points: number;
      displayOrder: number;
    }>;
  };
  files?: Array<{
    _id: Id<"files">;
    fileName: string;
    fileSize: number;
    fileType: string;
    downloadUrl: string;
  }>;
}
