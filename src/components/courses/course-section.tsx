"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CourseCarousel } from "./course-carousel";
import { Id } from "../../../convex/_generated/dataModel";

interface Course {
  _id: Id<"courses">;
  title: string;
  coverImage?: string;
  progress?: number;
  lessonsCount?: number;
}

interface CourseSectionProps {
  title: string;
  courses: Course[];
  showProgress?: boolean;
}

export function CourseSection({
  title,
  courses,
  showProgress = false,
}: CourseSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -344, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 344, behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          {title}
        </h2>

        {/* Navigation arrows */}
        <div className="flex gap-2 px-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            onClick={scrollLeft}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            onClick={scrollRight}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Separator */}
      <Separator />

      {/* Carousel */}
      <CourseCarousel
        ref={scrollRef}
        courses={courses}
        showProgress={showProgress}
      />
    </div>
  );
}
