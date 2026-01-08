/**
 * Praiz Pipeline - Observability Contract
 *
 * Types and interfaces for operational metrics tracking.
 * Covers throughput, error rates, cost tracking, and queue health.
 *
 * @module contracts/observability
 */

// ============================================================================
// Constants
// ============================================================================

export const METRICS_CONFIG = {
  /** Monthly budget in USD */
  monthlyBudgetUsd: 500,
  /** Budget alert threshold (80%) */
  alertThreshold: 0.8,
  /** Rate limit per hour */
  hourlyRateLimit: 50,
  /** Metrics retention in days */
  metricsRetentionDays: 365,
  /** Dashboard refresh interval in seconds */
  dashboardRefreshSeconds: 30,
} as const;

export const METRIC_TYPES = [
  "throughput",
  "error_rate",
  "cost",
  "queue_depth",
  "processing_time",
  "extraction_quality",
] as const;

export const TIME_WINDOWS = [
  "hour",
  "day",
  "week",
  "month",
  "quarter",
] as const;

// ============================================================================
// Types
// ============================================================================

export type MetricType = (typeof METRIC_TYPES)[number];
export type TimeWindow = (typeof TIME_WINDOWS)[number];

// ============================================================================
// Budget & Rate Limiting Types
// ============================================================================

/** Current budget status */
export interface BudgetStatus {
  /** Current month (YYYY-MM) */
  month: string;
  /** Monthly budget in USD */
  budgetUsd: number;
  /** Amount spent this month */
  spentUsd: number;
  /** Remaining budget */
  remainingUsd: number;
  /** Utilization percentage (0-100) */
  utilizationPercent: number;
  /** Whether 80% alert was sent */
  alert80Sent: boolean;
  /** Whether 100% alert was sent */
  alert100Sent: boolean;
  /** Whether processing is disabled due to budget */
  isDisabled: boolean;
  /** Estimated videos remaining with current budget */
  estimatedVideosRemaining: number;
}

/** Rate limit status */
export interface RateLimitStatus {
  /** Current hour's video count */
  currentHourVideos: number;
  /** Hourly limit */
  hourlyLimit: number;
  /** Videos remaining this hour */
  remainingThisHour: number;
  /** When the hourly counter resets (timestamp) */
  hourlyResetAt: number;
  /** Whether rate limit is reached */
  isLimited: boolean;
  /** Seconds until reset */
  secondsUntilReset: number;
}

/** Combined processing limits */
export interface ProcessingLimits {
  budget: BudgetStatus;
  rateLimit: RateLimitStatus;
  /** Can process more videos right now? */
  canProcess: boolean;
  /** Reason if cannot process */
  blockReason?: "budget_exhausted" | "rate_limited" | "disabled";
}

// ============================================================================
// Throughput Metrics
// ============================================================================

/** Throughput metrics for a time window */
export interface ThroughputMetrics {
  timeWindow: TimeWindow;
  /** Start of the time window */
  windowStart: number;
  /** End of the time window */
  windowEnd: number;
  /** Total videos processed */
  videosProcessed: number;
  /** Videos completed successfully */
  videosCompleted: number;
  /** Videos that failed */
  videosFailed: number;
  /** Videos skipped */
  videosSkipped: number;
  /** Average processing rate (videos/hour) */
  avgVideosPerHour: number;
  /** Peak processing rate (videos/hour) */
  peakVideosPerHour: number;
}

/** Throughput trend over time */
export interface ThroughputTrend {
  /** Data points for charting */
  dataPoints: Array<{
    timestamp: number;
    videosProcessed: number;
    videosPerHour: number;
  }>;
  /** Trend direction */
  trend: "up" | "down" | "stable";
  /** Percentage change */
  changePercent: number;
}

// ============================================================================
// Error Rate Metrics
// ============================================================================

