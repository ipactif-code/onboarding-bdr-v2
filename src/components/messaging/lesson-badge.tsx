"use client";

import { BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * Props for the LessonBadge component.
 */
interface LessonBadgeProps {
  /**
   * The title of the lesson to display.
   */
  lessonTitle: string;
}

/**
 * LessonBadge displays a small badge indicating the lesson context of a message.
 * Used in channel messages that are linked to a specific course lesson.
 *
 * @example
 * ```tsx
 * <LessonBadge lessonTitle="Introduction to React" />
 * ```
 */
export function LessonBadge({ lessonTitle }: LessonBadgeProps): React.ReactElement {
  return (
    <Badge
      data-slot="lesson-badge"
      variant="secondary"
      className="gap-1 text-xs font-normal"
    >
      <BookOpen data-icon="inline-start" className="size-3" aria-hidden="true" />
      {lessonTitle}
    </Badge>
  );
}
