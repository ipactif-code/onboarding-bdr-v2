# 🎯 CLAUDE CODE INTEGRATION INSTRUCTIONS
**Tasks:** T050 (User Dashboard) + Admin Dashboard (new)  
**Source:** Figma Make output  
**Date:** 2025-12-08  
**Project:** Onboarding BDR Team v2 LMS

---

## 📋 CONTEXT

We have two dashboard components from Figma Make:
1. **UserDashboard.tsx** - For BDR team members (course progress, continue watching)
2. **AdminDashboard.tsx** - For administrators (KPIs, user table, quick actions)

Both include the sidebar and header, but we already have those (T028). We only need to extract the **content area** and integrate with Convex hooks.

---

## 🏗️ ARCHITECTURE

```
src/app/(dashboard)/page.tsx          → Detects role, renders correct dashboard
src/components/dashboard/
├── user-dashboard.tsx                → User content (T050)
├── admin-dashboard.tsx               → Admin content (new)
├── stats-card.tsx                    → Reusable stat card component
├── course-card.tsx                   → Course card with progress (T051)
├── continue-watching.tsx             → Continue watching section (T053)
└── recent-users-table.tsx            → Admin users table
```

---

## 🔧 IMPLEMENTATION

### File 1: `src/app/(dashboard)/page.tsx`

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { UserDashboard } from "@/components/dashboard/user-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function DashboardPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  // Get user from Convex to check role
  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  
  if (!user) {
    redirect("/sign-in");
  }

  const isAdmin = user.role === "admin";

  return isAdmin ? <AdminDashboard /> : <UserDashboard />;
}
```

---

### File 2: `src/components/dashboard/stats-card.tsx`

```tsx
import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: StatsCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-neutral-950">
          {title}
        </CardTitle>
        <Icon className="size-4 text-neutral-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-neutral-950">{value}</div>
        {(description || trend) && (
          <p className="text-xs text-neutral-500 mt-1">
            {trend && (
              <span className={cn(
                "font-medium",
                trend.positive ? "text-green-600" : "text-red-600"
              )}>
                {trend.positive ? "+" : ""}{trend.value}
              </span>
            )}
            {trend && description && " "}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### File 3: `src/components/dashboard/course-card.tsx` (T051)

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  progress?: number; // 0-100
  category?: string;
  lessonCount?: number;
  isCompleted?: boolean;
}

export function CourseCard({
  id,
  title,
  description,
  coverImage,
  progress,
  category,
  lessonCount,
  isCompleted,
}: CourseCardProps) {
  return (
    <Link href={`/courses/${id}`}>
      <Card className="group overflow-hidden hover:shadow-md transition-shadow">
        {/* Cover Image */}
        <div className="relative aspect-video bg-neutral-100 overflow-hidden rounded-t-xl">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={title}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600" />
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-sm text-neutral-950 line-clamp-1">
            {title}
          </h3>
          <p className="text-xs text-neutral-500 line-clamp-2">
            {description}
          </p>

          {/* Progress or Category */}
          {progress !== undefined ? (
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-2 flex-1" />
              <span className="text-xs text-neutral-500 whitespace-nowrap">
                {progress}% complete
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              {category && <span>{category}</span>}
              {category && lessonCount && <span>•</span>}
              {lessonCount && <span>{lessonCount} lessons</span>}
            </div>
          )}

          {isCompleted && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              Completed
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
```

---

### File 4: `src/components/dashboard/continue-watching.tsx` (T053)

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

interface ContinueWatchingItem {
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  courseTitle: string;
  coverImage?: string;
  progress: number;
  timeLeft?: string;
}

interface ContinueWatchingProps {
  items: ContinueWatchingItem[];
}

export function ContinueWatching({ items }: ContinueWatchingProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-950">
          Continue watching
        </h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/courses">View all</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <Link
            key={item.lessonId}
            href={`/courses/${item.courseId}/lessons/${item.lessonId}`}
          >
            <Card className="group overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative aspect-video bg-neutral-100">
                {item.coverImage ? (
                  <Image
                    src={item.coverImage}
                    alt={item.lessonTitle}
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
                  <Progress value={item.progress} className="h-1 rounded-none" />
                </div>
              </div>

              <CardContent className="p-3">
                <h3 className="font-medium text-sm text-neutral-950 line-clamp-1">
                  {item.lessonTitle}
                </h3>
                <p className="text-xs text-neutral-500 line-clamp-1">
                  {item.courseTitle}
                </p>
                {item.timeLeft && (
                  <p className="text-xs text-neutral-400 mt-1">
                    {item.timeLeft} left
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

---

### File 5: `src/components/dashboard/user-dashboard.tsx` (T050)

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  CheckCircle, 
  BookOpen, 
  Target, 
  Trophy,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "./stats-card";
import { CourseCard } from "./course-card";
import { ContinueWatching } from "./continue-watching";

export function UserDashboard() {
  // Fetch user's courses and progress
  const courses = useQuery(api.courses.listForUser);
  const continueWatching = useQuery(api.progress.getContinueWatching);
  
  // Calculate stats
  const completedCourses = courses?.filter(c => c.progress === 100).length ?? 0;
  const inProgressCourses = courses?.filter(c => c.progress > 0 && c.progress < 100).length ?? 0;
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

      {/* Continue Watching */}
      {continueWatching && continueWatching.length > 0 && (
        <>
          <Separator />
          <ContinueWatching 
            items={continueWatching.map(item => ({
              lessonId: item.lessonId,
              courseId: item.courseId,
              lessonTitle: item.lessonTitle,
              courseTitle: item.courseTitle,
              coverImage: item.coverImage,
              progress: item.progress,
              timeLeft: item.timeLeft,
            }))}
          />
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
            .filter(c => c.progress < 100)
            .slice(0, 8)
            .map((course) => (
              <CourseCard
                key={course._id}
                id={course._id}
                title={course.title}
                description={course.description}
                coverImage={course.coverImage}
                progress={course.progress}
              />
            ))}
        </div>

        {courses.filter(c => c.progress < 100).length === 0 && (
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
```

---

### File 6: `src/components/dashboard/recent-users-table.tsx`

```tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  team?: string;
  coursesCompleted: number;
  totalCourses: number;
  role: "user" | "team_lead" | "admin";
}

interface RecentUsersTableProps {
  users: User[];
}

const roleConfig = {
  user: { label: "User", className: "bg-neutral-100 text-neutral-900" },
  team_lead: { label: "Team Lead", className: "bg-neutral-100 text-neutral-900" },
  admin: { label: "Administrator", className: "bg-neutral-900 text-neutral-50" },
};

export function RecentUsersTable({ users }: RecentUsersTableProps) {
  return (
    <div className="rounded-lg border border-neutral-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Completed</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="w-[64px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const progress = Math.round(
              (user.coursesCompleted / user.totalCourses) * 100
            );
            const role = roleConfig[user.role];

            return (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>
                        {user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-neutral-500">{user.email}</TableCell>
                <TableCell className="text-neutral-500">
                  {user.team || "—"}
                </TableCell>
                <TableCell>
                  {user.coursesCompleted}/{user.totalCourses}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500">{progress}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn("font-semibold", role.className)}>
                    {role.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View profile</DropdownMenuItem>
                      <DropdownMenuItem>Send message</DropdownMenuItem>
                      <DropdownMenuItem>Edit role</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

### File 7: `src/components/dashboard/admin-dashboard.tsx`

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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
  const analytics = useQuery(api.analytics.getOverview);
  const users = useQuery(api.users.list, { limit: 5 });
  
  // Loading state
  if (analytics === undefined || users === undefined) {
    return <AdminDashboardSkeleton />;
  }

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
          title="Active Courses"
          value={analytics.activeCourses}
          icon={BookOpen}
          trend={{ value: "3", positive: true }}
          description="new this month"
        />
        <StatsCard
          title="Completion Rate"
          value={`${analytics.completionRate}%`}
          icon={CheckCircle}
          trend={{ value: "8%", positive: true }}
          description="from last month"
        />
        <StatsCard
          title="Avg. Quiz Score"
          value={`${analytics.avgQuizScore}%`}
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
          users={users.map((user) => ({
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatarUrl,
            team: user.teamName,
            coursesCompleted: user.coursesCompleted ?? 0,
            totalCourses: user.totalCourses ?? 0,
            role: user.role as "user" | "team_lead" | "admin",
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
```

---

## ✅ SUCCESS CRITERIA

- [ ] Dashboard page detects user role and renders correct component
- [ ] User Dashboard shows:
  - [ ] 4 stats cards with real data from Convex
  - [ ] Continue watching section (if any in-progress lessons)
  - [ ] Course grid with progress bars
  - [ ] Empty state when all courses completed
- [ ] Admin Dashboard shows:
  - [ ] 4 stats cards with analytics data
  - [ ] Quick action buttons
  - [ ] Recent users table with roles and progress
- [ ] Loading skeletons display during data fetch
- [ ] All components use Shadcn UI (Card, Badge, Table, Progress, Avatar)
- [ ] Lucide icons replace Figma SVG paths
- [ ] Responsive layout (mobile, tablet, desktop)

---

## 📦 SHADCN COMPONENTS USED

Already installed:
- Card, CardHeader, CardContent, CardTitle
- Badge
- Button
- Table, TableHeader, TableBody, TableRow, TableHead, TableCell
- Progress
- Avatar, AvatarImage, AvatarFallback
- Separator
- Skeleton
- DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem

---

## ⚠️ NOTES

1. **Sidebar/Header removed** - Already implemented in T028 layout
2. **Figma images replaced** - Use Next.js Image with placeholder gradients
3. **SVG icons replaced** - Use Lucide React icons
4. **Convex hooks** - useQuery for real-time data
5. **Role detection** - Server-side in page.tsx for security

---

**End of Instructions**