/** Error rate metrics */
export interface ErrorRateMetrics {
  timeWindow: TimeWindow;
  /** Total jobs in window */
  totalJobs: number;
  /** Failed jobs count */
  failedJobs: number;
  /** Error rate percentage (0-100) */
  errorRatePercent: number;
  /** Breakdown by error type */
  byErrorType: {
    transient: number;
    permanent: number;
    fatal: number;
  };
  /** Top error messages */
  topErrors: Array<{
    message: string;
    count: number;
  }>;
}

// ============================================================================
// Cost Metrics
// ============================================================================

/** Cost metrics */
export interface CostMetrics {
  timeWindow: TimeWindow;
  /** Total cost in USD */
  totalCostUsd: number;
  /** Videos processed */
  videosProcessed: number;
  /** Average cost per video */
  avgCostPerVideoUsd: number;
  /** Cost breakdown by component */
  breakdown: {
    praizApi: number;
    claudeSonnet: number;
    convexStorage: number;
    other: number;
  };
  /** Comparison to target */
  vsTargetPercent: number; // vs $0.50 target
}

/** Cost trend and projection */
export interface CostProjection {
  /** Current month spend */
  currentMonthSpend: number;
  /** Projected end-of-month spend */
  projectedMonthEnd: number;
  /** Daily burn rate */
  dailyBurnRate: number;
  /** Days until budget exhausted (null if not projected) */
  daysUntilBudgetExhausted: number | null;
  /** On track for budget? */
  onTrack: boolean;
}

// ============================================================================
// Queue Health Metrics
// ============================================================================

/** Queue health metrics */
export interface QueueHealthMetrics {
  /** Current queue depth (videos waiting) */
  queueDepth: number;
  /** Videos currently processing */
  currentlyProcessing: number;
  /** Average wait time (milliseconds) */
  avgWaitTimeMs: number;
  /** Oldest item wait time (milliseconds) */
  oldestWaitTimeMs: number;
  /** Queue processing rate (videos/minute) */
  processingRate: number;
  /** Estimated time to clear queue (milliseconds) */
  estimatedClearTimeMs: number;
}

/** Processing time metrics */
export interface ProcessingTimeMetrics {
  timeWindow: TimeWindow;
  /** Average processing time (milliseconds) */
  avgProcessingTimeMs: number;
  /** P50 processing time */
  p50Ms: number;
  /** P90 processing time */
  p90Ms: number;
  /** P99 processing time */
  p99Ms: number;
  /** Slowest video processing time */
  maxMs: number;
  /** Fastest video processing time */
  minMs: number;
}

// ============================================================================
// Extraction Quality Metrics
// ============================================================================

/** Extraction quality metrics */
export interface ExtractionQualityMetrics {
  timeWindow: TimeWindow;
  /** Average extraction confidence */
  avgConfidence: number;
  /** Objections extracted */
  objectionsExtracted: number;
  /** Objections auto-approved (confidence >= 0.85) */
  autoApproved: number;
  /** Objections requiring manual validation */
  pendingValidation: number;
  /** Objections auto-rejected (confidence < 0.7) */
  autoRejected: number;
  /** Validation approval rate (manual validations) */
  manualApprovalRate: number;
  /** Average objections per video */
  avgObjectionsPerVideo: number;
}

// ============================================================================
// Dashboard Types
// ============================================================================

/** Complete dashboard data */
export interface PraizDashboardData {
  /** Last updated timestamp */
  lastUpdated: number;
  /** Processing limits (budget + rate) */
  limits: ProcessingLimits;
  /** Today's metrics */
  today: {
    throughput: ThroughputMetrics;
    errorRate: ErrorRateMetrics;
    cost: CostMetrics;
    queue: QueueHealthMetrics;
    processingTime: ProcessingTimeMetrics;
    quality: ExtractionQualityMetrics;
  };
  /** This month's metrics */
  month: {
    throughput: ThroughputMetrics;
    errorRate: ErrorRateMetrics;
    cost: CostMetrics;
    quality: ExtractionQualityMetrics;
  };
  /** Trends */
  trends: {
    throughput: ThroughputTrend;
    costProjection: CostProjection;
  };
  /** Alerts */
  alerts: DashboardAlert[];
}

