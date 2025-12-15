"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { Id } from "../../../convex/_generated/dataModel";
import { CourseCard } from "./course-card";

interface Course {
  _id: Id<"courses">;
  title: string;
  coverImage?: string;
  progress?: number;
  lessonsCount?: number;
}

interface CourseCarouselProps {
  courses: Course[];
  showProgress?: boolean;
}

export const CourseCarousel = forwardRef<HTMLDivElement, CourseCarouselProps>(
  ({ courses, showProgress = false }, ref) => {
    return (
      <div
        ref={ref}
        className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {courses.map((course) => (
          <Link
            key={course._id}
            href={`/courses/${course._id}`}
            className="shrink-0"
          >
            <CourseCard
              title={course.title}
              coverImage={course.coverImage}
              progress={showProgress ? course.progress : undefined}
              lessonsCount={course.lessonsCount}
            />
          </Link>
        ))}
      </div>
    );
  }
);

CourseCarousel.displayName = "CourseCarousel";
