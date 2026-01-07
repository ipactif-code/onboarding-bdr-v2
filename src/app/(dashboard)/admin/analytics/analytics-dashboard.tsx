"use client";

import type { ReactElement } from "react";
import { useMemo } from "react";
import { useQuery } from "convex/react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;
import {
  Users,
  BookOpen,
  CheckCircle,
  Trophy,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Label,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// ============================================
// KPI Card Component
// ============================================

interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

function KPICard({ title, value, description, icon, trend }: KPICardProps): ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className={`flex items-center gap-1 text-xs mt-2 ${
            trend.isPositive ? "text-green-600" : "text-red-600"
          }`}>
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{trend.value}% from last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KPICardSkeleton(): ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-32 mt-2" />
      </CardContent>
    </Card>
  );
}

// ============================================
// Chart Configs
// ============================================

const activityChartConfig = {
  sessions: {
    label: "Sessions",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const courseChartConfig = {
  completionRate: {
    label: "Completion Rate",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const quizPassChartConfig = {
  passed: {
    label: "Passed",
    color: "var(--chart-2)",
  },
  failed: {
    label: "Failed",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const scoreDistributionConfig = {
  count: {
    label: "Attempts",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

// ============================================
// Helper Functions
// ============================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================
// Main Page Component
// ============================================

export function AnalyticsDashboard(): ReactElement {
  // Fetch all analytics data
  const overview = useQuery(api.analytics.getOverview, {});
  const sessionStats = useQuery(api.analytics.getSessionStats, {});
  const courseMetrics = useQuery(api.analytics.getCourseMetrics, {});
  const quizMetrics = useQuery(api.analytics.getQuizMetrics, {});

  // Transform data for charts
  const activityData = useMemo(() => {
    if (!sessionStats?.dailySessionCounts) return [];
    return sessionStats.dailySessionCounts
      .slice(-14) // Last 14 days
      .map((d: { date: string; count: number }) => ({
        date: formatDate(d.date),
        sessions: d.count,
      }));
  }, [sessionStats]);

  const courseData = useMemo(() => {
    if (!courseMetrics) return [];
    return courseMetrics
      .filter((c: { status: string }) => c.status === "published")
      .slice(0, 6) // Top 6 courses
      .map((c: { title: string; completionRate: number }) => ({
        course: c.title.length > 20 ? c.title.slice(0, 20) + "..." : c.title,
        completionRate: c.completionRate,
      }));
  }, [courseMetrics]);

  const quizPassData = useMemo(() => {
    if (!quizMetrics) return [];
    const passed = quizMetrics.passRate;
    const failed = 100 - passed;
    return [
      { status: "passed", value: passed, fill: "var(--color-passed)" },
      { status: "failed", value: failed, fill: "var(--color-failed)" },
    ];
  }, [quizMetrics]);

  const scoreDistributionData = useMemo(() => {
    if (!quizMetrics?.scoreDistribution) return [];
    return quizMetrics.scoreDistribution.map((d: { range: string; count: number }) => ({
      range: d.range,
      count: d.count,
    }));
  }, [quizMetrics]);

  const isLoading = !overview || !sessionStats || !courseMetrics || !quizMetrics;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Monitor your team&apos;s training progress and performance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              title="Total Users"
              value={overview.totalUsers}
              description={`${overview.activeUsers} active`}
              icon={<Users className="h-5 w-5" />}
            />
            <KPICard
              title="Published Courses"
              value={overview.publishedCourses}
              description={`${overview.totalCourses} total`}
              icon={<BookOpen className="h-5 w-5" />}
            />
            <KPICard
              title="Lessons Completed"
              value={overview.totalLessonsCompleted}
              icon={<CheckCircle className="h-5 w-5" />}
            />
            <KPICard
              title="Avg Quiz Score"
              value={`${overview.averageQuizScore}%`}
              description={`${overview.totalQuizAttempts} attempts`}
              icon={<Trophy className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Activity Area Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Activity</CardTitle>
            <CardDescription>Sessions over the last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : activityData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No activity data available
              </div>
            ) : (
              <ChartContainer config={activityChartConfig} className="h-[200px] w-full">
                <AreaChart
                  accessibilityLayer
                  data={activityData}
                  margin={{ left: 12, right: 12 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Area
                    dataKey="sessions"
                    type="natural"
                    fill="var(--color-sessions)"
                    fillOpacity={0.4}
                    stroke="var(--color-sessions)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
          {!isLoading && sessionStats && (
            <CardFooter>
              <div className="flex w-full items-start gap-2 text-sm">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      Avg session: {formatDuration(sessionStats.averageSessionDuration)}
                    </span>
                  </div>
                </div>
              </div>
            </CardFooter>
          )}
        </Card>

        {/* Quiz Pass Rate Donut Chart */}
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>Quiz Pass Rate</CardTitle>
            <CardDescription>Overall quiz performance</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-[250px]">
                <Skeleton className="h-[200px] w-[200px] rounded-full" />
              </div>
            ) : quizMetrics.totalAttempts === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No quiz attempts yet
              </div>
            ) : (
              <ChartContainer
                config={quizPassChartConfig}
                className="mx-auto aspect-square max-h-[250px]"
              >
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Pie
                    data={quizPassData}
                    dataKey="value"
                    nameKey="status"
                    innerRadius={60}
                    strokeWidth={5}
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                y={viewBox.cy}
                                className="fill-foreground text-3xl font-bold"
                              >
                                {quizMetrics.passRate}%
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 24}
                                className="fill-muted-foreground"
                              >
                                Pass Rate
                              </tspan>
                            </text>
                          );
                        }
                        return null;
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
          {!isLoading && quizMetrics && (
            <CardFooter className="flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-4 w-4" />
                <span>{quizMetrics.totalAttempts} total attempts</span>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Course Completion Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Course Completion</CardTitle>
            <CardDescription>Completion rate by course</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : courseData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No course data available
              </div>
            ) : (
              <ChartContainer config={courseChartConfig} className="h-[250px] w-full">
                <BarChart
                  accessibilityLayer
                  data={courseData}
                  layout="vertical"
                  margin={{ left: 0, right: 20 }}
                >
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis
                    dataKey="course"
                    type="category"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    width={100}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`${value}%`, "Completion"]}
                  />
                  <Bar
                    dataKey="completionRate"
                    fill="var(--color-completionRate)"
                    radius={5}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Score Distribution Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
            <CardDescription>Quiz scores breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : scoreDistributionData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No score data available
              </div>
            ) : (
              <ChartContainer config={scoreDistributionConfig} className="h-[250px] w-full">
                <BarChart
                  accessibilityLayer
                  data={scoreDistributionData}
                  margin={{ left: 12, right: 12 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="range"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent />}
                  />
                  <Bar dataKey="count" fill="var(--color-count)" radius={5} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
          {!isLoading && quizMetrics && (
            <CardFooter>
              <div className="text-sm text-muted-foreground">
                Average score: {quizMetrics.averageScore}%
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
