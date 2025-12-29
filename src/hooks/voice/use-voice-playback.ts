"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import type {
  UseVoicePlaybackOptions,
  UseVoicePlaybackReturn,
} from "@/components/messaging/voice-player/types";

/**
 * Hook for managing WaveSurfer.js audio playback.
 *
 * Provides play/pause controls, seeking, and playback rate adjustment
 * with proper cleanup on unmount.
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 *
 * const {
 *   isPlaying,
 *   currentTime,
 *   play,
 *   pause,
 *   seekTo,
 *   setPlaybackRate,
 * } = useVoicePlayback({
 *   containerRef,
 *   audioUrl: "https://example.com/audio.mp3",
 *   duration: 120,
 *   onReady: () => setPlayerReady(true),
 *   onError: () => setPlayerError(true),
 * });
 * ```
 */
export function useVoicePlayback({
  containerRef,
  audioUrl,
  waveformData,
  duration,
  onReady,
  onError,
  onTimeUpdate,
  onFinish,
}: UseVoicePlaybackOptions): UseVoicePlaybackReturn {
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Detected duration from WaveSurfer (source of truth for playback)
  // Falls back to prop duration if detection fails
  const [detectedDuration, setDetectedDuration] = useState<number>(duration);

  // Initialize WaveSurfer
  // Note: We use setTimeout(fn, 0) to defer initialization to the next tick.
  // This ensures containerRef.current is populated after React's commit phase,
  // since refs are assigned AFTER mount and this effect runs during mount.
  useEffect(() => {
    // Validate audio URL before attempting to load
    if (!audioUrl || typeof audioUrl !== "string" || !audioUrl.startsWith("http")) {
      onError?.(new Error("Invalid audio URL"));
      return;
    }

    // Defer initialization to next tick to ensure ref is populated
    const initTimeout = setTimeout(() => {
      if (!containerRef.current) {
        onError?.(new Error("Container element not found"));
        return;
      }

      const wavesurfer = WaveSurfer.create({
        container: containerRef.current,
        backend: "MediaElement", // Recommended for streaming with pre-computed peaks
        waveColor: "hsl(var(--muted-foreground) / 0.3)",
        progressColor: "hsl(var(--primary))",
        cursorColor: "transparent",
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 40,
        normalize: true,
        hideScrollbar: true,
        interact: true,
      });

      wavesurferRef.current = wavesurfer;

      // Track ready state to prevent double-firing when using pre-computed peaks
      // The "ready" event may not fire when peaks are provided, so we use "decode" as fallback
      let isReady = false;

      const handleReady = (): void => {
        if (!isReady) {
          isReady = true;

          // Get actual duration from WaveSurfer (source of truth)
          // This fixes playback display for old messages with incorrect stored durations
          const wavesurferDuration = wavesurfer.getDuration();
          if (wavesurferDuration && isFinite(wavesurferDuration) && wavesurferDuration > 0) {
            setDetectedDuration(wavesurferDuration);
          }

          onReady?.();
        }
      };

      // Event listeners
      wavesurfer.on("ready", handleReady);

      // Fallback: "decode" event fires when audio is decoded, even with pre-computed peaks
      // This ensures we transition out of "loading" state
      wavesurfer.on("decode", handleReady);

      wavesurfer.on("error", (error) => {
        console.error("[useVoicePlayback] WaveSurfer error:", error);
        onError?.(error instanceof Error ? error : new Error(String(error)));
      });

      wavesurfer.on("timeupdate", (time) => {
        setCurrentTime(time);
        onTimeUpdate?.(time);
      });

      wavesurfer.on("play", () => {
        setIsPlaying(true);
      });

      wavesurfer.on("pause", () => {
        setIsPlaying(false);
      });

      wavesurfer.on("finish", () => {
        setIsPlaying(false);
        setCurrentTime(0);
        onFinish?.();
      });

      // Load audio with pre-computed peaks if available
      if (waveformData && waveformData.length > 0) {
        // Use pre-computed waveform data for instant display
        // Note: We listen to both "ready" and "decode" events above because
        // "ready" may not fire when peaks are provided
        wavesurfer.load(audioUrl, [waveformData], duration).catch((err) => {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        });
      } else {
        // Load and decode audio to generate waveform
        wavesurfer.load(audioUrl).catch((err) => {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        });
      }
    }, 0);

    // Track ready state outside the setTimeout scope to detect stuck loading
    let audioIsReady = false;

    // Poll for ready state - wavesurfer.getDuration() > 0 indicates audio is loaded
    const readyCheckInterval = setInterval(() => {
      if (wavesurferRef.current?.getDuration() && wavesurferRef.current.getDuration() > 0) {
        audioIsReady = true;
        clearInterval(readyCheckInterval);
      }
    }, 500);

    // Add timeout to detect stuck loading state
    const loadTimeout = setTimeout(() => {
      clearInterval(readyCheckInterval);
      if (!audioIsReady) {
        onError?.(new Error("Audio loading timeout"));
      }
    }, 15000); // 15 second timeout

    // Cleanup
    return () => {
      clearTimeout(initTimeout);
      clearTimeout(loadTimeout);
      clearInterval(readyCheckInterval);
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
    // NOTE: Dependencies intentionally excluded for stable initialization behavior:
    // - onReady, onError, onTimeUpdate, onFinish: Callbacks should not trigger re-initialization.
    //   These are event handlers passed by consumers and may change frequently.
    // - waveformData: Audio data reference that should not trigger re-initialization.
    //   The effect only needs to reinitialize when the audioUrl itself changes.
    // - duration: Configuration value that should not trigger re-initialization.
    //   The effect only needs to reinitialize when the audioUrl itself changes.
    // Only re-initialize when audioUrl changes to avoid resource leaks and duplicate initializations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]); // Only re-initialize on URL change

  const play = useCallback(async (): Promise<void> => {
    if (wavesurferRef.current) {
      await wavesurferRef.current.play();
    }
  }, []);

  const pause = useCallback((): void => {
    if (wavesurferRef.current) {
      wavesurferRef.current.pause();
    }
  }, []);

  const seekTo = useCallback((progress: number): void => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(progress);
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number): void => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(rate, true);
    }
  }, []);

  return {
    isPlaying,
    currentTime,
    // Detected duration from WaveSurfer - use for display instead of prop
    // This fixes old messages with incorrect stored durations
    detectedDuration,
    play,
    pause,
    seekTo,
    setPlaybackRate,
  };
}
