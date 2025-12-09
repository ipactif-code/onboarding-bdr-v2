# 🎯 CLAUDE CODE INTEGRATION INSTRUCTIONS
**Task:** T055 - Course Detail Page (User View)  
**Source:** Figma Make - CourseViewSummaryUser.tsx  
**Date:** 2025-12-08  
**Project:** Onboarding BDR Team v2 LMS

---

## 📋 CONTEXT

This is the Course Detail Page where users can:
- View course overview (cover image, title, description)
- See their progress through the course
- Navigate through sections and lessons via accordion
- Access tabs: Summary, Comments, Files
- Continue where they left off

---

## 🏗️ LAYOUT STRUCTURE (from Figma)

**Grid:** `grid-cols-[2.75fr_1fr]`

---

## 📁 FILES TO CREATE

### File Structure
```
src/app/(dashboard)/courses/[courseId]/
├── page.tsx                    → Server component, fetches course
├── course-content.tsx          → Client component, main content
└── course-sidebar.tsx          → Client component, right sidebar

src/components/course/
├── course-header.tsx           → Cover image + title + description
├── course-section-accordion.tsx → Accordion with lessons
├── course-progress-card.tsx    → Progress display + continue button
├── course-tabs.tsx             → Summary/Comments/Files tabs
└── lesson-item.tsx             → Single lesson with checkbox
```

---

## 🔧 IMPLEMENTATION

### File 1: `src/app/(dashboard)/courses/[courseId]/page.tsx`

```tsx
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { CourseContent } from "./course-content";
import { CourseSidebar } from "./course-sidebar";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface CoursePageProps {
  params: Promise<{ courseId: string }>;
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch course with progress data
  const course = await convex.query(api.courses.getWithProgress, {
    courseId: courseId as Id<"courses">,
  });

  if (!course) {
    notFound();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2.75fr_1fr] h-[calc(100vh-4rem)]">
      <CourseContent course={course} />
      <CourseSidebar course={course} />
    </div>
  );
}
```

---

### File 2: `src/app/(dashboard)/courses/[courseId]/course-content.tsx`

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Flag, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CourseWithProgress } from "@/types/course";

interface CourseContentProps {
  course: CourseWithProgress;
}

