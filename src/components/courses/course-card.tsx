"use client";

import * as React from "react";
import { type ReactElement } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";

interface CourseCardProps {
  /** Course ID for navigation */
  id: string;
  /** Course title (max 2 lines displayed) */
  title: string;
  /** Cover image URL from Convex storage */
  coverImage?: string;
  /** Progress percentage 0-100, shows progress bar when provided */
  progress?: number;
  /** Number of lessons in the course */
  lessonsCount?: number;
  /** Enable fixed height for grid alignment (default: true) */
  fixedHeight?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const CourseCard = React.forwardRef<HTMLAnchorElement, CourseCardProps>(
  (
    {
      id,
      title,
      coverImage,
      progress,
      lessonsCount,
      fixedHeight = true,
      className,
    },
    ref
  ): ReactElement => {
    return (
      <Link
        ref={ref}
        href={`/courses/${id}`}
        className={cn(
          // Layout
          // FIX: Changed from h-[320px] to min-h-[320px]
          // This allows the card to grow if content requires more space
          // while maintaining consistent minimum height for grid alignment
          "flex flex-col w-full",
          fixedHeight && "min-h-[320px]",
          // Visual
          "rounded-xl overflow-hidden",
          "bg-card border border-border",
          // Interaction
          "group cursor-pointer",
          "hover:border-primary/50 hover:shadow-xl",
          "transition-all duration-300",
          // Accessibility - focus visible
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
      >
        {/* Cover Image
            FIX: Changed from aspect-video to h-[180px]

            The aspect-video class calculates height dynamically based on width (16:9 ratio).
            When card width exceeds ~500px, the image height exceeds available space,
            pushing content out of the visible area.

            Fixed pixel height ensures predictable behavior across all breakpoints:
            - 180px image + ~140px content = 320px minimum total
            - Works reliably from 320px mobile to 1920px+ desktop
        */}
        <div className="h-[180px] relative overflow-hidden bg-muted shrink-0">
          {/* Gradient overlay for text readability */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent z-10"
            aria-hidden="true"
          />

          {coverImage ? (
            <Image
              src={coverImage}
              alt="" // Decorative - title provides context
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen
                className="size-12 text-muted-foreground/40"
                aria-hidden="true"
              />
            </div>
          )}

          {/* Play button overlay - purely decorative */}
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-0 z-20",
              "flex items-center justify-center",
              "opacity-0 group-hover:opacity-100",
              "transition-opacity duration-300"
            )}
          >
            <div className="size-14 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <Play className="size-6 fill-foreground text-foreground ml-1" />
            </div>
          </div>
        </div>

        {/* Content section
            FIX: Removed -mt-6 negative margin and pt-0

            The negative margin was creating overlap with the image area,
            which combined with overflow-hidden caused content clipping.
            Now content has guaranteed space below the fixed-height image.
        */}
        <div
          className={cn(
            "relative z-20 p-4 flex flex-col",
            fixedHeight && "flex-1"
          )}
        >
          {/* Title - fixed min-height reserves space for 2 lines */}
          <h3
            className={cn(
              "text-base font-bold text-foreground",
              "leading-tight line-clamp-2",
              fixedHeight && "min-h-[2.75rem]",
              "group-hover:text-primary",
              "transition-colors duration-200"
            )}
          >
            {title}
          </h3>

          {/* Metadata - pushed to bottom via mt-auto
              FIX: Changed from mt-3 space-y-3 to mt-auto pt-3 space-y-2

              mt-auto pushes this section to the bottom of the flex container,
              ensuring consistent vertical alignment across cards with varying
              title lengths. Reduced space-y for more compact layout.
          */}
          <div className="mt-auto pt-3 space-y-2">
            {/* Lessons count */}
            {lessonsCount !== undefined && lessonsCount > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <BookOpen className="size-3.5" aria-hidden="true" />
                <span>
                  {lessonsCount} {lessonsCount === 1 ? "Lesson" : "Lessons"}
                </span>
              </div>
            )}

            {/* Progress bar */}
            <Progress value={progress ?? 0}>
              <ProgressLabel className="text-xs">Progress</ProgressLabel>
              <ProgressValue className="text-xs" />
            </Progress>
          </div>
        </div>
      </Link>
    );
  }
);

CourseCard.displayName = "CourseCard";

export { CourseCard, type CourseCardProps };
