# Hooks Patterns Reference

## Table of Contents

1. [Convex Query Patterns](#convex-query-patterns)
2. [Convex Mutation Patterns](#convex-mutation-patterns)
3. [Custom Hooks](#custom-hooks)
4. [Optimistic Updates](#optimistic-updates)
5. [React 19 Considerations](#react-19-considerations)

## Convex Query Patterns

### Basic Query

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";

export function CourseList() {
  const courses = useQuery(api.courses.list);
  
  // Always handle undefined (loading state)
  if (courses === undefined) {
    return <Skeleton className="h-32 w-full" />;
  }
  
  // Empty state
  if (courses.length === 0) {
    return <EmptyState message="No courses found" />;
  }
  
  return (
    <div className="grid gap-4">
      {courses.map((course) => (
        <CourseCard key={course._id} course={course} />
      ))}
    </div>
  );
}
```

### Query with Parameters

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface CourseDetailProps {
  courseId: Id<"courses">;
}

export function CourseDetail({ courseId }: CourseDetailProps) {
  const course = useQuery(api.courses.get, { id: courseId });
  
  if (course === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }
  
  if (course === null) {
    return <NotFound message="Course not found" />;
  }
  
  return <CourseContent course={course} />;
}
```

### Conditional Query

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface LessonsListProps {
  courseId: Id<"courses"> | null;
}

export function LessonsList({ courseId }: LessonsListProps) {
  // Skip query when courseId is null
  const lessons = useQuery(
    api.lessons.listByCourse,
    courseId ? { courseId } : "skip"
  );
  
  if (!courseId) {
    return <p>Select a course to see lessons</p>;
  }
  
  if (lessons === undefined) {
    return <Skeleton className="h-32 w-full" />;
  }
  
  return (/* render lessons */);
}
```

## Convex Mutation Patterns

### Basic Mutation

```tsx
"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CreateCourseButton() {
  const createCourse = useMutation(api.courses.create);
  
  const handleCreate = async () => {
    try {
      await createCourse({ title: "New Course" });
      toast.success("Course created successfully");
    } catch (error) {
      toast.error("Failed to create course");
    }
  };
  
  return <Button onClick={handleCreate}>Create Course</Button>;
}
```

### Mutation with Loading State

```tsx
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function DeleteCourseButton({ courseId }: { courseId: Id<"courses"> }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteCourse = useMutation(api.courses.delete);
  
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteCourse({ id: courseId });
      toast.success("Course deleted");
    } catch (error) {
      toast.error("Failed to delete course");
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <Button 
      variant="destructive" 
      onClick={handleDelete}
      disabled={isDeleting}
    >
      {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Delete
    </Button>
  );
}
```

### Mutation with Form Data

```tsx
"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { CreateCourseInput } from "@/lib/validators/course";

export function useCourseActions() {
  const router = useRouter();
  const createCourse = useMutation(api.courses.create);
  const updateCourse = useMutation(api.courses.update);
  
  const handleCreate = async (data: CreateCourseInput) => {
    try {
      const courseId = await createCourse(data);
      toast.success("Course created");
      router.push(`/courses/${courseId}`);
    } catch (error) {
      toast.error("Failed to create course");
      throw error; // Re-throw for form error handling
    }
  };
  
  const handleUpdate = async (id: Id<"courses">, data: Partial<CreateCourseInput>) => {
    try {
      await updateCourse({ id, ...data });
      toast.success("Course updated");
    } catch (error) {
      toast.error("Failed to update course");
      throw error;
    }
  };
  
  return { handleCreate, handleUpdate };
}
```

## Custom Hooks

### Query Hook with Derived State

```tsx
// src/hooks/use-course-progress.ts
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useCourseProgress(courseId: Id<"courses">) {
  const progress = useQuery(api.progress.getByCourse, { courseId });
  
  const isLoading = progress === undefined;
  const completedLessons = progress?.completedLessons ?? [];
  const totalLessons = progress?.totalLessons ?? 0;
  const percentComplete = totalLessons > 0 
    ? Math.round((completedLessons.length / totalLessons) * 100) 
    : 0;
  
  return {
    isLoading,
    completedLessons,
    totalLessons,
    percentComplete,
    isComplete: percentComplete === 100,
  };
}
```

### Mutation Hook with State

```tsx
// src/hooks/use-toggle-lesson.ts
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export function useToggleLesson() {
  const [pendingId, setPendingId] = useState<Id<"lessons"> | null>(null);
  const toggleComplete = useMutation(api.progress.toggleLessonComplete);
  
  const toggle = async (lessonId: Id<"lessons">) => {
    setPendingId(lessonId);
    try {
      const result = await toggleComplete({ lessonId });
      toast.success(result.completed ? "Lesson completed!" : "Lesson unmarked");
    } catch (error) {
      toast.error("Failed to update progress");
    } finally {
      setPendingId(null);
    }
  };
  
  return {
    toggle,
    isPending: (id: Id<"lessons">) => pendingId === id,
  };
}
```

### Combined Query Hook

```tsx
// src/hooks/use-dashboard-data.ts
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useDashboardData() {
  const courses = useQuery(api.courses.listEnrolled);
  const stats = useQuery(api.stats.getUserStats);
  const recentActivity = useQuery(api.activity.getRecent);
  
  const isLoading = 
    courses === undefined || 
    stats === undefined || 
    recentActivity === undefined;
  
  return {
    isLoading,
    courses: courses ?? [],
    stats: stats ?? { completedCourses: 0, totalHours: 0, streak: 0 },
    recentActivity: recentActivity ?? [],
  };
}
```

## Optimistic Updates

### Basic Optimistic Update

```tsx
"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

export function LikeButton({ lessonId }: { lessonId: Id<"lessons"> }) {
  const lesson = useQuery(api.lessons.get, { id: lessonId });
  const toggleLike = useMutation(api.lessons.toggleLike);
  
  // Local optimistic state
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  
  const isLiked = optimisticLiked ?? lesson?.isLiked ?? false;
  
  const handleToggle = async () => {
    const newValue = !isLiked;
    setOptimisticLiked(newValue); // Optimistic update
    
    try {
      await toggleLike({ lessonId });
    } catch (error) {
      setOptimisticLiked(null); // Revert on error
      toast.error("Failed to update");
    } finally {
      // Clear optimistic state after Convex updates
      setTimeout(() => setOptimisticLiked(null), 100);
    }
  };
  
  return (
    <Button variant={isLiked ? "default" : "outline"} onClick={handleToggle}>
      {isLiked ? "Liked" : "Like"}
    </Button>
  );
}
```

## React 19 Considerations

### Auto-Memoization

React 19 compiler automatically memoizes components and values. **Skip manual memoization unless:**

```tsx
// ❌ Unnecessary in React 19
const memoizedValue = useMemo(() => computeValue(data), [data]);
const memoizedCallback = useCallback(() => handleClick(), []);

// ✅ Let React 19 compiler handle it
const value = computeValue(data);
const handleClick = () => { /* ... */ };
```

### When Manual Memoization IS Needed

```tsx
// ✅ Keep useMemo for expensive computations (>1ms)
const sortedAndFilteredData = useMemo(() => {
  return data
    .filter(item => item.status === "active")
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 100);
}, [data]);

// ✅ Keep useMemo when value is in dependency array
const config = useMemo(() => ({ theme, locale }), [theme, locale]);
useEffect(() => {
  initializeApp(config);
}, [config]);

// ✅ Keep useCallback for native elements with expensive re-renders
<input onChange={useCallback((e) => setValue(e.target.value), [])} />
```

### useTransition for Non-Blocking Updates

```tsx
"use client";

import { useTransition } from "react";

export function SearchFilter({ onFilter }: { onFilter: (term: string) => void }) {
  const [isPending, startTransition] = useTransition();
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    startTransition(() => {
      onFilter(e.target.value); // Non-blocking update
    });
  };
  
  return (
    <div className="relative">
      <Input onChange={handleChange} placeholder="Search..." />
      {isPending && (
        <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin" />
      )}
    </div>
  );
}
```
