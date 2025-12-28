/**
 * Transcription helper module for voice messages.
 *
 * T109: OpenAI Whisper integration for audio transcription.
 *
 * This module handles:
 * - Audio transcription via OpenAI Whisper API
 * - Cost estimation for transcription usage
 * - Error handling for API failures
 */

import OpenAI from "openai";

/**
 * Result of a transcription attempt.
 */
export interface TranscriptionResult {
  /** Whether the transcription was successful. */
  success: boolean;
  /** The transcribed text (if successful). */
  text?: string;
  /** The detected language (if available). */
  language?: string;
  /** The audio duration in seconds (if available). */
  duration?: number;
  /** Error message (if failed). */
  error?: string;
}

/**
 * OpenAI Whisper pricing constants.
 * Price is $0.006 per minute of audio.
 */
const WHISPER_PRICE_PER_MINUTE_CENTS = 0.6; // $0.006 = 0.6 cents

/**
 * Calculate the estimated cost in cents for transcribing audio.
 *
 * @param durationSeconds - The duration of the audio in seconds.
 * @returns The estimated cost in cents.
 */
export function estimateTranscriptionCostCents(durationSeconds: number): number {
  const durationMinutes = durationSeconds / 60;
  return Math.ceil(durationMinutes * WHISPER_PRICE_PER_MINUTE_CENTS);
}

/**
 * Transcribe audio from a URL using OpenAI Whisper API.
 *
 * This function:
 * 1. Fetches the audio file from the provided URL
 * 2. Sends it to OpenAI Whisper for transcription
 * 3. Returns the transcribed text and metadata
 *
 * **Note**: This should only be called from an action (internalAction)
 * because it makes external API calls.
 *
 * @param audioUrl - The URL of the audio file to transcribe (Convex Storage URL).
 * @param mimeType - The MIME type of the audio file (e.g., "audio/webm").
 * @returns A TranscriptionResult with the transcribed text or error.
 *
 * @example
 * ```typescript
 * const result = await transcribeAudio(
 *   "https://convex.storage/xxx/audio.webm",
 *   "audio/webm"
 * );
 * if (result.success) {
 *   console.log("Transcription:", result.text);
 * } else {
 *   console.error("Error:", result.error);
 * }
 * ```
 */
export async function transcribeAudio(
  audioUrl: string,
  mimeType: string
): Promise<TranscriptionResult> {
  // Validate environment variable
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.",
    };
  }

  try {
    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Fetch the audio file from Convex Storage
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch audio file: HTTP ${audioResponse.status}`,
      };
    }

    const audioBuffer = await audioResponse.arrayBuffer();

    // Determine file extension from MIME type
    const extension = getExtensionFromMimeType(mimeType);

    // Create a File object for the OpenAI API
    // Note: In Node.js, we use the File constructor from the global scope
    const audioFile = new File([audioBuffer], `audio.${extension}`, {
      type: mimeType,
    });

    // Call OpenAI Whisper API with verbose output for duration
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json",
    });

    return {
      success: true,
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
    };
  } catch (error) {
    // Handle OpenAI API errors - sanitize to avoid leaking sensitive info
    if (error instanceof OpenAI.APIError) {
      // Map to user-friendly messages without exposing internal details
      const sanitizedMessage = sanitizeOpenAIError(error);
      return {
        success: false,
        error: sanitizedMessage,
      };
    }

    // Handle other errors - generic message
    console.error("Transcription error:", error);
    return {
      success: false,
      error: "Transcription service temporarily unavailable. Please try again.",
    };
  }
}

/**
 * Sanitize OpenAI API errors to user-friendly messages.
 * Avoids leaking API keys, internal endpoints, or sensitive error details.
 */
function sanitizeOpenAIError(error: InstanceType<typeof OpenAI.APIError>): string {
  const status = error.status;

  switch (status) {
    case 400:
      return "Invalid audio format. Please try a different recording.";
    case 401:
      return "Transcription service configuration error. Please contact support.";
    case 429:
      return "Transcription service is busy. Please try again in a few minutes.";
    case 500:
    case 502:
    case 503:
      return "Transcription service temporarily unavailable. Please try again later.";
    default:
      return "Transcription failed. Please try again.";
  }
}

/**
 * Extract base MIME type without codec information.
 *
 * Browsers may send MIME types with codec info (e.g., "audio/webm;codecs=opus").
 * This function extracts just the base type for validation and extension lookup.
 *
 * @param mimeType - The full MIME type, possibly with codec info.
 * @returns The base MIME type (e.g., "audio/webm").
 */
function extractBaseMimeType(mimeType: string): string {
  const parts = mimeType.split(";");
  const basePart = parts[0] ?? mimeType;
  return basePart.toLowerCase().trim();
}

/**
 * Get file extension from MIME type.
 *
 * Handles MIME types with codec information (e.g., "audio/webm;codecs=opus").
 *
 * @param mimeType - The MIME type of the audio file.
 * @returns The file extension without the dot.
 */
function getExtensionFromMimeType(mimeType: string): string {
  const baseMimeType = extractBaseMimeType(mimeType);

  const mimeToExtension: Record<string, string> = {
    "audio/webm": "webm",
    "video/webm": "webm", // Some browsers use video/webm for audio recordings
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
  };

  return mimeToExtension[baseMimeType] ?? "webm";
}

/**
 * Validate that an audio file is acceptable for transcription.
 *
 * Handles MIME types with codec information (e.g., "audio/webm;codecs=opus").
 * Extracts the base MIME type before validation.
 *
 * @param mimeType - The MIME type of the audio file (may include codec info).
 * @param fileSize - The file size in bytes.
 * @returns An object indicating whether the file is valid, with an error message if not.
 */
export function validateAudioFile(
  mimeType: string,
  fileSize: number
): { valid: boolean; error?: string } {
  // Extract base MIME type without codec info (e.g., "audio/webm;codecs=opus" -> "audio/webm")
  const baseMimeType = extractBaseMimeType(mimeType);

  // Supported base MIME types (based on OpenAI Whisper documentation)
  const supportedMimeTypes = [
    "audio/webm",
    "video/webm", // Some browsers use video/webm for audio recordings
    "audio/mp3",
    "audio/mpeg",
    "audio/mpga",
    "audio/mp4",
    "audio/m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "audio/flac",
  ];

  if (!supportedMimeTypes.includes(baseMimeType)) {
    return {
      valid: false,
      error: `Unsupported audio format: ${baseMimeType}. Supported formats: webm, mp3, mp4, m4a, wav, ogg, flac.`,
    };
  }

  // Max file size: 25MB (OpenAI Whisper limit)
  const maxFileSize = 25 * 1024 * 1024;
  if (fileSize > maxFileSize) {
    return {
      valid: false,
      error: `Audio file too large: ${(fileSize / (1024 * 1024)).toFixed(2)}MB. Maximum size is 25MB.`,
    };
  }

  return { valid: true };
}
