/**
 * Audio utilities for voice message recording and validation.
 * Handles MediaRecorder format detection and browser compatibility.
 */

/**
 * Supported audio MIME types for MediaRecorder.
 * Preference order: WebM/Opus (best) > WebM > MP4 (Safari) > OGG (legacy)
 */
export type AudioMimeType =
  | "audio/webm;codecs=opus"
  | "audio/mp4"
  | "audio/webm"
  | "audio/ogg";

/**
 * Result of voice message validation.
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * MIME types in preference order.
 * WebM/Opus provides best quality and compression for voice.
 */
const MIME_TYPES: AudioMimeType[] = [
  "audio/webm;codecs=opus", // Best quality, Chrome/Firefox
  "audio/webm", // Fallback WebM
  "audio/mp4", // Safari
  "audio/ogg", // Legacy fallback
];

/**
 * Voice message constraints.
 */
const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 300; // 5 minutes
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB (Whisper API limit)

/**
 * Check if MediaRecorder API is available in the browser.
 * Safe to call in SSR context (returns false when window is undefined).
 *
 * @returns true if MediaRecorder is supported
 */
export function isMediaRecorderSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return typeof MediaRecorder !== "undefined";
}

/**
 * Detect the best supported audio MIME type for MediaRecorder.
 * Prefers WebM/Opus (Chrome, Firefox) but falls back to MP4 (Safari).
 * Safe to call in SSR context (returns null when window is undefined).
 *
 * @returns The best supported MIME type or null if none supported
 */
export function getSupportedMimeType(): AudioMimeType | null {
  if (!isMediaRecorderSupported()) {
    return null;
  }

  for (const mimeType of MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

/**
 * Get duration of an audio blob in seconds.
 * Creates a temporary Audio element to read the duration.
 * Safe to call in SSR context (rejects when window is undefined).
 *
 * @param blob - Audio blob
 * @returns Promise resolving to duration in seconds
 */
export function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("getAudioDuration requires browser environment"));
      return;
    }

    const audio = new Audio();
    const url = URL.createObjectURL(blob);

    const cleanup = (): void => {
      URL.revokeObjectURL(url);
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("error", handleError);
    };

    const handleLoaded = (): void => {
      cleanup();
      // Handle Infinity duration (can happen with some WebM recordings)
      if (audio.duration === Infinity || isNaN(audio.duration)) {
        // Attempt to seek to get actual duration
        audio.currentTime = Number.MAX_SAFE_INTEGER;
        audio.ontimeupdate = (): void => {
          audio.ontimeupdate = null;
          audio.currentTime = 0;
          resolve(audio.duration);
        };
      } else {
        resolve(audio.duration);
      }
    };

    const handleError = (): void => {
      cleanup();
      reject(new Error("Failed to load audio for duration detection"));
    };

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("error", handleError);
    audio.src = url;
  });
}

/**
 * Validate voice message constraints.
 * Checks duration (1-300 seconds) and size (under 25MB for Whisper API).
 *
 * @param blob - Audio blob
 * @param duration - Duration in seconds
 * @returns Validation result with error message if invalid
 */
export function validateVoiceMessage(
  blob: Blob,
  duration: number
): ValidationResult {
  // Check minimum duration
  if (duration < MIN_DURATION_SECONDS) {
    return {
      valid: false,
      error: `Voice message must be at least ${MIN_DURATION_SECONDS} second`,
    };
  }

  // Check maximum duration
  if (duration > MAX_DURATION_SECONDS) {
    return {
      valid: false,
      error: `Voice message cannot exceed ${MAX_DURATION_SECONDS / 60} minutes`,
    };
  }

  // Check file size
  if (blob.size > MAX_SIZE_BYTES) {
    const maxMB = MAX_SIZE_BYTES / (1024 * 1024);
    return {
      valid: false,
      error: `Voice message cannot exceed ${maxMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Format duration in seconds to MM:SS display format.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "1:30")
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Get file extension for a given MIME type.
 *
 * @param mimeType - Audio MIME type
 * @returns File extension (e.g., "webm", "mp4")
 */
export function getExtensionForMimeType(
  mimeType: AudioMimeType | null
): string {
  switch (mimeType) {
    case "audio/webm;codecs=opus":
    case "audio/webm":
      return "webm";
    case "audio/mp4":
      return "mp4";
    case "audio/ogg":
      return "ogg";
    default:
      return "webm"; // Default fallback
  }
}
