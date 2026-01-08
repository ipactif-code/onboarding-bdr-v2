/**
 * M6: Voice Sentiment Analysis Contract
 *
 * Client-side voice analysis for confidence, pace, energy, and hesitation.
 * Raw audio never leaves the browser - only numeric metrics are transmitted.
 */

import { v } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Pace status indicator
 */
export type PaceStatus = "too_slow" | "good" | "too_fast";

/**
 * Voice metric snapshot (captured every 5 seconds)
 */
export interface VoiceMetricSnapshot {
  sessionId: Id<"trainingSessions">;
  userId: Id<"users">;
  timestamp: number;
  sessionElapsedMs: number;
  confidence: number; // 0-1 scale
  paceWpm: number; // Words per minute
  energy: number; // 0-1 scale
  hesitationRate: number; // 0-1 scale (percentage)
  paceStatus: PaceStatus;
  fillerWordsDetected?: number;
  processingTimeMs: number;
}

/**
 * Session voice summary (aggregated at session end)
 */
export interface SessionVoiceSummary {
  sessionId: Id<"trainingSessions">;
  userId: Id<"users">;
  averageConfidence: number;
  averagePaceWpm: number;
  averageEnergy: number;
  averageHesitationRate: number;
  confidenceMin: number;
  confidenceMax: number;
  paceMin: number;
  paceMax: number;
  timeInGoodPaceMs: number;
  timeInTooFastMs: number;
  timeInTooSlowMs: number;
  totalSpeakingTimeMs: number;
  sampleCount: number;
  timelineData: TimelineDataPoint[];
  computedAt: number;
}

/**
 * Timeline data point for visualization (30-second intervals)
 */
