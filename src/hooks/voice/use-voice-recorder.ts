"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioDuration, validateVoiceMessage } from "@/lib/audio-utils";
import { useMediaRecorder } from "./use-media-recorder";
import { useWaveformAnalyzer } from "./use-waveform-analyzer";
import type { UseVoiceRecorderOptions, UseVoiceRecorderReturn } from "./types";

/**
 * Default minimum recording duration in seconds.
 */
const DEFAULT_MIN_DURATION = 1;

/**
 * Default maximum recording duration in seconds (5 minutes).
 */
const DEFAULT_MAX_DURATION = 300;

/**
 * Interval for duration updates in milliseconds.
 */
const DURATION_UPDATE_INTERVAL = 100;

/**
 * Hook for recording voice messages with real-time waveform visualization.
 *
 * Orchestrates MediaRecorder and waveform analysis hooks to provide:
 * - Browser microphone permission requests
 * - MediaRecorder with format detection (WebM/Opus preferred, MP4/AAC fallback)
 * - Real-time duration tracking
 * - Duration validation (min/max constraints)
 * - Real-time waveform data generation using Web Audio API
 * - Proper cleanup of resources (streams, object URLs)
 *
 * @example
 * ```tsx
 * const {
 *   isRecording,
 *   duration,
 *   waveformData,
 *   audioBlob,
 *   startRecording,
 *   stopRecording,
 *   resetRecording,
 *   error,
 * } = useVoiceRecorder({
 *   maxDuration: 120,
 *   onMaxDurationReached: () => toast.info("Maximum duration reached"),
 * });
 *
 * return (
 *   <div>
 *     {isRecording ? (
 *       <>
 *         <WaveformVisualizer data={waveformData} />
 *         <span>{formatDuration(duration)}</span>
 *         <button onClick={stopRecording}>Stop</button>
 *       </>
 *     ) : (
 *       <button onClick={startRecording}>Record</button>
 *     )}
 *     {error && <span className="text-destructive">{error}</span>}
 *   </div>
 * );
 * ```
 */
