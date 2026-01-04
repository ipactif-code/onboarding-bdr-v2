"use client";

import { forwardRef, type ReactElement } from "react";
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
  ({ courses, showProgress = false }, ref): ReactElement => {
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
          <div key={course._id} className="shrink-0 w-80">
            <CourseCard
              id={course._id}
              title={course.title}
              coverImage={course.coverImage}
              progress={showProgress ? course.progress : undefined}
              lessonsCount={course.lessonsCount}
            />
          </div>
        ))}
      </div>
    );
  }
);

CourseCarousel.displayName = "CourseCarousel";