export interface TimelineDataPoint {
  timestamp: number;
  confidence: number;
  paceWpm: number;
  energy: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * M6 Voice Analysis Configuration
 */
export const M6_CONFIG = {
  /** Interval between metric snapshots (FR-026) */
  sampleIntervalMs: 5_000, // 5 seconds

  /** Pace thresholds (WPM) */
  thresholds: {
    confidence: {
      low: 0.35, // Below this triggers whisper
      medium: 0.55,
      high: 0.75,
    },
    pace: {
      tooSlow: 100,
      goodMin: 120,
      goodMax: 160,
      tooFast: 180, // Above this triggers whisper
    },
    energy: {
      low: 0.3,
      medium: 0.5,
      high: 0.7,
    },
    hesitation: {
      low: 0.05, // <5% is good
      medium: 0.10, // 5-10% is moderate
      high: 0.15, // >15% is concerning
    },
  },

  /** Timeline aggregation interval for summary */
  timelineIntervalMs: 30_000, // 30 seconds

  /** Sustained duration before triggering whispers */
  sustainedDurationForWhisper: {
    confidence: 30_000, // 30 seconds of low confidence
    pace: 20_000, // 20 seconds of fast pace
  },

  /** CPU usage target (SC-003: <5%) */
  maxCpuUsagePercent: 5,
} as const;

/**
 * Filler words by language (for hesitation detection)
 */
export const FILLER_WORDS: Record<string, string[]> = {
  fr: ["euh", "hum", "ben", "bah", "genre", "voilà", "donc", "quoi", "enfin"],
  en: ["um", "uh", "like", "you know", "so", "basically", "actually", "well", "right"],
  it: ["ehm", "allora", "cioè", "praticamente", "insomma", "tipo", "ecco"],
  de: ["ähm", "äh", "also", "halt", "sozusagen", "quasi", "irgendwie", "ja"],
  es: ["eh", "este", "pues", "bueno", "o sea", "como", "entonces", "vale"],
} as const;

// =============================================================================
// VALIDATORS
// =============================================================================

export const paceStatusValidator = v.union(
  v.literal("too_slow"),
  v.literal("good"),
  v.literal("too_fast")
);

export const voiceMetricSnapshotValidator = v.object({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  timestamp: v.number(),
  sessionElapsedMs: v.number(),
  confidence: v.number(),
  paceWpm: v.number(),
  energy: v.number(),
  hesitationRate: v.number(),
  paceStatus: paceStatusValidator,
  fillerWordsDetected: v.optional(v.number()),
  processingTimeMs: v.number(),
});

export const timelineDataPointValidator = v.object({
  timestamp: v.number(),
  confidence: v.number(),
  paceWpm: v.number(),
  energy: v.number(),
});

export const sessionVoiceSummaryValidator = v.object({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  averageConfidence: v.number(),
  averagePaceWpm: v.number(),
  averageEnergy: v.number(),
  averageHesitationRate: v.number(),
  confidenceMin: v.number(),
  confidenceMax: v.number(),
  paceMin: v.number(),
  paceMax: v.number(),
  timeInGoodPaceMs: v.number(),
  timeInTooFastMs: v.number(),
  timeInTooSlowMs: v.number(),
  totalSpeakingTimeMs: v.number(),
  sampleCount: v.number(),
  timelineData: v.array(timelineDataPointValidator),
  computedAt: v.number(),
});

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Determine pace status from WPM
 */
export function determinePaceStatus(paceWpm: number): PaceStatus {
  const { pace } = M6_CONFIG.thresholds;

  if (paceWpm < pace.tooSlow) return "too_slow";
  if (paceWpm > pace.tooFast) return "too_fast";
  return "good";
}

/**
 * Calculate confidence score from audio analysis
 * Higher = more confident speaking pattern
 */
export function calculateConfidence(
  volumeVariance: number,
  pitchVariance: number,
  pauseFrequency: number
): number {
  // Lower variance = more consistent = more confident
  // Lower pause frequency = fewer hesitations = more confident
  const volumeScore = Math.max(0, 1 - volumeVariance * 2);
  const pitchScore = Math.max(0, 1 - pitchVariance * 2);
  const pauseScore = Math.max(0, 1 - pauseFrequency * 3);

  return (volumeScore * 0.3 + pitchScore * 0.3 + pauseScore * 0.4);
}

/**
 * Calculate energy score from amplitude
 */
export function calculateEnergy(averageAmplitude: number): number {
  // Normalize amplitude to 0-1 scale
  // Typical speech amplitude range
  const normalized = Math.min(1, averageAmplitude / 0.5);
  return normalized;
}

/**
 * Calculate hesitation rate from filler word count
 */
export function calculateHesitationRate(
  fillerWordCount: number,
  totalWordCount: number
): number {
  if (totalWordCount === 0) return 0;
  return Math.min(1, fillerWordCount / totalWordCount);
}

/**
 * Detect filler words in transcript segment
 */
export function detectFillerWords(
  transcript: string,
  language: string
): number {
  const fillers = FILLER_WORDS[language] ?? FILLER_WORDS.en;
  const words = transcript.toLowerCase().split(/\s+/);

  let count = 0;
  for (const word of words) {
    if (fillers.includes(word)) {
      count++;
    }
  }

  return count;
}

/**
 * Aggregate metrics into session summary
 */
export function aggregateToSummary(
  sessionId: Id<"trainingSessions">,
  userId: Id<"users">,
  snapshots: VoiceMetricSnapshot[]
): SessionVoiceSummary {
  if (snapshots.length === 0) {
    return {
      sessionId,
      userId,
      averageConfidence: 0,
      averagePaceWpm: 0,
      averageEnergy: 0,
      averageHesitationRate: 0,
      confidenceMin: 0,
      confidenceMax: 0,
      paceMin: 0,
      paceMax: 0,
      timeInGoodPaceMs: 0,
      timeInTooFastMs: 0,
      timeInTooSlowMs: 0,
      totalSpeakingTimeMs: 0,
      sampleCount: 0,
      timelineData: [],
      computedAt: Date.now(),
    };
  }

  // Calculate averages
  const sum = snapshots.reduce(
    (acc, s) => ({
      confidence: acc.confidence + s.confidence,
      paceWpm: acc.paceWpm + s.paceWpm,
      energy: acc.energy + s.energy,
      hesitationRate: acc.hesitationRate + s.hesitationRate,
    }),
    { confidence: 0, paceWpm: 0, energy: 0, hesitationRate: 0 }
  );

  const count = snapshots.length;

  // Calculate min/max
  const confidences = snapshots.map((s) => s.confidence);
  const paces = snapshots.map((s) => s.paceWpm);

  // Calculate time in each pace status
  let timeInGoodPace = 0;
  let timeInTooFast = 0;
  let timeInTooSlow = 0;

  for (const snapshot of snapshots) {
    const interval = M6_CONFIG.sampleIntervalMs;
    switch (snapshot.paceStatus) {
      case "good":
        timeInGoodPace += interval;
        break;
      case "too_fast":
        timeInTooFast += interval;
        break;
      case "too_slow":
        timeInTooSlow += interval;
        break;
    }
  }

  // Generate timeline data (aggregate to 30-second intervals)
  const timelineData = generateTimelineData(snapshots);

  return {
    sessionId,
    userId,
    averageConfidence: sum.confidence / count,
    averagePaceWpm: sum.paceWpm / count,
    averageEnergy: sum.energy / count,
    averageHesitationRate: sum.hesitationRate / count,
    confidenceMin: Math.min(...confidences),
    confidenceMax: Math.max(...confidences),
    paceMin: Math.min(...paces),
    paceMax: Math.max(...paces),
    timeInGoodPaceMs: timeInGoodPace,
    timeInTooFastMs: timeInTooFast,
    timeInTooSlowMs: timeInTooSlow,
    totalSpeakingTimeMs: count * M6_CONFIG.sampleIntervalMs,
    sampleCount: count,
    timelineData,
    computedAt: Date.now(),
  };
}

/**
 * Generate timeline data for visualization
 */
function generateTimelineData(
  snapshots: VoiceMetricSnapshot[]
): TimelineDataPoint[] {
  if (snapshots.length === 0) return [];

  const intervalMs = M6_CONFIG.timelineIntervalMs;
  const result: TimelineDataPoint[] = [];

  let currentBucket: VoiceMetricSnapshot[] = [];
  let bucketStart = snapshots[0].timestamp;

  for (const snapshot of snapshots) {
    if (snapshot.timestamp - bucketStart >= intervalMs) {
      // Process current bucket
      if (currentBucket.length > 0) {
        result.push(aggregateBucket(currentBucket));
      }
      // Start new bucket
      currentBucket = [snapshot];
      bucketStart = snapshot.timestamp;
    } else {
      currentBucket.push(snapshot);
    }
  }

  // Don't forget the last bucket
  if (currentBucket.length > 0) {
    result.push(aggregateBucket(currentBucket));
  }

  return result;
}

function aggregateBucket(snapshots: VoiceMetricSnapshot[]): TimelineDataPoint {
  const count = snapshots.length;
  return {
    timestamp: snapshots[0].timestamp,
    confidence:
      snapshots.reduce((sum, s) => sum + s.confidence, 0) / count,
    paceWpm: snapshots.reduce((sum, s) => sum + s.paceWpm, 0) / count,
    energy: snapshots.reduce((sum, s) => sum + s.energy, 0) / count,
  };
}

/**
 * Check if metrics should trigger whisper
 */
export function shouldTriggerVoiceWhisper(
  recentSnapshots: VoiceMetricSnapshot[],
  type: "confidence" | "pace"
): boolean {
  if (recentSnapshots.length === 0) return false;

  const { sustainedDurationForWhisper, thresholds } = M6_CONFIG;
  const requiredSamples = Math.ceil(
    sustainedDurationForWhisper[type] / M6_CONFIG.sampleIntervalMs
  );

  if (recentSnapshots.length < requiredSamples) return false;

  const relevantSnapshots = recentSnapshots.slice(-requiredSamples);

  if (type === "confidence") {
    return relevantSnapshots.every(
      (s) => s.confidence < thresholds.confidence.low
    );
  }

  if (type === "pace") {
    return relevantSnapshots.every((s) => s.paceWpm > thresholds.pace.tooFast);
  }

  return false;
}

// =============================================================================
// CLIENT-SIDE INTERFACE (Web Audio API Integration)
// =============================================================================

/**
 * Configuration for Web Audio API analyzer
 */
export interface AudioAnalyzerConfig {
  fftSize: number; // 2048 recommended
  smoothingTimeConstant: number; // 0.8 recommended
  minDecibels: number; // -90 recommended
  maxDecibels: number; // -10 recommended
}

export const DEFAULT_AUDIO_ANALYZER_CONFIG: AudioAnalyzerConfig = {
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10,
};

/**
 * Client-side voice analyzer interface
 * Implementation runs entirely in browser
 */
export interface ClientVoiceAnalyzer {
  /**
   * Initialize analyzer with audio stream
   */
  initialize(stream: MediaStream, config?: AudioAnalyzerConfig): void;

