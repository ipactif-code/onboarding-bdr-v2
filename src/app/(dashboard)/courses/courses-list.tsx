"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CourseSection } from "@/components/courses/course-section";
import { CourseFilters } from "@/components/courses/course-filters";
import { Skeleton } from "@/components/ui/skeleton";

export function CoursesList() {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Fetch user's assigned courses with progress
  const myCoursesData = useQuery(api.courses.listForUser, {});

  // Fetch all published courses (for recent courses section)
  const allCoursesData = useQuery(api.courses.list, {
    status: "published",
    search: search || undefined,
    tagId: selectedTag ? (selectedTag as never) : undefined,
  });

  const isLoading = myCoursesData === undefined || allCoursesData === undefined;

  // Filter my courses by search
  const filteredMyCourses = myCoursesData?.filter((course) => {
    if (!search) return true;
    return (
      course.title.toLowerCase().includes(search.toLowerCase()) ||
      course.description?.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Get courses with progress < 100% for "My courses to complete"
  const coursesToComplete = filteredMyCourses?.filter(
    (course) => course.progress.percentage < 100
  );

  // Get recently published courses (sorted by creation time)
  const recentCourses = allCoursesData
    ?.slice()
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Title + Search + Filter */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">
          Courses
        </h1>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* Filter Button */}
          <CourseFilters
            open={showFilters}
            onOpenChange={setShowFilters}
            selectedTag={selectedTag}
            onTagChange={setSelectedTag}
          />
        </div>
      </div>

      {/* Course Sections */}
      {isLoading ? (
        <CoursesListSkeleton />
      ) : (
        <div className="flex flex-col gap-8">
          {/* My courses to complete */}
          {coursesToComplete && coursesToComplete.length > 0 && (
            <CourseSection
              title="My courses to complete"
              courses={coursesToComplete.map((course) => ({
                _id: course._id,
                title: course.title,
                description: course.description,
                coverImage: course.coverImageUrl,
                progress: course.progress.percentage,
              }))}
              showProgress
            />
          )}

          {/* The last courses */}
          {recentCourses && recentCourses.length > 0 && (
            <CourseSection
              title="The last courses"
              courses={recentCourses.map((course) => ({
                _id: course._id,
                title: course.title,
                description: course.description,
                coverImage: course.coverImageUrl,
              }))}
            />
          )}

          {/* Empty state */}
          {!coursesToComplete?.length && !recentCourses?.length && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-neutral-500">No courses available yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CoursesListSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {/* Section skeleton */}
      {[1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-px w-full" />
          <div className="flex gap-6">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex flex-col gap-3 w-[278px]">
                <Skeleton className="h-[177px] w-full rounded-xl" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-32" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
