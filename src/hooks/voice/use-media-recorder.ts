"use client";

import { useCallback, useRef, useState } from "react";
import {
  getSupportedMimeType,
  isMediaRecorderSupported,
  type AudioMimeType,
} from "@/lib/audio-utils";
import type { UseMediaRecorderReturn } from "./types";

/**
 * Hook for managing MediaRecorder operations.
 * Handles browser microphone permissions, recording state, and audio blob creation.
 *
 * @example
 * ```tsx
 * const {
 *   mediaRecorderRef,
 *   mediaStreamRef,
 *   state,
 *   mimeType,
 *   start,
 *   stop,
 *   pause,
 *   resume,
 *   cleanup,
 * } = useMediaRecorder();
 *
 * // Start recording
 * await start();
 *
 * // Later, stop and get blob
 * const blob = stop();
 * ```
 */
export function useMediaRecorder(): UseMediaRecorderReturn {
  // Recording state
  const [state, setState] = useState<"inactive" | "recording" | "paused">(
    "inactive"
  );

  // Refs for MediaRecorder and related resources
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Detect supported MIME type
  const mimeType = getSupportedMimeType() ?? "audio/webm";
  const isSupported =
    isMediaRecorderSupported() && getSupportedMimeType() !== null;

  /**
   * Clean up all resources (streams, recorder).
   */
  const cleanup = useCallback((): void => {
    // Stop MediaRecorder if not already inactive
    if (mediaRecorderRef.current?.state !== "inactive") {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // Ignore errors when stopping already stopped recorder
      }
    }
    mediaRecorderRef.current = null;

    // Stop media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Clear audio chunks
    audioChunksRef.current = [];
    setState("inactive");
  }, []);

  /**
   * Request microphone permission and start recording.
   * Returns the MediaStream for use by other hooks (e.g., waveform analysis).
   */
  const start = useCallback(async (): Promise<MediaStream> => {
    // Clean up any previous recording
    cleanup();
    audioChunksRef.current = [];

    // Request microphone permission
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    mediaStreamRef.current = stream;

    // Create MediaRecorder with best supported format
    const recorder = new MediaRecorder(stream, {
      mimeType: mimeType as AudioMimeType,
    });

    mediaRecorderRef.current = recorder;

    // Handle data available event
    recorder.ondataavailable = (event): void => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    // Handle state changes
    recorder.onstart = (): void => setState("recording");
    recorder.onpause = (): void => setState("paused");
    recorder.onresume = (): void => setState("recording");
    recorder.onstop = (): void => setState("inactive");

    // Start recording - collect data every second
    recorder.start(1000);

    return stream;
  }, [mimeType, cleanup]);

  /**
   * Stop recording and return the audio blob.
   */
  const stop = useCallback((): Blob | null => {
    if (!mediaRecorderRef.current) return null;

    if (mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    // Stop media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Create blob from chunks
    const chunks = audioChunksRef.current;
    if (chunks.length === 0) return null;

    return new Blob(chunks, { type: mimeType });
  }, [mimeType]);

  /**
   * Pause the current recording.
   */
  const pause = useCallback((): void => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
    }
  }, []);

  /**
   * Resume a paused recording.
   */
  const resume = useCallback((): void => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
    }
  }, []);

  return {
    mediaRecorderRef,
    mediaStreamRef,
    audioChunksRef,
    state,
    mimeType,
    isSupported,
    start,
    stop,
    pause,
    resume,
    cleanup,
  };
}
