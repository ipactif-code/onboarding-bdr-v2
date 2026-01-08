/**
 * Performance Overlay Contract
 *
 * Optional HUD component for free practice mode that displays
 * real-time performance metrics, difficulty level, and emotional state.
 */

import { v } from "convex/values";
import type { EmotionalState } from "./emotional-state-machine";
import type { PerformanceMetrics, BehaviorModifiers } from "./difficulty-engine";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Overlay visibility configuration
 */
export interface OverlayConfig {
  enabled: boolean;
  showMetrics: boolean;
  showDifficulty: boolean;
  showEmotionalState: boolean;
  refreshIntervalMs: number;
  position: OverlayPosition;
}

export type OverlayPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

/**
 * Default overlay configuration
 */
export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  enabled: false,
  showMetrics: true,
  showDifficulty: true,
  showEmotionalState: true,
  refreshIntervalMs: 10_000, // 10 seconds (within 10-15s requirement)
  position: "top-right",
};

/**
 * Complete overlay state for display
 */
export interface OverlayState {
  // M1: Difficulty
  currentDifficulty: number;
  difficultyLevel: "easy" | "medium" | "hard";
  difficultyTrend: "increasing" | "stable" | "decreasing";
  lastDifficultyChange: number | null;

  // M3: Emotional State
  currentEmotionalState: EmotionalState;
  emotionalStateTrend: "improving" | "stable" | "declining";
  stateHistory: EmotionalState[];

  // Performance Metrics
  metrics: PerformanceMetrics;
  compositeScore: number;
  compositeTrend: "improving" | "stable" | "declining";

  // Behavior modifiers (for transparency)
  behaviorModifiers: BehaviorModifiers;

  // Session info
  sessionDurationMs: number;
  turnCount: number;
  lastUpdatedAt: number;
}

/**
 * Metric display configuration
 */
export interface MetricDisplayConfig {
  key: keyof PerformanceMetrics;
  label: string;
  weight: number;
  idealRange: { min: number; max: number };
  icon: string;
}

/**
 * Metric display configurations for UI
 */
export const METRIC_DISPLAY_CONFIG: MetricDisplayConfig[] = [
  {
    key: "spinQuality",
    label: "SPIN Questions",
    weight: 0.25,
    idealRange: { min: 70, max: 100 },
    icon: "❓",
  },
  {
    key: "objectionHandling",
    label: "Objection Handling",
    weight: 0.25,
    idealRange: { min: 70, max: 100 },
    icon: "🛡️",
  },
  {
    key: "talkRatio",
    label: "Talk Ratio",
    weight: 0.1,
    idealRange: { min: 30, max: 40 }, // Target ~35%
    icon: "🎙️",
  },
  {
    key: "responseTiming",
    label: "Response Timing",
    weight: 0.1,
    idealRange: { min: 70, max: 100 },
    icon: "⏱️",
  },
  {
    key: "questionDepth",
    label: "Question Depth",
    weight: 0.1,
    idealRange: { min: 65, max: 100 },
    icon: "🔍",
  },
  {
    key: "valueArticulation",
    label: "Value Articulation",
    weight: 0.1,
    idealRange: { min: 65, max: 100 },
    icon: "💎",
  },
  {
    key: "closingSignals",
    label: "Closing Signals",
    weight: 0.1,
    idealRange: { min: 60, max: 100 },
    icon: "🎯",
  },
];

/**
 * Emotional state display configuration
 */
export interface EmotionalStateDisplayConfig {
  state: EmotionalState;
  label: string;
  color: string;
  icon: string;
  description: string;
}

export const EMOTIONAL_STATE_DISPLAY: Record<EmotionalState, EmotionalStateDisplayConfig> = {
  skeptical: {
    state: "skeptical",
    label: "Skeptical",
    color: "#F59E0B", // Amber
    icon: "🤨",
    description: "Prospect is doubtful and guarded",
  },
  neutral: {
    state: "neutral",
    label: "Neutral",
    color: "#6B7280", // Gray
    icon: "😐",
    description: "Prospect is open but uncommitted",
  },
  interested: {
    state: "interested",
    label: "Interested",
    color: "#10B981", // Green
    icon: "🤔",
    description: "Prospect sees potential value",
  },
  impressed: {
    state: "impressed",
    label: "Impressed",
    color: "#3B82F6", // Blue
    icon: "😊",
    description: "Prospect is seriously considering",
  },
  defensive: {
    state: "defensive",
    label: "Defensive",
    color: "#EF4444", // Red
    icon: "😤",
    description: "Prospect feels pushed or pressured",
  },
  frustrated: {
    state: "frustrated",
    label: "Frustrated",
    color: "#DC2626", // Dark red
    icon: "😠",
    description: "Prospect wants to end the call",
  },
};

