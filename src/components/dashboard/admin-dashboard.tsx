"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Users,
  BookOpen,
  CheckCircle,
  TrendingUp,
  ArrowRight,
  Plus
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "./stats-card";
import { RecentUsersTable } from "./recent-users-table";

export function AdminDashboard() {
  // Fetch analytics overview
  const analytics = useQuery(api.analytics.getOverview, {});
  const usersResult = useQuery(api.users.list, { pageSize: 5 });

  // Loading state
  if (analytics === undefined || usersResult === undefined) {
    return <AdminDashboardSkeleton />;
  }

  // Calculate completion rate from analytics data
  const completionRate = analytics.totalLessonsCompleted > 0
    ? Math.round((analytics.totalLessonsCompleted / (analytics.totalUsers * 10)) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-neutral-950">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/courses/new">
              <Plus className="size-4 mr-2" />
              New Course
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Users"
          value={analytics.totalUsers}
          icon={Users}
          trend={{ value: "12%", positive: true }}
          description="from last month"
        />
        <StatsCard
          title="Published Courses"
          value={analytics.publishedCourses}
          icon={BookOpen}
          trend={{ value: "3", positive: true }}
          description="new this month"
        />
        <StatsCard
          title="Lessons Completed"
          value={analytics.totalLessonsCompleted}
          icon={CheckCircle}
          trend={{ value: "8%", positive: true }}
          description="from last month"
        />
        <StatsCard
          title="Avg. Quiz Score"
          value={`${analytics.averageQuizScore}%`}
          icon={TrendingUp}
          trend={{ value: "5%", positive: true }}
          description="from last month"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button variant="outline" className="h-auto py-4 justify-start" asChild>
          <Link href="/admin/courses">
            <BookOpen className="size-5 mr-3 text-blue-600" />
            <div className="text-left">
              <p className="font-medium">Manage Courses</p>
              <p className="text-xs text-neutral-500">Create, edit, publish</p>
            </div>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 justify-start" asChild>
          <Link href="/admin/teams">
            <Users className="size-5 mr-3 text-green-600" />
            <div className="text-left">
              <p className="font-medium">Manage Teams</p>
              <p className="text-xs text-neutral-500">Teams and members</p>
            </div>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 justify-start" asChild>
          <Link href="/admin/analytics">
            <TrendingUp className="size-5 mr-3 text-purple-600" />
            <div className="text-left">
              <p className="font-medium">View Analytics</p>
              <p className="text-xs text-neutral-500">Detailed reports</p>
            </div>
          </Link>
        </Button>
      </div>

      {/* Recent Users */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-neutral-950">
            Recent Users
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/users" className="flex items-center gap-1">
              View all <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <Separator />

        <RecentUsersTable
          users={usersResult.data.map((user) => ({
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatarUrl,
            team: user.teamCount > 0 ? `${user.teamCount} team(s)` : undefined,
            progress: user.overallProgress,
            role: user.role,
          }))}
        />
      </section>
    </div>
  );
}

function AdminDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  );
}
