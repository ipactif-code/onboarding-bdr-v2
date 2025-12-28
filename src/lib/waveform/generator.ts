/**
 * Waveform generation utilities for audio visualization.
 * Uses Web Audio API to decode audio and extract amplitude data.
 */

import { DEFAULT_SAMPLES, MAX_SAMPLES, MIN_SAMPLES } from "./types";

/**
 * Generate waveform data from an audio blob for visualization.
 * Decodes the audio using Web Audio API and extracts normalized amplitude values.
 *
 * @param audioBlob - The audio blob to analyze
 * @param samples - Number of waveform samples to generate (default: 100, max: 1000)
 * @returns Promise resolving to array of normalized amplitude values (0-1)
 * @throws Error if audio decoding fails or Web Audio API is unavailable
 *
 * @example
 * ```tsx
 * const waveform = await generateWaveformData(audioBlob);
 * // waveform = [0.2, 0.5, 0.8, 0.3, ...] (100 values)
 *
 * // Use with custom sample count
 * const detailedWaveform = await generateWaveformData(audioBlob, 200);
 * ```
 */
export async function generateWaveformData(
  audioBlob: Blob,
  samples: number = DEFAULT_SAMPLES
): Promise<number[]> {
  // Validate samples parameter
  const normalizedSamples = Math.max(
    MIN_SAMPLES,
    Math.min(MAX_SAMPLES, Math.round(samples))
  );

  // Check for browser environment
  if (typeof window === "undefined") {
    throw new Error("generateWaveformData requires browser environment");
  }

  // Check for Web Audio API support
  if (
    typeof AudioContext === "undefined" &&
    typeof (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext === "undefined"
  ) {
    throw new Error("Web Audio API is not supported in this browser");
  }

  // Create AudioContext (with webkit fallback for older Safari)
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const audioContext = new AudioContextClass();

  try {
    // Convert blob to ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get the audio channel data (use first channel for mono/stereo)
    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;

    if (totalSamples === 0) {
      return new Array(normalizedSamples).fill(0) as number[];
    }

    // Calculate how many source samples per waveform sample
    const samplesPerBlock = Math.floor(totalSamples / normalizedSamples);

    const waveformData: number[] = [];

    for (let i = 0; i < normalizedSamples; i++) {
      const startIndex = i * samplesPerBlock;
      const endIndex = Math.min(startIndex + samplesPerBlock, totalSamples);

      // Calculate RMS (Root Mean Square) for this block
      // RMS gives a better representation of perceived loudness
      let sumOfSquares = 0;
      let count = 0;

      for (let j = startIndex; j < endIndex; j++) {
        const sample = channelData[j];
        if (sample !== undefined) {
          sumOfSquares += sample * sample;
          count++;
        }
      }

      const rms = count > 0 ? Math.sqrt(sumOfSquares / count) : 0;

      // Normalize to 0-1 range (audio samples are typically -1 to 1)
      // Multiply by sqrt(2) to account for RMS of sine wave
      const normalizedValue = Math.min(1, rms * Math.SQRT2);

      waveformData.push(normalizedValue);
    }

    return waveformData;
  } finally {
    // Always close the audio context to free resources
    await audioContext.close();
  }
}

/**
 * Generate waveform data from an audio URL for visualization.
 * Fetches the audio and decodes it using Web Audio API.
 *
 * @param audioUrl - URL of the audio file to analyze
 * @param samples - Number of waveform samples to generate (default: 100, max: 1000)
 * @returns Promise resolving to array of normalized amplitude values (0-1)
 * @throws Error if fetch fails, audio decoding fails, or Web Audio API is unavailable
 *
 * @example
 * ```tsx
 * const waveform = await generateWaveformFromUrl("https://example.com/audio.mp3");
 * // waveform = [0.2, 0.5, 0.8, 0.3, ...] (100 values)
 *
 * // Use with object URL from recorded audio
 * const recordedWaveform = await generateWaveformFromUrl(audioObjectUrl, 150);
 * ```
 */
export async function generateWaveformFromUrl(
  audioUrl: string,
  samples: number = DEFAULT_SAMPLES
): Promise<number[]> {
  // Check for browser environment
  if (typeof window === "undefined") {
    throw new Error("generateWaveformFromUrl requires browser environment");
  }

  // Fetch the audio data
  const response = await fetch(audioUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch audio: ${response.status} ${response.statusText}`
    );
  }

  const blob = await response.blob();

  return generateWaveformData(blob, samples);
}