/** Dashboard alert */
export interface DashboardAlert {
  /** Alert ID */
  id: string;
  /** Alert severity */
  severity: "info" | "warning" | "error";
  /** Alert type */
  type:
    | "budget_80_percent"
    | "budget_100_percent"
    | "rate_limited"
    | "high_error_rate"
    | "queue_backlog"
    | "api_failures";
  /** Alert message */
  message: string;
  /** When alert was triggered */
  triggeredAt: number;
  /** Whether alert has been acknowledged */
  acknowledged: boolean;
}

// ============================================================================
// Query Types
// ============================================================================

/** Metrics query input */
export interface MetricsQueryInput {
  /** Metric type to query */
  metricType: MetricType;
  /** Time window */
  timeWindow: TimeWindow;
  /** Custom date range (overrides timeWindow) */
  dateRange?: {
    start: number;
    end: number;
  };
  /** Granularity for trend data */
  granularity?: "hour" | "day" | "week";
}

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Calculate budget utilization percentage
 */
export function calculateUtilization(spent: number, budget: number): number {
  if (budget <= 0) return 100;
  return Math.round((spent / budget) * 100);
}

/**
 * Check if budget alert should be sent
 */
export function shouldSendBudgetAlert(
  utilization: number,
  alert80Sent: boolean,
  alert100Sent: boolean
): "80" | "100" | null {
  if (utilization >= 100 && !alert100Sent) return "100";
  if (utilization >= 80 && !alert80Sent) return "80";
  return null;
}

/**
 * Calculate seconds until hourly reset
 */
export function secondsUntilReset(resetAt: number): number {
  const diff = resetAt - Date.now();
  return Math.max(0, Math.ceil(diff / 1000));
}

/**
 * Calculate estimated videos remaining
 */
export function estimateVideosRemaining(
  remainingBudget: number,
  avgCostPerVideo: number
): number {
  if (avgCostPerVideo <= 0) return 0;
  return Math.floor(remainingBudget / avgCostPerVideo);
}

/**
 * Determine if processing can continue
 */
export function canProcessMore(limits: ProcessingLimits): {
  canProcess: boolean;
  reason?: "budget_exhausted" | "rate_limited" | "disabled";
} {
  if (limits.budget.isDisabled) {
    return { canProcess: false, reason: "disabled" };
  }
  if (limits.budget.remainingUsd <= 0) {
    return { canProcess: false, reason: "budget_exhausted" };
  }
  if (limits.rateLimit.isLimited) {
    return { canProcess: false, reason: "rate_limited" };
  }
  return { canProcess: true };
}

/**
 * Calculate error rate percentage
 */
export function calculateErrorRate(failed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((failed / total) * 1000) / 10; // One decimal place
}

/**
 * Calculate cost per video
 */
export function calculateCostPerVideo(
  totalCost: number,
  videosProcessed: number
): number {
  if (videosProcessed <= 0) return 0;
  return Math.round((totalCost / videosProcessed) * 100) / 100; // Two decimal places
}

/**
 * Calculate estimated clear time for queue
 */
export function estimateQueueClearTime(
  queueDepth: number,
  processingRate: number
): number {
  if (processingRate <= 0) return Infinity;
  return Math.ceil((queueDepth / processingRate) * 60 * 1000); // Milliseconds
}

/**
 * Determine trend direction
 */
export function determineTrend(
  current: number,
  previous: number
): "up" | "down" | "stable" {
  const change = ((current - previous) / previous) * 100;
  if (change > 5) return "up";
  if (change < -5) return "down";
  return "stable";
}

/**
 * Format metric for display
 */
