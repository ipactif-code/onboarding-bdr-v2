"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import type { Id } from "../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, Users, Clock, ExternalLink } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Section with lessons structure from the course query.
 */
interface SectionWithLessons {
  _id: Id<"sections">;
  title: string;
  description?: string;
  displayOrder: number;
  lessons: {
    _id: Id<"lessons">;
    title: string;
    type: "text" | "embed" | "quiz" | "files";
    estimatedDuration?: number;
    displayOrder: number;
  }[];
}

/**
 * Tag structure from the course query.
 */
interface CourseTag {
  _id: Id<"tags">;
  name: string;
}

/**
 * Course data structure from the query.
 */
interface CourseData {
  _id: Id<"courses">;
  title: string;
  description?: string;
  coverImageUrl?: string;
  status: "draft" | "published";
  sections: SectionWithLessons[];
  tags: CourseTag[];
}

/**
 * Props for the CourseEmbed block component.
 */
interface CourseEmbedProps {
  /** The course ID to embed */
  courseId: Id<"courses">;
  /** Additional CSS classes */
  className?: string;
  /** Whether this is rendered in read-only mode */
  readOnly?: boolean;
}

/**
 * Helper function to format duration.
 */
function formatDuration(totalDuration: number): string | null {
  if (totalDuration === 0) return null;
  if (totalDuration < 60) return `${totalDuration}m`;
  const hours = Math.floor(totalDuration / 60);
  const mins = totalDuration % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Helper function to calculate totals from course sections.
 */
function calculateCourseTotals(sections: SectionWithLessons[]): {
  totalLessons: number;
  totalDuration: number;
} {
  let totalLessons = 0;
  let totalDuration = 0;

  for (const section of sections) {
    totalLessons += section.lessons.length;
    for (const lesson of section.lessons) {
      totalDuration += lesson.estimatedDuration ?? 0;
    }
  }

  return { totalLessons, totalDuration };
}

/**
 * Course Embed Block.
 *
 * A void element block for embedding course cards in KB documents.
 * Fetches course info using useQuery and renders a card with:
 * - Course title and description
 * - Cover image (if available)
 * - Course tags
 * - Section/lesson count
 *
 * This is a Plate.js void element - it doesn't have editable children.
 *
 * @example
 * ```tsx
 * // In a Plate.js custom element renderer
 * <CourseEmbed courseId={element.courseId} />
 * ```
 */
export function CourseEmbed({
  courseId,
  className,
  readOnly = false,
}: CourseEmbedProps): React.ReactElement {
  // Fetch course data
  const course = useQuery(api.courses.get, { courseId }) as
    | CourseData
    | null
    | undefined;

  // Loading state
  if (course === undefined) {
    return <CourseEmbedSkeleton className={className} />;
  }

  // Course not found or no access
  if (course === null) {
    return (
      <CourseEmbedError
        message="Course not found or you don't have access"
        className={className}
      />
    );
  }

  // Calculate totals
  const { totalLessons, totalDuration } = calculateCourseTotals(
    course.sections
  );
  const durationText = formatDuration(totalDuration);

  const content = (
    <Card
      size="sm"
      className={cn(
        "group relative overflow-hidden transition-all",
        !readOnly && "hover:shadow-md cursor-pointer",
        className
      )}
    >
      {/* Cover image */}
      {course.coverImageUrl && (
        <div className="relative h-32 w-full overflow-hidden">
          <Image
            src={course.coverImageUrl}
            alt={course.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 400px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
      )}

      <CardHeader className={cn(!course.coverImageUrl && "pt-4")}>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <CardTitle className="line-clamp-1">{course.title}</CardTitle>
            {course.description && (
              <CardDescription className="line-clamp-2">
                {course.description}
              </CardDescription>
            )}
          </div>
          {!readOnly && (
            <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Tags */}
        {course.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {course.tags.slice(0, 3).map((tag: CourseTag) => (
              <Badge key={tag._id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
            {course.tags.length > 3 && (
              <Badge variant="outline">+{course.tags.length - 3}</Badge>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            <span>
              {course.sections.length} section
              {course.sections.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>
              {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
            </span>
          </div>
          {durationText && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{durationText}</span>
            </div>
          )}
        </div>

        {/* Status badge */}
        {course.status === "draft" && (
          <Badge variant="outline" className="mt-2">
            Draft
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  // Wrap in link if not read-only
  if (!readOnly) {
    return (
      <Link
        href={`/courses/${courseId}`}
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
 * Skeleton loading state for the course embed.
 */
function CourseEmbedSkeleton({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <Card size="sm" className={cn("overflow-hidden", className)}>
      {/* Cover skeleton */}
      <Skeleton className="h-32 w-full rounded-none" />

      <CardHeader>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full mt-1" />
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex gap-1 mb-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Error state for the course embed.
 */
function CourseEmbedError({
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
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <BookOpen className="h-4 w-4" />
          <span>{message}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export { CourseEmbedSkeleton, CourseEmbedError };