export function useVoiceRecorder(
  options: UseVoiceRecorderOptions = {}
): UseVoiceRecorderReturn {
  const {
    minDuration = DEFAULT_MIN_DURATION,
    maxDuration = DEFAULT_MAX_DURATION,
    onMaxDurationReached,
  } = options;

  // Use sub-hooks
  const mediaRecorder = useMediaRecorder();
  const waveformAnalyzer = useWaveformAnalyzer();

  // Orchestration state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Duration tracking refs
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  /**
   * Clean up duration interval.
   */
  const cleanupDurationInterval = useCallback((): void => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  /**
   * Revoke the current audio object URL if it exists.
   */
  const revokeAudioUrl = useCallback((): void => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }, [audioUrl]);

  /**
   * Start duration tracking interval.
   */
  const startDurationTracking = useCallback((): void => {
    durationIntervalRef.current = setInterval(() => {
      const elapsed =
        (Date.now() - startTimeRef.current) / 1000 + pausedDurationRef.current;
      setDuration(elapsed);

      // Check max duration
      if (elapsed >= maxDuration) {
        onMaxDurationReached?.();
        // Auto-stop will be handled by the effect
      }
    }, DURATION_UPDATE_INTERVAL);
  }, [maxDuration, onMaxDurationReached]);

  /**
   * Start recording audio from the microphone.
   */
  const startRecording = useCallback(async (): Promise<void> => {
    // Check browser support
    if (!mediaRecorder.isSupported) {
      setError("Voice recording is not supported in this browser");
      return;
    }

    // Clean up previous recording
    revokeAudioUrl();
    setError(null);
    setAudioBlob(null);
    setDuration(0);
    waveformAnalyzer.resetWaveform();
    pausedDurationRef.current = 0;

    try {
      // Start media recorder and get stream
      const stream = await mediaRecorder.start();

      // Start waveform analysis
      waveformAnalyzer.startAnalysis(stream);

      // Start duration tracking
      startTimeRef.current = Date.now();
      startDurationTracking();

      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      // Handle permission denied or device not found
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setError(
            "Microphone permission denied. Please allow access to record."
          );
        } else if (err.name === "NotFoundError") {
          setError("No microphone found. Please connect a microphone.");
        } else if (err.name === "NotReadableError") {
          setError("Microphone is in use by another application.");
        } else {
          setError(`Microphone error: ${err.message}`);
        }
      } else {
        setError("Failed to start recording. Please try again.");
      }
      mediaRecorder.cleanup();
      setIsRecording(false);
    }
  }, [
    mediaRecorder,
    waveformAnalyzer,
    revokeAudioUrl,
    startDurationTracking,
  ]);

  /**
   * Stop the current recording and finalize the audio blob.
   * Uses actual audio blob metadata for accurate duration.
   */
  const stopRecording = useCallback(async (): Promise<void> => {
    // Calculate preliminary duration from wall-clock for minimum check
    const preliminaryDuration =
      (Date.now() - startTimeRef.current) / 1000 + pausedDurationRef.current;

    // Validate minimum duration (quick check before processing blob)
    if (preliminaryDuration < minDuration) {
      setError(
        `Recording must be at least ${minDuration} second${minDuration !== 1 ? "s" : ""}`
      );
      mediaRecorder.cleanup();
      waveformAnalyzer.stopAnalysis();
      cleanupDurationInterval();
      setIsRecording(false);
      setIsPaused(false);
      return;
    }

    // Stop media recorder and get blob
    const blob = mediaRecorder.stop();

    // Stop waveform analysis
    waveformAnalyzer.stopAnalysis();

    // Stop duration tracking
    cleanupDurationInterval();

    if (blob) {
      try {
        // Get actual duration from audio blob metadata
        const actualDuration = await getAudioDuration(blob);

        // Validate the recording with actual duration
        const validation = validateVoiceMessage(blob, actualDuration);
        if (!validation.valid) {
          setError(validation.error ?? "Invalid recording");
          setIsRecording(false);
          setIsPaused(false);
          return;
        }

        // Update duration with actual value from blob metadata
        setDuration(actualDuration);

        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
      } catch (durationError) {
        // Fallback to wall-clock duration if metadata extraction fails
        console.warn(
          "Failed to get audio duration from metadata, using wall-clock duration:",
          durationError
        );
        const validation = validateVoiceMessage(blob, preliminaryDuration);
        if (!validation.valid) {
          setError(validation.error ?? "Invalid recording");
          setIsRecording(false);
          setIsPaused(false);
          return;
        }

        setDuration(preliminaryDuration);
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
      }
    }

    setIsRecording(false);
    setIsPaused(false);
  }, [minDuration, mediaRecorder, waveformAnalyzer, cleanupDurationInterval]);

  /**
   * Pause the current recording.
   */
  const pauseRecording = useCallback((): void => {
    if (mediaRecorder.state !== "recording") return;

    mediaRecorder.pause();
    waveformAnalyzer.pauseAnalysis();

    // Store accumulated duration
    pausedDurationRef.current += (Date.now() - startTimeRef.current) / 1000;
    cleanupDurationInterval();

    setIsPaused(true);
  }, [mediaRecorder, waveformAnalyzer, cleanupDurationInterval]);

  /**
   * Resume a paused recording.
   */
  const resumeRecording = useCallback((): void => {
    if (mediaRecorder.state !== "paused") return;

    mediaRecorder.resume();
    waveformAnalyzer.resumeAnalysis();

    // Reset start time for fresh tracking
    startTimeRef.current = Date.now();
    startDurationTracking();

    setIsPaused(false);
  }, [mediaRecorder, waveformAnalyzer, startDurationTracking]);

  /**
   * Reset all recording state and release resources.
   */
  const resetRecording = useCallback((): void => {
    mediaRecorder.cleanup();
    waveformAnalyzer.stopAnalysis();
    waveformAnalyzer.resetWaveform();
    cleanupDurationInterval();
    revokeAudioUrl();

    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setAudioBlob(null);
    setError(null);
    pausedDurationRef.current = 0;
  }, [
    mediaRecorder,
    waveformAnalyzer,
    cleanupDurationInterval,
    revokeAudioUrl,
  ]);

  // Auto-stop when max duration reached
  useEffect(() => {
    if (duration >= maxDuration && isRecording && !isPaused) {
      stopRecording();
    }
  }, [duration, maxDuration, isRecording, isPaused, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mediaRecorder.cleanup();
      waveformAnalyzer.stopAnalysis();
      cleanupDurationInterval();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
    // NOTE: Empty dependency array intentionally used with eslint disable.
    // This effect runs ONLY on component unmount to clean up resources.
    // Including dependencies would cause cleanup to run on every render,
    // defeating the purpose of cleanup-on-unmount behavior.
    // Dependencies (mediaRecorder, waveformAnalyzer, cleanupDurationInterval, audioUrl)
    // are stable objects that should not trigger cleanup re-runs during component lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // State
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    error,
    waveformData: waveformAnalyzer.waveformData,
    // Controls
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    // Metadata
    mimeType: mediaRecorder.mimeType,
    isSupported: mediaRecorder.isSupported,
  };
}
