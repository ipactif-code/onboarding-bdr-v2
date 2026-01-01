"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  Power,
  TrendingUp,
  Users,
  Mic,
  RefreshCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;

// ============================================
// Types
// ============================================

interface BudgetStatus {
  month: string;
  budgetCents: number;
  totalMinutesUsed: number;
  totalCostCents: number;
  percentUsed: number;
  isDisabled: boolean;
}

interface TopUser {
  userId: string;
  userName: string;
  minutesUsed: number;
  transcriptionCount: number;
  lastTranscriptionAt: number;
}

interface OpenAiCostsState {
  totalCost: number;
  buckets: Array<{ date: string; cost: number }>;
  lastSynced: Date;
}

// ============================================
// Helper Functions
// ============================================

function centsToFormatDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDollars(dollars: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}

function minutesToHoursFormat(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthStr: string | undefined): string {
  if (!monthStr) return "N/A";
  const parts = monthStr.split("-");
  const year = parts[0] ?? "2024";
  const month = parts[1] ?? "1";
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatDateLabel(dateStr: string): string {
  // Input: "2025-12-15", Output: "Dec 15"
  const parts = dateStr.split("-");
  const year = parseInt(parts[0] ?? "2024");
  const month = parseInt(parts[1] ?? "1") - 1;
  const day = parseInt(parts[2] ?? "1");
  const date = new Date(year, month, day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================
// Chart Config
// ============================================

const usageChartConfig = {
  usedCents: {
    label: "Cost",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

// ============================================
// KPI Card Component
// ============================================

interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  variant?: "default" | "warning" | "critical";
}

function KPICard({ title, value, description, icon, variant = "default" }: KPICardProps): React.JSX.Element {
  return (
    <Card className={cn(
      variant === "warning" && "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20",
      variant === "critical" && "border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
    )}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn(
          "text-muted-foreground",
          variant === "warning" && "text-yellow-600 dark:text-yellow-500",
          variant === "critical" && "text-red-600 dark:text-red-500"
        )}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-2xl font-bold",
          variant === "warning" && "text-yellow-700 dark:text-yellow-400",
          variant === "critical" && "text-red-700 dark:text-red-400"
        )}>
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function KPICardSkeleton(): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-32 mt-2" />
      </CardContent>
    </Card>
  );
}

// ============================================
// Budget Overview Card
// ============================================

interface BudgetOverviewCardProps {
  status: BudgetStatus;
  openAiSpendDollars: number;
  budgetLimitDollars: number;
  lastSynced: Date | null;
}

function BudgetOverviewCard({
  status,
  openAiSpendDollars,
  budgetLimitDollars,
  lastSynced,
}: BudgetOverviewCardProps): React.JSX.Element {
  // Calculate percentage based on OpenAI actual spend
  const percentUsed = budgetLimitDollars > 0
    ? Math.round((openAiSpendDollars / budgetLimitDollars) * 100)
    : 0;
  const remainingDollars = Math.max(0, budgetLimitDollars - openAiSpendDollars);

  const isWarning = percentUsed >= 80 && percentUsed < 100;
  const isCritical = percentUsed >= 100;

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" aria-hidden="true" />
          Budget Overview
        </CardTitle>
        <CardDescription>
          Current month: {formatMonthLabel(status.month ?? getCurrentMonth())}
          {lastSynced && (
            <span className="ml-2 text-xs">
              (Synced: {lastSynced.toLocaleTimeString()})
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Usage (from OpenAI)</span>
            <span className={cn(
              "font-medium",
              isWarning && "text-yellow-600 dark:text-yellow-500",
              isCritical && "text-red-600 dark:text-red-500"
            )}>
              {formatDollars(openAiSpendDollars)} / {formatDollars(budgetLimitDollars)}
            </span>
          </div>
          <Progress
            value={Math.min(percentUsed, 100)}
            aria-label="Budget usage"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(percentUsed, 100)}
            aria-valuetext={`${percentUsed}% of budget used`}
          >
            <ProgressTrack className="h-3">
              <ProgressIndicator
                className={cn(
                  isWarning && "bg-yellow-500",
                  isCritical && "bg-red-500"
                )}
              />
            </ProgressTrack>
          </Progress>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{percentUsed}% used</span>
            <span>{formatDollars(remainingDollars)} remaining</span>
          </div>
        </div>

        {/* Warning Alert */}
        {(isWarning || isCritical) && (
          <Alert variant={isCritical ? "destructive" : "default"} className={cn(
            isWarning && "border-yellow-500/50 text-yellow-700 dark:text-yellow-400"
          )}>
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>
              {isCritical ? "Budget Exceeded" : "Budget Warning"}
            </AlertTitle>
            <AlertDescription>
              {isCritical
                ? "You have exceeded your monthly transcription budget. Consider increasing the limit or disabling the service."
                : "You have used 80% or more of your monthly budget."}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Time Transcribed</p>
            <p className="text-xl font-semibold">
              {minutesToHoursFormat(status.totalMinutesUsed)}
            </p>
            <p className="text-xs text-muted-foreground">
              Estimate based on $0.006/min
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Actual Spend</p>
            <p className="text-xl font-semibold">
              {formatDollars(openAiSpendDollars)}
            </p>
            <p className="text-xs text-muted-foreground">
              From OpenAI API
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetOverviewSkeleton(): React.JSX.Element {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-3 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Service Toggle Card
// ============================================

function ServiceToggleCard({
  isEnabled,
  onToggle,
  isLoading
}: {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
  isLoading: boolean;
}): React.JSX.Element {
  const [showWarning, setShowWarning] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleToggle = async (checked: boolean): Promise<void> => {
    if (!checked && isEnabled) {
      // Show warning when disabling
      setShowWarning(true);
      return;
    }

    setIsPending(true);
    try {
      await onToggle(checked);
      toast.success(checked ? "Transcription service enabled" : "Transcription service disabled");
    } catch {
      toast.error("Failed to update service status");
    } finally {
      setIsPending(false);
      setShowWarning(false);
    }
  };

  const confirmDisable = async (): Promise<void> => {
    setIsPending(true);
    try {
      await onToggle(false);
      toast.success("Transcription service disabled");
    } catch {
      toast.error("Failed to disable service");
    } finally {
      setIsPending(false);
      setShowWarning(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Power className="h-5 w-5" aria-hidden="true" />
          Service Control
        </CardTitle>
        <CardDescription>
          Enable or disable the transcription service
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="service-toggle" className="text-base">
              Transcription Service
            </Label>
            <p className="text-sm text-muted-foreground">
              {isEnabled ? "Service is active" : "Service is disabled"}
            </p>
          </div>
          <Switch
            id="service-toggle"
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
        </div>

        {showWarning && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Confirm Disable</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                Disabling the transcription service will prevent all users from
                transcribing audio. Existing transcriptions will remain available.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={confirmDisable}
                  disabled={isPending}
                >
                  {isPending ? "Disabling..." : "Confirm Disable"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWarning(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Budget Settings Card
// ============================================

function BudgetSettingsCard({
  currentBudgetCents,
  onSave,
  isLoading
}: {
  currentBudgetCents: number;
  onSave: (budgetCents: number) => Promise<void>;
  isLoading: boolean;
}): React.JSX.Element {
  const [budgetDollars, setBudgetDollars] = useState(
    (currentBudgetCents / 100).toString()
  );
  const [isPending, setIsPending] = useState(false);

  const handleSave = async (): Promise<void> => {
    const dollars = parseFloat(budgetDollars);
    if (isNaN(dollars) || dollars < 0) {
      toast.error("Please enter a valid budget amount");
      return;
    }

    const cents = Math.round(dollars * 100);
    setIsPending(true);
    try {
      await onSave(cents);
      toast.success("Budget limit updated");
    } catch {
      toast.error("Failed to update budget limit");
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" aria-hidden="true" />
          Budget Settings
        </CardTitle>
        <CardDescription>
          Set the monthly transcription budget limit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="budget-input">Monthly Budget (USD)</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="budget-input"
                type="number"
                min="0"
                step="0.01"
                value={budgetDollars}
                onChange={(e) => setBudgetDollars(e.target.value)}
                className="pl-7"
                placeholder="100.00"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={isPending}
              aria-label="Save budget limit"
            >
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Current budget: {centsToFormatDollars(currentBudgetCents)} per month
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================
// Top Users Table
// ============================================

function TopUsersTable({
  users,
  isLoading
}: {
  users: TopUser[] | undefined;
  isLoading: boolean;
}): React.JSX.Element {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" aria-hidden="true" />
          Top Users Today
        </CardTitle>
        <CardDescription>
          Users with highest transcription usage today
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!users || users.length === 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            <Mic className="h-12 w-12 text-muted-foreground/50 mb-3" aria-hidden="true" />
            <p className="text-muted-foreground">No transcription activity today</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">User</TableHead>
                <TableHead scope="col" className="text-right">Minutes</TableHead>
                <TableHead scope="col" className="text-right">Count</TableHead>
                <TableHead scope="col" className="text-right">Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell className="font-medium">{user.userName}</TableCell>
                  <TableCell className="text-right">
                    {minutesToHoursFormat(user.minutesUsed)}
                  </TableCell>
                  <TableCell className="text-right">{user.transcriptionCount}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatRelativeTime(user.lastTranscriptionAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Usage History Chart
// ============================================

interface UsageHistoryChartProps {
  openAiBuckets: Array<{ date: string; cost: number }> | undefined;
  isLoading: boolean;
  lastSynced: Date | null;
}

function UsageHistoryChart({
  openAiBuckets,
  isLoading,
  lastSynced,
}: UsageHistoryChartProps): React.JSX.Element {
  // Transform OpenAI buckets into chart data
  // OpenAI buckets have format { date: "2025-12-15", cost: 1.23 }
  const chartData = useMemo(() => {
    if (!openAiBuckets || openAiBuckets.length === 0) return [];

    // Sort by date and format for display
    return openAiBuckets
      .slice() // Create a copy to avoid mutating original
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30) // Show last 30 days
      .map((bucket) => ({
        date: formatDateLabel(bucket.date),
        cost: bucket.cost, // Already in dollars from OpenAI
      }));
  }, [openAiBuckets]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" aria-hidden="true" />
          Daily Usage (from OpenAI)
        </CardTitle>
        <CardDescription>
          Actual daily costs from OpenAI API
          {lastSynced && (
            <span className="ml-2 text-xs">
              (Last synced: {lastSynced.toLocaleTimeString()})
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="h-[250px] flex items-center justify-center text-muted-foreground"
          >
            No usage data available. Click &quot;Sync with OpenAI&quot; to fetch data.
          </div>
        ) : (
          <ChartContainer config={usageChartConfig} className="h-[250px] w-full">
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 12, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
                formatter={(value) => [formatDollars(value as number), "Cost"]}
              />
              <Bar dataKey="cost" fill="var(--color-usedCents)" radius={5} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      {chartData.length > 0 && (
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Showing last {chartData.length} days of actual OpenAI usage
          </p>
        </CardFooter>
      )}
    </Card>
  );
}

// ============================================
// OpenAI Actual Costs Card
// ============================================

function OpenAiCostsCard({
  costs,
  onSync,
  isSyncing,
}: {
  costs: OpenAiCostsState | null;
  onSync: (showToast?: boolean) => Promise<void>;
  isSyncing: boolean;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" aria-hidden="true" />
            OpenAI Actual Costs
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSync(true)}
            disabled={isSyncing}
            aria-busy={isSyncing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} aria-hidden="true" />
            {isSyncing ? "Syncing..." : "Sync with OpenAI"}
          </Button>
        </CardTitle>
        {costs?.lastSynced && (
          <CardDescription>
            Last synced: {costs.lastSynced.toLocaleTimeString()}
            <span className="ml-2 text-xs opacity-75">(auto-synced on load)</span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {costs ? (
          <div className="space-y-2">
            <p className="text-2xl font-bold">{formatDollars(costs.totalCost)}</p>
            <p className="text-sm text-muted-foreground">
              Last 30 days actual OpenAI spend
            </p>
          </div>
        ) : isSyncing ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (
          <p className="text-muted-foreground">
            Click &quot;Sync with OpenAI&quot; to fetch actual costs
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Main Dashboard Component
// ============================================

export function BudgetDashboard(): React.JSX.Element {
  // Fetch data from Convex (for settings and internal tracking only)
  const budgetStatus = useQuery(api.admin.transcriptionBudget.getBudgetStatus, {});
  const topUsers = useQuery(api.admin.transcriptionBudget.getTopUsersToday, {});

  // Mutations
  const setBudgetLimit = useMutation(api.admin.transcriptionBudget.setBudgetLimit);
  const toggleService = useMutation(api.admin.transcriptionBudget.toggleTranscriptionService);

  // Action for OpenAI sync
  const fetchOpenAICosts = useAction(api.admin.openaiUsage.fetchOpenAICosts);

  // OpenAI costs state
  const [openAiCosts, setOpenAiCosts] = useState<OpenAiCostsState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasInitialSynced, setHasInitialSynced] = useState(false);

  // Sync handler
  const handleSyncOpenAI = useCallback(async (showToast = true) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      // Let the backend use its default date range (last 30 days)
      // This ensures we capture costs from the previous month as well
      const result = await fetchOpenAICosts({});
      setOpenAiCosts({
        totalCost: result.totalCost,
        buckets: result.buckets,
        lastSynced: new Date(),
      });
      if (showToast) {
        toast.success("Synced with OpenAI");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to sync with OpenAI";
      setSyncError(errorMessage);
      if (showToast) {
        toast.error(errorMessage);
      }
    } finally {
      setIsSyncing(false);
      setHasInitialSynced(true);
    }
  }, [fetchOpenAICosts]);

  // Auto-sync on page load
  useEffect(() => {
    handleSyncOpenAI(false); // Don't show toast on initial load
  }, [handleSyncOpenAI]);

  // Loading states: show skeleton if Convex data not loaded OR initial OpenAI sync in progress
  const isLoading = budgetStatus === undefined || (isSyncing && !hasInitialSynced);

  // Derive values from OpenAI data (primary source of truth for costs)
  // Use OpenAI costs when available, fall back to internal estimates only if OpenAI sync failed
  const openAiSpendDollars = openAiCosts?.totalCost ?? 0;
  const budgetLimitDollars = (budgetStatus?.budgetCents ?? 0) / 100;
  const percentUsed = budgetLimitDollars > 0
    ? Math.round((openAiSpendDollars / budgetLimitDollars) * 100)
    : 0;
  const isServiceEnabled = budgetStatus ? !budgetStatus.isDisabled : false;

  const getUsageVariant = (): "default" | "warning" | "critical" => {
    if (percentUsed >= 100) return "critical";
    if (percentUsed >= 80) return "warning";
    return "default";
  };

  return (
    <main>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold">Transcription Budget</h1>
          <p className="text-muted-foreground">
            Monitor and manage transcription service usage and costs
          </p>
        </div>

        {/* Sync Error Alert */}
        {syncError && !isSyncing && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Failed to Load OpenAI Data</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{syncError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSyncOpenAI(true)}
                className="ml-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

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
                title="Monthly Budget"
                value={formatDollars(budgetLimitDollars)}
                description="Maximum spend this month"
                icon={<DollarSign className="h-5 w-5" aria-hidden="true" />}
              />
              <KPICard
                title="Current Spend"
                value={formatDollars(openAiSpendDollars)}
                description={`${percentUsed}% of budget (from OpenAI)`}
                icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
                variant={getUsageVariant()}
              />
              <KPICard
                title="Time Transcribed"
                value={minutesToHoursFormat(budgetStatus.totalMinutesUsed)}
                description="Estimate based on $0.006/min"
                icon={<Clock className="h-5 w-5" aria-hidden="true" />}
              />
              <KPICard
                title="Service Status"
                value={isServiceEnabled ? "Active" : "Disabled"}
                description={isServiceEnabled ? "Accepting requests" : "Service paused"}
                icon={<Power className="h-5 w-5" aria-hidden="true" />}
                variant={isServiceEnabled ? "default" : "warning"}
              />
            </>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Budget Overview - Takes 2 columns */}
          {isLoading ? (
            <BudgetOverviewSkeleton />
          ) : (
            <BudgetOverviewCard
              status={budgetStatus}
              openAiSpendDollars={openAiSpendDollars}
              budgetLimitDollars={budgetLimitDollars}
              lastSynced={openAiCosts?.lastSynced ?? null}
            />
          )}

          {/* Service Toggle and Budget Settings - 1 column */}
          <div className="space-y-4">
            <ServiceToggleCard
              isEnabled={isServiceEnabled}
              onToggle={async (enabled) => {
                await toggleService({ isDisabled: !enabled });
              }}
              isLoading={isLoading}
            />
            <BudgetSettingsCard
              currentBudgetCents={budgetStatus?.budgetCents ?? 0}
              onSave={async (budgetCents) => {
                await setBudgetLimit({ budgetCents, month: getCurrentMonth() });
              }}
              isLoading={isLoading}
            />
            <OpenAiCostsCard
              costs={openAiCosts}
              onSync={handleSyncOpenAI}
              isSyncing={isSyncing}
            />
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-4 lg:grid-cols-2">
          <TopUsersTable
            users={topUsers}
            isLoading={topUsers === undefined}
          />
          <UsageHistoryChart
            openAiBuckets={openAiCosts?.buckets}
            isLoading={isSyncing && !hasInitialSynced}
            lastSynced={openAiCosts?.lastSynced ?? null}
          />
        </div>
      </div>
    </main>
  );
}
