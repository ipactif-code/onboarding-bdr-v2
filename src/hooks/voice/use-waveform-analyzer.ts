"use client";

import { useCallback, useRef, useState } from "react";
import type { UseWaveformAnalyzerReturn } from "./types";

/**
 * Number of samples to capture per waveform update.
 */
const WAVEFORM_SAMPLES_PER_UPDATE = 50;

/**
 * Interval for waveform updates in milliseconds.
 */
const WAVEFORM_UPDATE_INTERVAL = 100;

/**
 * Maximum samples to keep to prevent memory issues (60 seconds worth).
 */
const MAX_WAVEFORM_SAMPLES = WAVEFORM_SAMPLES_PER_UPDATE * 60;

/**
 * Hook for real-time audio waveform analysis using Web Audio API.
 * Captures amplitude data from a MediaStream for visualization.
 *
 * @example
 * ```tsx
 * const {
 *   waveformData,
 *   startAnalysis,
 *   stopAnalysis,
 *   resetWaveform,
 * } = useWaveformAnalyzer();
 *
 * // When starting recording
 * startAnalysis(mediaStream);
 *
 * // Use waveformData for visualization
 * <WaveformVisualizer data={waveformData} />
 *
 * // When stopping
 * stopAnalysis();
 * ```
 */
export function useWaveformAnalyzer(): UseWaveformAnalyzerReturn {
  const [waveformData, setWaveformData] = useState<number[]>([]);

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  /**
   * Clean up Web Audio API resources.
   */
  const cleanupAudioResources = useCallback((): void => {
    // Stop waveform interval
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }

    // Disconnect and clean up Web Audio nodes
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current?.state !== "closed") {
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    }

    dataArrayRef.current = null;
  }, []);

  /**
   * Calculate RMS amplitude from time domain data.
   */
  const calculateRms = useCallback((dataArray: Uint8Array<ArrayBuffer>): number => {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const sample = dataArray[i];
      if (sample !== undefined) {
        // Normalize to -1 to 1 range
        const normalized = (sample - 128) / 128;
        sum += normalized * normalized;
      }
    }
    return Math.sqrt(sum / dataArray.length);
  }, []);

  /**
   * Start capturing waveform data from an audio stream.
   */
  const startCapture = useCallback((): void => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    waveformIntervalRef.current = setInterval(() => {
      if (!analyserRef.current || !dataArrayRef.current) return;

      analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
      const rms = calculateRms(dataArrayRef.current);

      // Add sample to waveform (normalized 0-1)
      setWaveformData((prev) => {
        const newData = [...prev, Math.min(1, rms * 2)];
        // Keep only the last N samples to prevent memory issues
        if (newData.length > MAX_WAVEFORM_SAMPLES) {
          return newData.slice(-MAX_WAVEFORM_SAMPLES);
        }
        return newData;
      });
    }, WAVEFORM_UPDATE_INTERVAL);
  }, [calculateRms]);

  /**
   * Set up Web Audio API and start waveform analysis.
   */
  const startAnalysis = useCallback(
    (stream: MediaStream): void => {
      // Clean up any existing resources
      cleanupAudioResources();

      try {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        sourceRef.current = source;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

        // Start capturing waveform data
        startCapture();
      } catch {
        // Web Audio API may not be available in all contexts - fail silently
      }
    },
    [cleanupAudioResources, startCapture]
  );

  /**
   * Stop waveform analysis and clean up resources.
   */
  const stopAnalysis = useCallback((): void => {
    cleanupAudioResources();
  }, [cleanupAudioResources]);

  /**
   * Pause waveform analysis without cleaning up AudioContext.
   */
  const pauseAnalysis = useCallback((): void => {
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }
  }, []);

  /**
   * Resume waveform analysis after pause.
   */
  const resumeAnalysis = useCallback((): void => {
    if (analyserRef.current && dataArrayRef.current) {
      startCapture();
    }
  }, [startCapture]);

  /**
   * Reset waveform data to empty array.
   */
  const resetWaveform = useCallback((): void => {
    setWaveformData([]);
  }, []);

  return {
    waveformData,
    startAnalysis,
    stopAnalysis,
    pauseAnalysis,
    resumeAnalysis,
    resetWaveform,
    analyserRef,
  };
}
