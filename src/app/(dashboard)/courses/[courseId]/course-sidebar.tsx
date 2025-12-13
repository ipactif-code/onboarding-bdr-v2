"use client";

import Link from "next/link";
import { Play, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { CourseWithProgress } from "@/types/course";

interface CourseSidebarProps {
  course: CourseWithProgress;
}

export function CourseSidebar({ course }: CourseSidebarProps) {
  const progress = course.userProgress.percentage;

  // Build a map of lesson completion status
  const lessonStatusMap = new Map(
    course.userProgress.lessonStatuses.map((s) => [s.lessonId, s.status])
  );

  // Find next lesson to continue
  const allLessons = course.sections.flatMap((s) => s.lessons);
  const nextLesson = allLessons.find(
    (l) => lessonStatusMap.get(l._id) !== "completed"
  );

  // Check if section is completed
  const isSectionCompleted = (sectionLessons: typeof allLessons) =>
    sectionLessons.every((l) => lessonStatusMap.get(l._id) === "completed");

  return (
    <div className="flex flex-col h-full border-l border-neutral-200 bg-white">
      {/* Tabs Header */}
      <Tabs defaultValue="summary" className="flex flex-col h-full">
        <div className="border-b border-neutral-200 px-3">
          <TabsList className="bg-transparent h-auto p-0 gap-2">
            <TabsTrigger
              value="summary"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none px-1 py-2.5 font-semibold text-sm"
            >
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="comments"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none px-1 py-2.5 font-semibold text-sm text-neutral-400"
            >
              Comments
            </TabsTrigger>
            <TabsTrigger
              value="files"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none px-1 py-2.5 font-semibold text-sm text-neutral-400"
            >
              Files
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Summary Tab Content */}
        <TabsContent value="summary" className="flex-1 flex flex-col m-0">
          {/* Progress Card */}
          <div className="p-4 space-y-4 border-b border-neutral-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Progress</span>
                <span className="font-medium text-neutral-900">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <Button className="w-full" asChild>
              <Link
                href={
                  nextLesson
                    ? `/courses/${course._id}/lessons/${nextLesson._id}`
                    : `/courses/${course._id}`
                }
              >
                <Play className="size-4 mr-2" />
                {progress === 0
                  ? "Start Course"
                  : progress === 100
                    ? "Review Course"
                    : "Continue"}
              </Link>
            </Button>
          </div>

          {/* Sections Accordion */}
          <ScrollArea className="flex-1">
            <Accordion
              type="multiple"
              defaultValue={course.sections.map((s) => s._id)}
              className="w-full"
            >
              {/* Dynamic Sections */}
              {course.sections.map((section, sectionIndex) => {
                const sectionCompleted = isSectionCompleted(section.lessons);

                return (
                  <AccordionItem
                    key={section._id}
                    value={section._id}
                    className="border-b border-neutral-200"
                  >
                    <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-neutral-50">
                      <div className="flex items-center gap-2">
                        {sectionCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-neutral-300 flex-shrink-0" />
                        )}
                        <span className="font-medium text-sm text-neutral-950">
                          Sec {sectionIndex + 1}: {section.title}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      {section.lessons.map((lesson, lessonIndex) => {
                        const isCompleted =
                          lessonStatusMap.get(lesson._id) === "completed";

                        return (
                          <Link
                            key={lesson._id}
                            href={`/courses/${course._id}/lessons/${lesson._id}`}
                            className="flex items-center gap-2 pl-7 pr-3 py-2 hover:bg-neutral-50 transition-colors"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-neutral-300 flex-shrink-0" />
                            )}
                            <span
                              className={cn(
                                "text-sm",
                                isCompleted
                                  ? "text-neutral-400"
                                  : "text-neutral-600"
                              )}
                            >
                              Ch {lessonIndex + 1}: {lesson.title}
                            </span>
                          </Link>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </ScrollArea>
        </TabsContent>

        {/* Comments Tab Content */}
        <TabsContent value="comments" className="flex-1 m-0 p-4">
          <div className="text-center text-neutral-500 py-8">
            <p>Comments will be displayed here</p>
          </div>
        </TabsContent>

        {/* Files Tab Content */}
        <TabsContent value="files" className="flex-1 m-0 p-4">
          <div className="text-center text-neutral-500 py-8">
            <p>Course files will be displayed here</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
