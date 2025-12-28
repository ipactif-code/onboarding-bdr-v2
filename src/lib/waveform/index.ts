/**
 * Waveform generation and processing utilities for audio visualization.
 */

// Generator functions
export { generateWaveformData, generateWaveformFromUrl } from "./generator";

// Processing functions
export {
  normalizeWaveform,
  smoothWaveform,
  downsampleWaveform,
} from "./processing";

// Types and constants
export {
  DEFAULT_SAMPLES,
  MAX_SAMPLES,
  MIN_SAMPLES,
  type WaveformGeneratorOptions,
  type NormalizeOptions,
  type SmoothOptions,
} from "./types";
