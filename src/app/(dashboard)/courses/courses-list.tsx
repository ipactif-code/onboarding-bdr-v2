"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../convex/_generated/api").api;
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseCard } from "@/components/courses/course-card";

type StatusFilter = "all" | "not-started" | "in-progress" | "completed";

export function CoursesList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");

  // Fetch user's assigned courses with progress
  const courses = useQuery(api.courses.listForUser, {});

  // Fetch tags for filter
  const tags = useQuery(api.tags.list, {});

  // Filter courses based on search, status, and tag
  const filteredCourses = useMemo(() => {
    if (!courses) return [];

    return courses.filter((course: {
      title: string;
      description?: string;
      progress: { percentage: number };
      tags?: Array<{ _id: string }>;
    }) => {
      // Search filter
      const matchesSearch =
        !search ||
        course.title.toLowerCase().includes(search.toLowerCase()) ||
        course.description?.toLowerCase().includes(search.toLowerCase());

      // Status filter
      let matchesStatus = true;
      if (statusFilter === "not-started") {
        matchesStatus = course.progress.percentage === 0;
      } else if (statusFilter === "in-progress") {
        matchesStatus = course.progress.percentage > 0 && course.progress.percentage < 100;
      } else if (statusFilter === "completed") {
        matchesStatus = course.progress.percentage === 100;
      }

      // Tag filter - course.tags is array of { _id, name }
      const matchesTag =
        tagFilter === "all" ||
        course.tags?.some((tag: { _id: string }) => tag._id === tagFilter);

      return matchesSearch && matchesStatus && matchesTag;
    });
  }, [courses, search, statusFilter, tagFilter]);

  const isLoading = courses === undefined || tags === undefined;

  if (isLoading) {
    return <CoursesListSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-semibold text-foreground">Courses</h1>

      {/* Filters Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side - Selects */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          {/* Status Select */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not-started">Not Started</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          {/* Tag Select */}
          <Select
            value={tagFilter}
            onValueChange={(v) => setTagFilter(v as string)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {tags?.map((tag: { _id: string; name: string }) => (
                <SelectItem key={tag._id} value={tag._id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Right side - Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Courses Grid */}
      {filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            {search || statusFilter !== "all" || tagFilter !== "all"
              ? "No courses match your filters."
              : "No courses available."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCourses.map((course: {
            _id: string;
            title: string;
            coverImageUrl?: string;
            progress: { totalLessons: number; percentage: number };
          }) => (
            <CourseCard
              key={course._id}
              id={course._id}
              title={course.title}
              coverImage={course.coverImageUrl}
              lessonsCount={course.progress.totalLessons}
              progress={course.progress.percentage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CoursesListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <Skeleton className="h-8 w-32" />

      {/* Filters skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          <Skeleton className="h-10 w-full sm:w-[180px]" />
          <Skeleton className="h-10 w-full sm:w-[180px]" />
        </div>
        <Skeleton className="h-10 w-full sm:w-80" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-video rounded-xl" />
        ))}
      </div>
    </div>
  );
}
