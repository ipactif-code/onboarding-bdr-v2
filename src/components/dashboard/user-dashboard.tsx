"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CheckCircle, BookOpen, Target, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "./stats-card";
import { CourseSection } from "@/components/courses/course-section";

export function UserDashboard() {
  const courses = useQuery(api.courses.listForUser);
  const stats = useQuery(api.analytics.getUserDashboardStats);

  const completedCourses =
    courses?.filter((c) => c.progress.percentage === 100).length ?? 0;
  const totalCourses = courses?.length ?? 0;

  // Courses in progress (started but not completed)
  const inProgressCourses =
    courses
      ?.filter((c) => c.progress.percentage > 0 && c.progress.percentage < 100)
      .map((course) => ({
        _id: course._id,
        title: course.title,
        coverImage: course.coverImageUrl,
        progress: course.progress.percentage,
        lessonsCount: course.progress.totalLessons,
      })) ?? [];

  // Latest courses (sorted by displayOrder)
  const latestCourses =
    courses
      ?.slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, 10)
      .map((course) => ({
        _id: course._id,
        title: course.title,
        coverImage: course.coverImageUrl,
        lessonsCount: course.progress.totalLessons,
      })) ?? [];

  if (courses === undefined || stats === undefined) {
    return <UserDashboardSkeleton />;
  }

  // Format trend for display
  const formatTrend = (value: number): { value: string; positive: boolean } => {
    if (value === 0) return { value: "0", positive: true };
    const isPositive = value > 0;
    return {
      value: `${isPositive ? "+" : ""}${value}`,
      positive: isPositive,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Lessons Completed"
          value={stats.lessonsCompleted}
          icon={CheckCircle}
          trend={formatTrend(stats.lessonsCompletedTrend)}
          description="from last month"
        />
        <StatsCard
          title="Courses to Complete"
          value={totalCourses - completedCourses}
          icon={BookOpen}
          description={`${completedCourses} completed`}
        />
        <StatsCard
          title="Quiz Success Rate"
          value={`${stats.quizSuccessRate}%`}
          icon={Target}
          trend={formatTrend(stats.quizSuccessRateTrend)}
          description="from last month"
        />
        <StatsCard
          title="Global Ranking"
          value={`${stats.globalRanking}/${stats.totalRankedUsers}`}
          icon={Trophy}
          trend={
            stats.rankingTrend !== 0
              ? formatTrend(-stats.rankingTrend)
              : undefined
          }
          description={`${stats.totalPoints} total points`}
        />
      </div>

      {/* Continue where you left off */}
      {inProgressCourses.length > 0 && (
        <CourseSection
          title="Continue where you left off"
          courses={inProgressCourses}
          showProgress
        />
      )}

      {/* Latest courses */}
      {latestCourses.length > 0 && (
        <CourseSection title="Latest courses" courses={latestCourses} />
      )}
    </div>
  );
}

function UserDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <Skeleton className="h-9 w-48" />

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[140px] rounded-xl" />
        ))}
      </div>

      {/* Course sections skeleton */}
      {[1, 2].map((section) => (
        <div key={section} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <div className="flex gap-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-px w-full" />
          <div className="flex gap-6">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex flex-col w-80 shrink-0">
                <Skeleton className="h-[180px] w-full rounded-t-xl" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-24" />
                  {section === 1 && <Skeleton className="h-1 w-full" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