/**
 * Difficulty level display configuration
 */
export interface DifficultyDisplayConfig {
  level: "easy" | "medium" | "hard";
  label: string;
  color: string;
  range: { min: number; max: number };
}

export const DIFFICULTY_DISPLAY: Record<"easy" | "medium" | "hard", DifficultyDisplayConfig> = {
  easy: {
    level: "easy",
    label: "Easy",
    color: "#10B981", // Green
    range: { min: 0.1, max: 0.4 },
  },
  medium: {
    level: "medium",
    label: "Medium",
    color: "#F59E0B", // Amber
    range: { min: 0.4, max: 0.7 },
  },
  hard: {
    level: "hard",
    label: "Hard",
    color: "#EF4444", // Red
    range: { min: 0.7, max: 0.95 },
  },
};

// =============================================================================
// VALIDATORS (for Convex functions)
// =============================================================================

export const overlayConfigValidator = v.object({
  enabled: v.boolean(),
  showMetrics: v.boolean(),
  showDifficulty: v.boolean(),
  showEmotionalState: v.boolean(),
  refreshIntervalMs: v.number(),
  position: v.union(
    v.literal("top-right"),
    v.literal("top-left"),
    v.literal("bottom-right"),
    v.literal("bottom-left")
  ),
});

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface PerformanceOverlayService {
  /**
   * Get current overlay state for a session
   * @param sessionId - Session ID
   * @returns Current overlay state or null if not available
   */
  getOverlayState(sessionId: string): Promise<OverlayState | null>;

  /**
   * Check if overlay is allowed for session mode
   * @param mode - Session mode (free or evaluation)
   * @returns Whether overlay can be enabled
   */
  isOverlayAllowed(mode: "free" | "evaluation"): boolean;

  /**
   * Calculate trend from recent values
   * @param values - Recent values (newest last)
   * @returns Trend direction
   */
  calculateTrend(values: number[]): "improving" | "stable" | "declining";

  /**
   * Format metric value for display
   * @param key - Metric key
   * @param value - Metric value (0-100)
   * @returns Formatted string
   */
  formatMetricValue(key: keyof PerformanceMetrics, value: number): string;

  /**
   * Get metric status (good, warning, poor)
   * @param key - Metric key
   * @param value - Metric value
   * @returns Status indicator
   */
  getMetricStatus(key: keyof PerformanceMetrics, value: number): "good" | "warning" | "poor";
}

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Check if overlay is allowed based on session mode
 * Overlay is DISABLED in evaluation mode (FR-018)
 */
export function isOverlayAllowed(mode: "free" | "evaluation"): boolean {
  return mode === "free";
}

/**
 * Calculate trend from recent values
 * Uses last 3 values to determine direction
 */
export function calculateTrend(values: number[]): "improving" | "stable" | "declining" {
  if (values.length < 2) return "stable";

  const recentValues = values.slice(-3);
  const first = recentValues[0];
  const last = recentValues[recentValues.length - 1];
  const diff = last - first;

  if (diff > 5) return "improving";
  if (diff < -5) return "declining";
  return "stable";
}

/**
 * Map difficulty number to level
 */
export function mapDifficultyToLevel(difficulty: number): "easy" | "medium" | "hard" {
  if (difficulty < 0.4) return "easy";
  if (difficulty < 0.7) return "medium";
  return "hard";
}

/**
 * Format metric value for display
 */
export function formatMetricValue(key: keyof PerformanceMetrics, value: number): string {
  if (key === "talkRatio") {
    // Talk ratio is displayed as percentage of BDR speaking time
    return `${Math.round(value)}%`;
  }
  // Other metrics are 0-100 scores
  return `${Math.round(value)}/100`;
}