export function CourseContent({ course }: CourseContentProps) {
  // Find current/next lesson
  const allLessons = course.sections?.flatMap(s => s.lessons) ?? [];
  const currentLessonIndex = allLessons.findIndex(l => !l.isCompleted);
  const currentLesson = allLessons[currentLessonIndex];
  const prevLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < allLessons.length - 1 ? allLessons[currentLessonIndex + 1] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          {/* Cover Image */}
          <div className="relative aspect-video w-full max-w-4xl rounded-xl overflow-hidden bg-neutral-100">
            {course.coverImage ? (
              <Image
                src={course.coverImage}
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
            <p className="text-base text-neutral-600 leading-relaxed">
              {course.description}
            </p>
          </div>

          {/* Course Sections with Lessons */}
          <div className="max-w-4xl space-y-6">
            {course.sections?.map((section) => (
              <div key={section._id} className="space-y-4">
                <h2 className="text-xl font-semibold text-neutral-950">
                  {section.title}
                </h2>
                <div className="space-y-2">
                  {section.lessons?.map((lesson) => (
                    <LessonCheckItem
                      key={lesson._id}
                      lesson={lesson}
                      courseId={course._id}
                    />
                  ))}
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
                <Link href={`/courses/${course._id}/lessons/${prevLesson._id}`}>
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
            <Button
              disabled={!nextLesson}
              asChild={!!nextLesson}
            >
              {nextLesson ? (
                <Link href={`/courses/${course._id}/lessons/${nextLesson._id}`}>
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
  lesson: {
    _id: string;
    title: string;
    isCompleted?: boolean;
  };
  courseId: string;
  indented?: boolean;
}

function LessonCheckItem({ lesson, courseId, indented }: LessonCheckItemProps) {
  return (
    <Link
      href={`/courses/${courseId}/lessons/${lesson._id}`}
      className={`flex items-center gap-3 py-2 hover:bg-neutral-50 rounded-md px-2 transition-colors ${
        indented ? "pl-10" : ""
      }`}
    >
      <div
        className={`size-[18px] rounded border-2 flex items-center justify-center ${
          lesson.isCompleted
            ? "bg-blue-500 border-blue-500"
            : "bg-white border-neutral-300"
        }`}
      >
        {lesson.isCompleted && (
          <svg
            className="size-3 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
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
```

---

### File 3: `src/app/(dashboard)/courses/[courseId]/course-sidebar.tsx`

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Play, ChevronDown, ChevronRight, Check } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CourseWithProgress } from "@/types/course";

interface CourseSidebarProps {
  course: CourseWithProgress;
}

export function CourseSidebar({ course }: CourseSidebarProps) {
  const progress = course.progress?.percentage ?? 0;
  
  // Find next lesson to continue
  const allLessons = course.sections?.flatMap(s => s.lessons) ?? [];
  const nextLesson = allLessons.find(l => !l.isCompleted);

  return (
    <div className="flex flex-col h-full border-l border-neutral-200">
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
                {progress === 0 ? "Start Course" : progress === 100 ? "Review Course" : "Continue"}
              </Link>
            </Button>
          </div>

          {/* Sections Accordion */}
          <ScrollArea className="flex-1">
            <Accordion type="multiple" defaultValue={["intro"]} className="w-full">
              {/* Introduction Section */}
              <AccordionItem value="intro" className="border-b border-neutral-200">
                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-neutral-50">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={false}
                      className="pointer-events-none"
                    />
                    <span className="font-medium text-sm text-neutral-950">
                      Introduction
                    </span>
                  </div>
                </AccordionTrigger>
              </AccordionItem>

              {/* Dynamic Sections */}
              {course.sections?.map((section, sectionIndex) => (
                <AccordionItem
                  key={section._id}
                  value={section._id}
                  className="border-b border-neutral-200"
                >
                  <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-neutral-50">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={section.isCompleted}
                        className="pointer-events-none"
                      />
                      <span className="font-medium text-sm text-neutral-950">
                        Sec {sectionIndex + 1}: {section.title}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    {section.lessons?.map((lesson, lessonIndex) => (
                      <Link
                        key={lesson._id}
                        href={`/courses/${course._id}/lessons/${lesson._id}`}
                        className="flex items-center gap-2 pl-7 pr-3 py-2 hover:bg-neutral-50 transition-colors"
                      >
                        <Checkbox
                          checked={lesson.isCompleted}
                          className="pointer-events-none"
                        />
                        <span
                          className={cn(
                            "text-sm",
                            lesson.isCompleted
                              ? "text-neutral-400"
                              : "text-neutral-600"
                          )}
                        >
                          Ch {lessonIndex + 1}: {lesson.title}
                        </span>
                      </Link>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>
        </TabsContent>

        {/* Comments Tab Content */}
        <TabsContent value="comments" className="flex-1 m-0 p-4">
          <div className="text-center text-neutral-500 py-8">
            <p>Comments will be displayed here</p>
            {/* TODO: Integrate with convex/comments.ts */}
          </div>
        </TabsContent>

        {/* Files Tab Content */}
        <TabsContent value="files" className="flex-1 m-0 p-4">
          <div className="text-center text-neutral-500 py-8">
            <p>Course files will be displayed here</p>
            {/* TODO: Integrate with convex/files.ts */}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

### File 4: `src/types/course.ts` (Add/Update)

```tsx
import { Id } from "@/convex/_generated/dataModel";

export interface CourseWithProgress {
  _id: Id<"courses">;
  title: string;
  description: string;
  coverImage?: string;
  status: "draft" | "published" | "archived";
  progress?: {
    percentage: number;
    completedLessons: number;
    totalLessons: number;
  };
  sections?: SectionWithLessons[];
}

export interface SectionWithLessons {
  _id: Id<"sections">;
  title: string;
  order: number;
  isCompleted?: boolean;
  lessons?: LessonWithProgress[];
}

export interface LessonWithProgress {
  _id: Id<"lessons">;
  title: string;
  type: "text" | "embed" | "quiz" | "files";
  order: number;
  isCompleted?: boolean;
  progress?: number;
}
```

---

## 📦 SHADCN COMPONENTS USED

All already installed:
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`
- `Progress`
- `Button`
- `Checkbox`
- `ScrollArea`
- `Separator`

---

## 🔄 CONVEX HOOKS INTEGRATION

The page uses these Convex queries (already implemented in backend):

```tsx
// Fetch course with sections, lessons, and user progress
api.courses.getWithProgress({ courseId })

// Response shape:
{
  _id: "...",
  title: "Course Title",
  description: "...",
  coverImage: "https://...",
  progress: { percentage: 45, completedLessons: 5, totalLessons: 11 },
  sections: [
    {
      _id: "...",
      title: "Section 1",
      isCompleted: false,
      lessons: [
        { _id: "...", title: "Lesson 1", isCompleted: true },
        { _id: "...", title: "Lesson 2", isCompleted: false },
      ]
    }
  ]
}
```

---

## ✅ SUCCESS CRITERIA

- [ ] Two-column layout: content (2.75fr) + sidebar (1fr)
- [ ] Cover image displays with fallback gradient
- [ ] Course title and description render correctly
- [ ] Sections display with lesson checkboxes
- [ ] Completed lessons show strikethrough + checkmark
- [ ] Right sidebar shows tabs: Summary, Comments, Files
- [ ] Progress bar displays percentage
- [ ] "Continue" button links to next incomplete lesson
- [ ] Accordion sections are collapsible
- [ ] Lessons are clickable and navigate to lesson page
- [ ] Footer has "Report Issue", "Back", "Next Chapter" buttons
- [ ] Responsive: stacks on mobile (single column)
- [ ] Loading states with skeletons
- [ ] Uses Shadcn components (no custom HTML recreations)

---

## ⚠️ IMPORTANT NOTES

1. **Sidebar removed** - Already in layout (T028)
2. **Header removed** - Already in layout, update breadcrumb dynamically
3. **Figma SVGs replaced** - Use Lucide icons (ChevronDown, ChevronRight, Check, Play, Flag)
4. **Checkbox read-only** - Progress is tracked via lesson completion, not direct checkbox clicks
5. **Comments/Files tabs** - Placeholder for now, will be implemented in separate tasks

---

## 🔗 RELATED TASKS

- **T056**: Course section accordion (included here)
- **T057**: Lesson list item (included here)
- **T059**: Lesson Viewer page (next task)

---

**End of Instructions**
