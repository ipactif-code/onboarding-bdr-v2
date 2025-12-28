/**
 * Shared types for waveform generation and processing utilities.
 */

/**
 * Default number of waveform samples to generate.
 */
export const DEFAULT_SAMPLES = 100;

/**
 * Maximum number of samples to prevent performance issues.
 */
export const MAX_SAMPLES = 1000;

/**
 * Minimum number of samples for meaningful visualization.
 */
export const MIN_SAMPLES = 10;

/**
 * Options for waveform generation.
 */
export interface WaveformGeneratorOptions {
  /**
   * Number of samples to generate.
   * @default 100
   */
  samples?: number;
}

/**
 * Options for waveform normalization.
 */
export interface NormalizeOptions {
  /**
   * Minimum peak value to consider.
   * Prevents over-amplification of silence.
   * @default 0.01
   */
  minPeakThreshold?: number;
}

/**
 * Options for waveform smoothing.
 */
export interface SmoothOptions {
  /**
   * Number of samples to average (should be odd for symmetry).
   * @default 3
   */
  windowSize?: number;
}
