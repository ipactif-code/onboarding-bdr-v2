"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import type { Id } from "../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  FileText,
  Video,
  HelpCircle,
  FolderOpen,
  Clock,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lesson data structure from the query.
 */
interface LessonData {
  _id: Id<"lessons">;
  sectionId: Id<"sections">;
  courseId: Id<"courses">;
  type: "text" | "embed" | "quiz" | "files";
  title: string;
  description?: string;
  estimatedDuration?: number;
  displayOrder: number;
}

/**
 * Props for the LessonEmbed block component.
 */
interface LessonEmbedProps {
  /** The lesson ID to embed */
  lessonId: Id<"lessons">;
  /** Additional CSS classes */
  className?: string;
  /** Whether this is rendered in read-only mode */
  readOnly?: boolean;
}

/**
 * Lesson type icons mapping.
 */
const lessonTypeIcons: Record<string, React.ReactElement> = {
  text: <FileText className="h-4 w-4" />,
  embed: <Video className="h-4 w-4" />,
  quiz: <HelpCircle className="h-4 w-4" />,
  files: <FolderOpen className="h-4 w-4" />,
};

/**
 * Lesson type labels mapping.
 */
const lessonTypeLabels: Record<string, string> = {
  text: "Text",
  embed: "Video",
  quiz: "Quiz",
  files: "Files",
};

/**
 * Helper function to format duration.
 */
function formatDuration(duration: number | undefined): string | null {
  if (!duration) return null;
  if (duration < 60) return `${duration} min`;
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Lesson Embed Block.
 *
 * A void element block for embedding lesson links in KB documents.
 * Fetches lesson info using useQuery and renders a compact card with:
 * - Lesson title and type icon
 * - Course name (parent course)
 * - Duration (if available)
 *
 * This is a Plate.js void element - it doesn't have editable children.
 *
 * @example
 * ```tsx
 * // In a Plate.js custom element renderer
 * <LessonEmbed lessonId={element.lessonId} />
 * ```
 */
export function LessonEmbed({
  lessonId,
  className,
  readOnly = false,
}: LessonEmbedProps): React.ReactElement {
  // Fetch lesson data
  const lesson = useQuery(api.lessons.get, { lessonId }) as
    | LessonData
    | null
    | undefined;

  // Loading state
  if (lesson === undefined) {
    return <LessonEmbedSkeleton className={className} />;
  }

  // Lesson not found or no access
  if (lesson === null) {
    return (
      <LessonEmbedError
        message="Lesson not found or you don't have access"
        className={className}
      />
    );
  }

  // Format duration
  const durationText = formatDuration(lesson.estimatedDuration);

  const content = (
    <Card
      size="sm"
      className={cn(
        "group relative transition-all",
        !readOnly && "hover:shadow-md hover:border-primary/50 cursor-pointer",
        className
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Lesson type icon */}
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              "bg-primary/10 text-primary"
            )}
          >
            {lessonTypeIcons[lesson.type] || <FileText className="h-4 w-4" />}
          </div>

          {/* Lesson info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{lesson.title}</span>
              {!readOnly && (
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              )}
            </div>

            {/* Meta info row */}
            <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
              <Badge variant="outline" className="h-5 px-1.5 text-xs">
                {lessonTypeLabels[lesson.type] || "Lesson"}
              </Badge>

              {durationText && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{durationText}</span>
                  </div>
                </>
              )}

              {lesson.description && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate max-w-[200px]">
                    {lesson.description}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Wrap in link if not read-only
  if (!readOnly) {
    return (
      <Link
        href={`/lessons/${lessonId}`}
        className="block no-underline"
        contentEditable={false}
      >
        {content}
      </Link>
    );
  }

  return <div contentEditable={false}>{content}</div>;
}

/**
 * Skeleton loading state for the lesson embed.
 */
function LessonEmbedSkeleton({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <Card size="sm" className={className}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Error state for the lesson embed.
 */
function LessonEmbedError({
  message,
  className,
}: {
  message: string;
  className?: string;
}): React.ReactElement {
  return (
    <Card
      size="sm"
      className={cn("border-destructive/50 bg-destructive/5", className)}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <FileText className="h-4 w-4" />
          <span>{message}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export { LessonEmbedSkeleton, LessonEmbedError };