/**
 * Get metric status based on value and ideal range
 */
export function getMetricStatus(
  key: keyof PerformanceMetrics,
  value: number
): "good" | "warning" | "poor" {
  const config = METRIC_DISPLAY_CONFIG.find((c) => c.key === key);
  if (!config) return "warning";

  const { idealRange } = config;

  // Special handling for talk ratio (ideal is 30-40%)
  if (key === "talkRatio") {
    if (value >= 30 && value <= 40) return "good";
    if (value >= 20 && value <= 50) return "warning";
    return "poor";
  }

  // Standard metrics: higher is better
  if (value >= idealRange.min) return "good";
  if (value >= idealRange.min - 15) return "warning";
  return "poor";
}

/**
 * Calculate composite score status
 */
export function getCompositeStatus(score: number): "good" | "warning" | "poor" {
  if (score >= 70) return "good";
  if (score >= 55) return "warning";
  return "poor";
}

/**
 * Get emotional state journey summary
 */
export function getEmotionalJourneySummary(history: EmotionalState[]): {
  mostCommonState: EmotionalState;
  peakState: EmotionalState;
  lowestState: EmotionalState;
  transitions: number;
} {
  if (history.length === 0) {
    return {
      mostCommonState: "neutral",
      peakState: "neutral",
      lowestState: "neutral",
      transitions: 0,
    };
  }

  // State ranking (best to worst)
  const stateRank: Record<EmotionalState, number> = {
    impressed: 5,
    interested: 4,
    neutral: 3,
    skeptical: 2,
    defensive: 1,
    frustrated: 0,
  };

  // Count occurrences
  const counts = history.reduce(
    (acc, state) => {
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    },
    {} as Record<EmotionalState, number>
  );

  // Find most common
  const mostCommonState = (Object.entries(counts) as [EmotionalState, number][]).sort(
    (a, b) => b[1] - a[1]
  )[0][0];

  // Find peak and lowest
  const uniqueStates = [...new Set(history)] as EmotionalState[];
  const peakState = uniqueStates.sort((a, b) => stateRank[b] - stateRank[a])[0];
  const lowestState = uniqueStates.sort((a, b) => stateRank[a] - stateRank[b])[0];

  // Count transitions
  let transitions = 0;
  for (let i = 1; i < history.length; i++) {
    if (history[i] !== history[i - 1]) transitions++;
  }

  return {
    mostCommonState,
    peakState,
    lowestState,
    transitions,
  };
}

// =============================================================================
// REACT HOOK INTERFACE (for frontend implementation reference)
// =============================================================================

/**
 * Hook return type for usePerformanceOverlay
 */
export interface UsePerformanceOverlayReturn {
  /** Current overlay state */
  state: OverlayState | null;
  /** Whether overlay is loading */
  isLoading: boolean;
  /** Current configuration */
  config: OverlayConfig;
  /** Toggle overlay visibility */
  toggleOverlay: () => void;
  /** Update configuration */
  updateConfig: (updates: Partial<OverlayConfig>) => void;
  /** Whether overlay is allowed in current mode */
  isAllowed: boolean;
}

/**
 * Props for PerformanceOverlay component
 */
export interface PerformanceOverlayProps {
  sessionId: string;
  mode: "free" | "evaluation";
  initialConfig?: Partial<OverlayConfig>;
  onToggle?: (enabled: boolean) => void;
}

/**
 * Props for MetricCard component
 */
export interface MetricCardProps {
  config: MetricDisplayConfig;
  value: number;
  status: "good" | "warning" | "poor";
  trend?: "improving" | "stable" | "declining";
}

/**
 * Props for EmotionalStateIndicator component
 */
export interface EmotionalStateIndicatorProps {
  state: EmotionalState;
  trend: "improving" | "stable" | "declining";
  history: EmotionalState[];
}

/**
 * Props for DifficultyGauge component
 */
export interface DifficultyGaugeProps {
  difficulty: number;
  level: "easy" | "medium" | "hard";
  trend: "increasing" | "stable" | "decreasing";
  bounds: { min: number; max: number };
}