  /**
   * Start analysis
   */
  start(): void;

  /**
   * Stop analysis
   */
  stop(): void;

  /**
   * Get current metrics (called every sampleIntervalMs)
   */
  getCurrentMetrics(): {
    volumeVariance: number;
    pitchVariance: number;
    pauseFrequency: number;
    averageAmplitude: number;
  };

  /**
   * Check if currently detecting speech
   */
  isSpeaking(): boolean;

  /**
   * Get CPU usage estimate
   */
  getCpuUsage(): number;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface VoiceSentimentService {
  /**
   * Record a voice metric snapshot
   */
  recordSnapshot(snapshot: VoiceMetricSnapshot): Promise<void>;

  /**
   * Get recent snapshots for whisper evaluation
   */
  getRecentSnapshots(
    sessionId: Id<"trainingSessions">,
    durationMs: number
  ): Promise<VoiceMetricSnapshot[]>;

  /**
   * Generate session voice summary
   */
  generateSummary(
    sessionId: Id<"trainingSessions">,
    userId: Id<"users">
  ): Promise<SessionVoiceSummary>;

  /**
   * Get session voice summary
   */
  getSummary(
    sessionId: Id<"trainingSessions">
  ): Promise<SessionVoiceSummary | null>;

  /**
   * Get metrics for whisper trigger evaluation
   */
  getMetricsForWhisperTrigger(
    sessionId: Id<"trainingSessions">
  ): Promise<{
    confidence: number;
    paceWpm: number;
    confidenceSustained: boolean;
    paceSustained: boolean;
  }>;
}
