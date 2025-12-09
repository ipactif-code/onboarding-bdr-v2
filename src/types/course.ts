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
