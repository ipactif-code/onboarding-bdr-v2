"use client";

import Image from "next/image";
import { Play, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";

interface CourseCardProps {
  title: string;
  coverImage?: string;
  progress?: number;
  lessonsCount?: number;
}

export function CourseCard({
  title,
  coverImage,
  progress,
  lessonsCount,
}: CourseCardProps) {
  const hasProgress = progress !== undefined;

  return (
    <div
      className={cn(
        "flex flex-col w-80 group cursor-pointer",
        "rounded-xl overflow-hidden",
        "bg-card border border-border",
        "hover:border-primary/50 hover:shadow-xl",
        "transition-all duration-300"
      )}
    >
      {/* Cover Image - 16:9 ratio */}
      <div className="h-[180px] relative overflow-hidden bg-muted">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent z-10" />

        {coverImage ? (
          <Image
            src={coverImage}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="320px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <BookOpen className="size-12 text-muted-foreground/40" />
          </div>
        )}

        {/* Play button overlay on hover */}
        <div
          className={cn(
            "absolute inset-0 z-20",
            "flex items-center justify-center",
            "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-300"
          )}
        >
          <div
            className={cn(
              "size-14 rounded-full",
              "bg-background/90 backdrop-blur-sm",
              "flex items-center justify-center",
              "shadow-lg"
            )}
          >
            <Play className="size-6 fill-foreground text-foreground ml-1" />
          </div>
        </div>
      </div>

      {/* Content - overlapping gradient */}
      <div className="relative z-20 -mt-6 p-5 pt-0">
        {/* Title */}
        <h3
          className={cn(
            "text-base font-bold text-foreground",
            "leading-tight line-clamp-2 mb-3",
            "group-hover:text-primary",
            "transition-colors duration-200"
          )}
        >
          {title}
        </h3>

        {/* Meta info */}
        {lessonsCount !== undefined && lessonsCount > 0 && (
          <div className="flex items-center gap-3 text-muted-foreground text-xs mb-4">
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-3.5" />
              {lessonsCount} {lessonsCount === 1 ? "Lesson" : "Lessons"}
            </span>
          </div>
        )}

        {/* Progress Bar with Label */}
        {hasProgress && (
          <Progress value={progress}>
            <ProgressLabel className="text-xs">Progress</ProgressLabel>
            <ProgressValue className="text-xs" />
          </Progress>
        )}
      </div>
    </div>
  );
}
