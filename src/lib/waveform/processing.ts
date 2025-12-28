/**
 * Waveform processing utilities for audio visualization.
 * Provides normalization, smoothing, and downsampling functions.
 */

/**
 * Normalize an array of waveform values to ensure consistent visualization.
 * Scales values so the peak reaches 1.0 while maintaining relative proportions.
 *
 * @param waveformData - Array of amplitude values
 * @param minPeakThreshold - Minimum peak value to consider (prevents over-amplification of silence)
 * @returns Normalized array with peak at 1.0
 *
 * @example
 * ```tsx
 * const raw = [0.1, 0.2, 0.15, 0.3, 0.1];
 * const normalized = normalizeWaveform(raw);
 * // normalized = [0.33, 0.67, 0.5, 1.0, 0.33]
 * ```
 */
export function normalizeWaveform(
  waveformData: number[],
  minPeakThreshold: number = 0.01
): number[] {
  if (waveformData.length === 0) {
    return [];
  }

  // Find the peak value
  const peak = Math.max(...waveformData);

  // If peak is below threshold, return as-is to avoid over-amplification
  if (peak < minPeakThreshold) {
    return [...waveformData];
  }

  // Scale all values so peak = 1.0
  return waveformData.map((value) => value / peak);
}

/**
 * Smooth waveform data using a simple moving average.
 * Useful for reducing visual noise in waveform displays.
 *
 * @param waveformData - Array of amplitude values
 * @param windowSize - Number of samples to average (must be odd for symmetry)
 * @returns Smoothed array of same length
 *
 * @example
 * ```tsx
 * const raw = [0.1, 0.8, 0.2, 0.7, 0.3];
 * const smooth = smoothWaveform(raw, 3);
 * // smooth = [0.45, 0.37, 0.57, 0.40, 0.50]
 * ```
 */
export function smoothWaveform(
  waveformData: number[],
  windowSize: number = 3
): number[] {
  if (waveformData.length === 0) {
    return [];
  }

  // Ensure window size is odd and at least 1
  const normalizedWindowSize = Math.max(1, Math.round(windowSize) | 1);
  const halfWindow = Math.floor(normalizedWindowSize / 2);

  return waveformData.map((_, index) => {
    let sum = 0;
    let count = 0;

    for (let j = -halfWindow; j <= halfWindow; j++) {
      const sampleIndex = index + j;
      if (sampleIndex >= 0 && sampleIndex < waveformData.length) {
        const sample = waveformData[sampleIndex];
        if (sample !== undefined) {
          sum += sample;
          count++;
        }
      }
    }

    return count > 0 ? sum / count : 0;
  });
}

/**
 * Downsample waveform data to a target number of samples.
 * Uses peak detection to preserve audio dynamics.
 *
 * @param waveformData - Array of amplitude values
 * @param targetSamples - Target number of samples
 * @returns Downsampled array
 *
 * @example
 * ```tsx
 * const detailed = await generateWaveformData(blob, 500);
 * const simplified = downsampleWaveform(detailed, 50);
 * // simplified has 50 samples, preserving peaks
 * ```
 */
export function downsampleWaveform(
  waveformData: number[],
  targetSamples: number
): number[] {
  if (waveformData.length === 0 || targetSamples <= 0) {
    return [];
  }

  if (waveformData.length <= targetSamples) {
    return [...waveformData];
  }

  const blockSize = waveformData.length / targetSamples;
  const result: number[] = [];

  for (let i = 0; i < targetSamples; i++) {
    const startIndex = Math.floor(i * blockSize);
    const endIndex = Math.floor((i + 1) * blockSize);

    // Use max value in block to preserve peaks
    let maxValue = 0;
    for (let j = startIndex; j < endIndex; j++) {
      const sample = waveformData[j];
      if (sample !== undefined && sample > maxValue) {
        maxValue = sample;
      }
    }

    result.push(maxValue);
  }

  return result;
}
