"use client";

import type { ReactElement } from "react";
import { useRouter } from "next/navigation";
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
import { InlineDiscussionContent } from "@/components/messaging/course-discussion/inline-discussion-content";
import { cn } from "@/lib/utils";
import { CourseWithProgress } from "@/types/course";
import { Id } from "../../../../../convex/_generated/dataModel";

interface CourseSidebarProps {
  course: CourseWithProgress;
  selectedLessonId?: string | null;
}

export function CourseSidebar({ course, selectedLessonId }: CourseSidebarProps): ReactElement {
  const router = useRouter();
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
  const isSectionCompleted = (sectionLessons: typeof allLessons): boolean =>
    sectionLessons.every((l) => lessonStatusMap.get(l._id) === "completed");

  // Navigate to lesson using query params (SPA-style)
  const navigateToLesson = (lessonId: Id<"lessons">): void => {
    router.push(`/courses/${course._id}?lesson=${lessonId}`, { scroll: false });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden border-l border-border bg-background">
      {/* Tabs Header */}
      <Tabs defaultValue="summary" className="flex flex-col h-full min-h-0">
        <div className="border-b border-border px-3">
          <TabsList className="bg-transparent h-auto p-0 gap-2" aria-label="Course navigation tabs">
            <TabsTrigger
              value="summary"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none px-1 py-2.5 font-semibold text-sm"
            >
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="comments"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none px-1 py-2.5 font-semibold text-sm text-muted-foreground"
            >
              Comments
            </TabsTrigger>
            <TabsTrigger
              value="files"
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none rounded-none px-1 py-2.5 font-semibold text-sm text-muted-foreground"
            >
              Files
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Summary Tab Content */}
        <TabsContent value="summary" className="flex-1 flex flex-col m-0 min-h-0">
          {/* Progress Card */}
          <div className="p-4 space-y-4 border-b border-border">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <Button
              className="w-full"
              onClick={() => {
                const targetLesson = nextLesson ?? allLessons[0];
                if (targetLesson) {
                  navigateToLesson(targetLesson._id);
                }
              }}
            >
              <Play className="size-4" data-icon="inline-start" />
              {progress === 0
                ? "Start Course"
                : progress === 100
                  ? "Review Course"
                  : "Continue"}
            </Button>
          </div>

          {/* Sections Accordion */}
          <ScrollArea className="h-0 flex-1">
            <Accordion
              multiple
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
                    className="border-b border-border"
                  >
                    <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        {sectionCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                        )}
                        <span className="font-medium text-sm text-foreground">
                          Sec {sectionIndex + 1}: {section.title}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      {section.lessons.map((lesson, lessonIndex) => {
                        const isCompleted =
                          lessonStatusMap.get(lesson._id) === "completed";
                        const isSelected = selectedLessonId === lesson._id;

                        return (
                          <button
                            key={lesson._id}
                            onClick={() => navigateToLesson(lesson._id)}
                            className={cn(
                              "flex items-center gap-2 pl-7 pr-3 py-2 w-full text-left hover:bg-muted/50 transition-colors",
                              isSelected && "bg-muted"
                            )}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                            )}
                            <span
                              className={cn(
                                "text-sm",
                                isSelected
                                  ? "text-foreground font-medium"
                                  : "text-muted-foreground"
                              )}
                            >
                              Ch {lessonIndex + 1}: {lesson.title}
                            </span>
                          </button>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </ScrollArea>
        </TabsContent>

        {/* Comments Tab Content - Discussion Panel */}
        <TabsContent value="comments" className="flex-1 m-0 min-h-0 flex flex-col">
          <InlineDiscussionContent
            courseId={course._id}
            lessonId={selectedLessonId ? (selectedLessonId as Id<"lessons">) : undefined}
          />
        </TabsContent>

        {/* Files Tab Content */}
        <TabsContent value="files" className="flex-1 m-0 p-4">
          <div className="text-center text-muted-foreground py-8">
            <p>Course files will be displayed here</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
