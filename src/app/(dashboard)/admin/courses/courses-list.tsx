"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Id } from "../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CoursesTable } from "@/components/admin/courses-table";
import { toast } from "sonner";

type CourseStatus = "published" | "draft";

export function CoursesList(): ReactElement {
  const [status, setStatus] = useState<CourseStatus | undefined>(undefined);
  const [search, setSearch] = useState("");

  // Fetch courses with filter
  const courses = useQuery(api.courses.list, {
    status,
    search: search || undefined,
  });

  // Mutations
  const publishCourse = useMutation(api.courses.publish);
  const unpublishCourse = useMutation(api.courses.unpublish);
  const removeCourse = useMutation(api.courses.remove);

  // Handlers
  const handlePublish = async (courseId: Id<"courses">): Promise<void> => {
    try {
      await publishCourse({ courseId });
      toast.success("Course published");
    } catch (_error) {
      toast.error(
        _error instanceof Error ? _error.message : "Failed to publish course"
      );
    }
  };

  const handleUnpublish = async (courseId: Id<"courses">): Promise<void> => {
    try {
      await unpublishCourse({ courseId });
      toast.success("Course unpublished");
    } catch (_error) {
      toast.error(
        _error instanceof Error ? _error.message : "Failed to unpublish course"
      );
    }
  };

  const handleDelete = async (courseId: Id<"courses">): Promise<void> => {
    try {
      await removeCourse({ courseId });
      toast.success("Course deleted");
    } catch (_error) {
      toast.error(
        _error instanceof Error ? _error.message : "Failed to delete course"
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header - Title only */}
      <h1 className="text-2xl font-semibold text-foreground">Courses</h1>

      {/* Filters Row - Tabs + Search + Action Button */}
      <div className="flex items-center justify-between gap-4">
        {/* Status Tabs */}
        <Tabs
          value={status ?? "all"}
          onValueChange={(v) =>
            setStatus(v === "all" ? undefined : (v as CourseStatus))
          }
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="draft">Drafts</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search + Action Button */}
        <div className="flex items-center gap-3">
          <div className="relative w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button nativeButton={false} render={<Link href="/admin/courses/new" />}>
            <Plus className="size-4" data-icon="inline-start" />
            New
          </Button>
        </div>
      </div>

      {/* Table */}
      {courses === undefined ? (
        <TableSkeleton />
      ) : (
        <CoursesTable
          courses={courses}
          onPublish={handlePublish}
          onUnpublish={handleUnpublish}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function TableSkeleton(): ReactElement {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
