"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  CheckCircle,
  BookOpen,
  Target,
  Trophy,
  ArrowRight,
  Play
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatsCard } from "./stats-card";
import { CourseCard } from "./course-card";

export function UserDashboard() {
  // Fetch user's courses and progress
  const courses = useQuery(api.courses.listForUser);
  const continueWatching = useQuery(api.progress.getContinueWatching);

  // Calculate stats
  const completedCourses = courses?.filter(c => c.progress.percentage === 100).length ?? 0;
  const totalCourses = courses?.length ?? 0;

  // Loading state
  if (courses === undefined) {
    return <UserDashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-neutral-950">Dashboard</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Completed Courses"
          value={completedCourses}
          icon={CheckCircle}
          trend={{ value: "20.1%", positive: true }}
          description="from last month"
        />
        <StatsCard
          title="Courses to Complete"
          value={totalCourses - completedCourses}
          icon={BookOpen}
          trend={{ value: "5", positive: true }}
          description="new this month"
        />
        <StatsCard
          title="Quiz Success Rate"
          value="94%"
          icon={Target}
          trend={{ value: "19%", positive: true }}
          description="from last month"
        />
        <StatsCard
          title="Quiz Ranking"
          value="5/30"
          icon={Trophy}
          description="in your team"
        />
      </div>

      {/* Continue Watching - Single item card */}
      {continueWatching && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-neutral-950">
              Continue where you left off
            </h2>

            <Link
              href={`/courses/${continueWatching.course._id}/lessons/${continueWatching.lesson._id}`}
            >
              <Card className="group overflow-hidden hover:shadow-md transition-shadow max-w-md">
                <div className="relative aspect-video bg-neutral-100">
                  {continueWatching.course.coverImageUrl ? (
                    <Image
                      src={continueWatching.course.coverImageUrl}
                      alt={continueWatching.lesson.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600" />
                  )}

                  {/* Play overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="size-12 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="size-6 text-neutral-900 ml-1" />
                    </div>
                  </div>

                  {/* Progress bar at bottom */}
                  <div className="absolute bottom-0 left-0 right-0">
                    <Progress
                      value={continueWatching.progress.percentage}
                      className="h-1 rounded-none"
                    />
                  </div>
                </div>

                <CardContent className="p-3">
                  <h3 className="font-medium text-sm text-neutral-950 line-clamp-1">
                    {continueWatching.lesson.title}
                  </h3>
                  <p className="text-xs text-neutral-500 line-clamp-1">
                    {continueWatching.course.title} • {continueWatching.lesson.sectionTitle}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {continueWatching.progress.completedLessons}/{continueWatching.progress.totalLessons} lessons completed
                  </p>
                </CardContent>
              </Card>
            </Link>
          </section>
        </>
      )}

      {/* My Courses to Complete */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-neutral-950">
            My courses to complete
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/courses" className="flex items-center gap-1">
              View all <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {courses
            .filter(c => c.progress.percentage < 100)
            .slice(0, 8)
            .map((course) => (
              <CourseCard
                key={course._id}
                id={course._id}
                title={course.title}
                description={course.description}
                coverImage={course.coverImageUrl}
                progress={course.progress.percentage}
              />
            ))}
        </div>

        {courses.filter(c => c.progress.percentage < 100).length === 0 && (
          <div className="text-center py-12 text-neutral-500">
            <CheckCircle className="size-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">All courses completed!</p>
            <p className="text-sm">Great job! Check back later for new courses.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function UserDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-9 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[280px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
