"use client";

import Link from "next/link";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CourseCardProps {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  progress?: number; // 0-100
  category?: string;
  lessonCount?: number;
  isCompleted?: boolean;
}

export function CourseCard({
  id,
  title,
  description,
  coverImage,
  progress,
  category,
  lessonCount,
  isCompleted,
}: CourseCardProps) {
  return (
    <Link href={`/courses/${id}`}>
      <Card className="group overflow-hidden hover:shadow-md transition-shadow">
        {/* Cover Image */}
        <div className="relative aspect-video bg-muted overflow-hidden rounded-t-xl">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={title}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600" />
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-sm text-foreground line-clamp-1">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}

          {/* Progress or Category */}
          {progress !== undefined ? (
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {progress}% complete
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {category && <span>{category}</span>}
              {category && lessonCount && <span>•</span>}
              {lessonCount && <span>{lessonCount} lessons</span>}
            </div>
          )}

          {isCompleted && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              Completed
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
