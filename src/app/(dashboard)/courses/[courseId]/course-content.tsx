"use client";

import Link from "next/link";
import Image from "next/image";
import { Flag, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CourseWithProgress, LessonWithStatus } from "@/types/course";

interface CourseContentProps {
  course: CourseWithProgress;
}

export function CourseContent({ course }: CourseContentProps) {
  // Build a map of lesson completion status
  const lessonStatusMap = new Map(
    course.userProgress.lessonStatuses.map((s) => [s.lessonId, s.status])
  );

  // Flatten all lessons with completion status
  const allLessons: LessonWithStatus[] = course.sections.flatMap((section) =>
    section.lessons.map((lesson) => ({
      ...lesson,
      isCompleted: lessonStatusMap.get(lesson._id) === "completed",
    }))
  );

  // Find current/next lesson
  const currentLessonIndex = allLessons.findIndex((l) => !l.isCompleted);
  const prevLesson =
    currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1
      ? allLessons[currentLessonIndex + 1]
      : null;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          {/* Cover Image */}
          <div className="relative aspect-video w-full max-w-4xl rounded-xl overflow-hidden bg-neutral-100">
            {course.coverImageUrl ? (
              <Image
                src={course.coverImageUrl}
                alt={course.title}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600" />
            )}
          </div>

          {/* Title & Description */}
          <div className="max-w-4xl space-y-4">
            <h1 className="text-3xl font-bold text-neutral-950">
              {course.title}
            </h1>
            {course.description && (
              <p className="text-base text-neutral-600 leading-relaxed">
                {course.description}
              </p>
            )}
          </div>

          {/* Course Sections with Lessons */}
          <div className="max-w-4xl space-y-6">
            {course.sections.map((section) => (
              <div key={section._id} className="space-y-4">
                <h2 className="text-xl font-semibold text-neutral-950">
                  {section.title}
                </h2>
                <div className="space-y-2">
                  {section.lessons.map((lesson) => {
                    const isCompleted =
                      lessonStatusMap.get(lesson._id) === "completed";
                    return (
                      <LessonCheckItem
                        key={lesson._id}
                        lesson={{ ...lesson, isCompleted }}
                        courseId={course._id}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Report Issue */}
          <div className="flex items-center gap-1">
            <span className="text-sm text-neutral-400">
              Have an issue with this content?
            </span>
            <Button variant="ghost" size="sm" className="text-neutral-900">
              <Flag className="size-4 mr-2" />
              Report An Issue
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={!prevLesson}
              asChild={!!prevLesson}
            >
              {prevLesson ? (
                <Link
                  href={`/courses/${course._id}/lessons/${prevLesson._id}`}
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Back
                </Link>
              ) : (
                <>
                  <ChevronLeft className="size-4 mr-1" />
                  Back
                </>
              )}
            </Button>
            <Button disabled={!nextLesson} asChild={!!nextLesson}>
              {nextLesson ? (
                <Link
                  href={`/courses/${course._id}/lessons/${nextLesson._id}`}
                >
                  Next Chapter
                  <ChevronRight className="size-4 ml-1" />
                </Link>
              ) : (
                <>
                  Next Chapter
                  <ChevronRight className="size-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Lesson checkbox item component
interface LessonCheckItemProps {
  lesson: LessonWithStatus;
  courseId: string;
}

function LessonCheckItem({ lesson, courseId }: LessonCheckItemProps) {
  return (
    <Link
      href={`/courses/${courseId}/lessons/${lesson._id}`}
      className="flex items-center gap-3 py-2 hover:bg-neutral-50 rounded-md px-2 transition-colors"
    >
      <div
        className={`size-[18px] rounded border-2 flex items-center justify-center ${
          lesson.isCompleted
            ? "bg-blue-500 border-blue-500"
            : "bg-white border-neutral-300"
        }`}
      >
        {lesson.isCompleted && <Check className="size-3 text-white" />}
      </div>
      <span
        className={`text-base ${
          lesson.isCompleted
            ? "text-neutral-400 line-through"
            : "text-neutral-900"
        }`}
      >
        {lesson.title}
      </span>
    </Link>
  );
}
