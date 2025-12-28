/**
 * Voice Messages - Shared Types and Validators
 *
 * Contains shared validators, constants, and type definitions
 * used across the voice messages module.
 */

import { v } from "convex/values";

// ============================================================================
// Constants
// ============================================================================

/** Maximum voice message duration in seconds (2 minutes). */
export const MAX_VOICE_DURATION_SECONDS = 120;

/** Maximum file size for voice messages (25MB - OpenAI Whisper limit). */
export const MAX_VOICE_FILE_SIZE = 25 * 1024 * 1024;

/** Maximum number of waveform samples (reasonable limit for 2-min audio). */
export const MAX_WAVEFORM_SAMPLES = 1000;

/** Minimum number of waveform samples. */
export const MIN_WAVEFORM_SAMPLES = 10;

// ============================================================================
// Validators
// ============================================================================

/**
 * Validator for transcription status.
 */
export const transcriptionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed")
);

/**
 * Validator for voice message data returned by getVoiceMessage query.
 */
export const voiceMessageDataValidator = v.object({
  _id: v.id("voiceMessages"),
  messageId: v.id("messages"),
  audioUrl: v.union(v.string(), v.null()),
  duration: v.number(),
  waveformData: v.array(v.number()),
  transcription: v.union(v.string(), v.null()),
  transcriptionStatus: transcriptionStatusValidator,
  transcriptionError: v.union(v.string(), v.null()),
  transcriptionEdited: v.boolean(),
});

/**
 * Validator for voice message info returned by updateTranscriptionProcessing.
 */
export const voiceMessageInfoValidator = v.object({
  voiceMessageId: v.id("voiceMessages"),
  storageId: v.id("_storage"),
  mimeType: v.string(),
  duration: v.number(),
});

/**
 * Validator for waveform data array.
 * Each value must be a number between 0 and 1.
 */
export const waveformDataValidator = v.array(v.number());

/**
 * Runtime validation for waveform data.
 * Checks length bounds and value ranges.
 */
export function validateWaveformData(data: number[]): { valid: boolean; error?: string } {
  if (data.length < MIN_WAVEFORM_SAMPLES) {
    return { valid: false, error: `Waveform data too short: ${data.length} samples (min: ${MIN_WAVEFORM_SAMPLES})` };
  }
  if (data.length > MAX_WAVEFORM_SAMPLES) {
    return { valid: false, error: `Waveform data too long: ${data.length} samples (max: ${MAX_WAVEFORM_SAMPLES})` };
  }
  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 1) {
      return { valid: false, error: `Invalid waveform value at index ${i}: ${val} (must be 0-1)` };
    }
  }
  return { valid: true };
}

// ============================================================================
// KNOWN WORKAROUND: TS2589 with internal functions
// ============================================================================
/**
 * TypeScript Workaround: TS2589
 *
 * Convex's generated `internal` object can trigger TypeScript error TS2589
 * "Type instantiation is excessively deep and possibly infinite" when the
 * schema has many tables with complex validators.
 *
 * The workaround uses `require()` with `any` type assertion:
 *
 * ```typescript
 * // Type workaround: Use require() to avoid TS2589. See types.ts.
 * // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
 * const { internal } = require("../_generated/api") as { internal: any };
 * ```
 *
 * Type safety is preserved at runtime by Convex's validator system.
 *
 * Files using this pattern:
 * - channelMutations.ts
 * - dmMutations.ts
 * - transcriptionMutations.ts
 * - transcriptionActions.ts
 *
 * @see https://docs.convex.dev/functions/internal-functions#typescript-errors
 */
