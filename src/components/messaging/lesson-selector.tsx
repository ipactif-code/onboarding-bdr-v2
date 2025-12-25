"use client";

import { useQuery } from "convex/react";
import { BookOpen } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Props for the LessonSelector component.
 */
interface LessonSelectorProps {
  /**
   * The course ID to fetch lessons for.
   */
  courseId: Id<"courses">;
  /**
   * The currently selected lesson ID, or null for "General Discussion".
   */
  selectedLessonId: Id<"lessons"> | null;
  /**
   * Callback when the lesson selection changes.
   * Passes null when "General Discussion" is selected.
   */
  onLessonChange: (lessonId: Id<"lessons"> | null) => void;
}

/**
 * LessonSelector displays a dropdown to select a lesson context for messages.
 * Used in course channel message input to associate messages with specific lessons.
 *
 * Features:
 * - Fetches lessons for the given course via Convex query
 * - "General Discussion" option for messages not linked to a specific lesson
 * - Loading state is handled by not rendering if lessons are loading
 * - Returns null if no lessons are available
 *
 * @example
 * ```tsx
 * const [selectedLessonId, setSelectedLessonId] = useState<Id<"lessons"> | null>(null);
 *
 * <LessonSelector
 *   courseId={channel.courseId}
 *   selectedLessonId={selectedLessonId}
 *   onLessonChange={setSelectedLessonId}
 * />
 * ```
 */
export function LessonSelector({
  courseId,
  selectedLessonId,
  onLessonChange,
}: LessonSelectorProps): React.ReactElement | null {
  // Fetch lessons for the course
  const lessons = useQuery(api.lessons.listByCourse, { courseId });

  // Don't render if lessons are loading or if there are no lessons
  if (lessons === undefined || lessons.length === 0) {
    return null;
  }

  return (
    <Select
      value={selectedLessonId ?? "general"}
      onValueChange={(value) => {
        onLessonChange(value === "general" ? null : (value as Id<"lessons">));
      }}
    >
      <SelectTrigger
        data-slot="lesson-selector"
        className="w-[180px] h-8 text-xs"
        aria-label="Select lesson context for discussion"
      >
        <BookOpen data-icon="inline-start" className="size-3 mr-1" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="general">General Discussion</SelectItem>
        {lessons.map((lesson) => (
          <SelectItem key={lesson._id} value={lesson._id}>
            {lesson.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