export function formatMetric(
  value: number,
  type: MetricType
): string {
  switch (type) {
    case "cost":
      return `$${value.toFixed(2)}`;
    case "error_rate":
      return `${value.toFixed(1)}%`;
    case "processing_time":
      if (value >= 60000) {
        return `${(value / 60000).toFixed(1)}m`;
      }
      return `${(value / 1000).toFixed(1)}s`;
    case "throughput":
    case "queue_depth":
      return value.toFixed(0);
    case "extraction_quality":
      return `${(value * 100).toFixed(0)}%`;
    default:
      return value.toString();
  }
}

/**
 * Create empty dashboard data structure
 */
export function createEmptyDashboardData(): PraizDashboardData {
  const now = Date.now();
  const emptyThroughput: ThroughputMetrics = {
    timeWindow: "day",
    windowStart: now,
    windowEnd: now,
    videosProcessed: 0,
    videosCompleted: 0,
    videosFailed: 0,
    videosSkipped: 0,
    avgVideosPerHour: 0,
    peakVideosPerHour: 0,
  };

  const emptyErrorRate: ErrorRateMetrics = {
    timeWindow: "day",
    totalJobs: 0,
    failedJobs: 0,
    errorRatePercent: 0,
    byErrorType: { transient: 0, permanent: 0, fatal: 0 },
    topErrors: [],
  };

  const emptyCost: CostMetrics = {
    timeWindow: "day",
    totalCostUsd: 0,
    videosProcessed: 0,
    avgCostPerVideoUsd: 0,
    breakdown: { praizApi: 0, claudeSonnet: 0, convexStorage: 0, other: 0 },
    vsTargetPercent: 0,
  };

  const emptyQueue: QueueHealthMetrics = {
    queueDepth: 0,
    currentlyProcessing: 0,
    avgWaitTimeMs: 0,
    oldestWaitTimeMs: 0,
    processingRate: 0,
    estimatedClearTimeMs: 0,
  };

  const emptyProcessingTime: ProcessingTimeMetrics = {
    timeWindow: "day",
    avgProcessingTimeMs: 0,
    p50Ms: 0,
    p90Ms: 0,
    p99Ms: 0,
    maxMs: 0,
    minMs: 0,
  };

  const emptyQuality: ExtractionQualityMetrics = {
    timeWindow: "day",
    avgConfidence: 0,
    objectionsExtracted: 0,
    autoApproved: 0,
    pendingValidation: 0,
    autoRejected: 0,
    manualApprovalRate: 0,
    avgObjectionsPerVideo: 0,
  };

  return {
    lastUpdated: now,
    limits: {
      budget: {
        month: new Date().toISOString().slice(0, 7),
        budgetUsd: METRICS_CONFIG.monthlyBudgetUsd,
        spentUsd: 0,
        remainingUsd: METRICS_CONFIG.monthlyBudgetUsd,
        utilizationPercent: 0,
        alert80Sent: false,
        alert100Sent: false,
        isDisabled: false,
        estimatedVideosRemaining: 1000,
      },
      rateLimit: {
        currentHourVideos: 0,
        hourlyLimit: METRICS_CONFIG.hourlyRateLimit,
        remainingThisHour: METRICS_CONFIG.hourlyRateLimit,
        hourlyResetAt: now + 3600000,
        isLimited: false,
        secondsUntilReset: 3600,
      },
      canProcess: true,
    },
    today: {
      throughput: emptyThroughput,
      errorRate: emptyErrorRate,
      cost: emptyCost,
      queue: emptyQueue,
      processingTime: emptyProcessingTime,
      quality: emptyQuality,
    },
    month: {
      throughput: { ...emptyThroughput, timeWindow: "month" },
      errorRate: { ...emptyErrorRate, timeWindow: "month" },
      cost: { ...emptyCost, timeWindow: "month" },
      quality: { ...emptyQuality, timeWindow: "month" },
    },
    trends: {
      throughput: {
        dataPoints: [],
        trend: "stable",
        changePercent: 0,
      },
      costProjection: {
        currentMonthSpend: 0,
        projectedMonthEnd: 0,
        dailyBurnRate: 0,
        daysUntilBudgetExhausted: null,
        onTrack: true,
      },
    },
    alerts: [],
  };
}
