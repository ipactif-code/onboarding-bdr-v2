"use client";

import { cn } from "@/lib/utils";
import { WAVEFORM_BAR_COUNT, type WaveformVisualizerProps } from "./types";

/**
 * Downsample waveform data to a fixed number of bars.
 */
function downsampleWaveform(data: number[], targetCount: number): number[] {
  if (data.length === 0) {
    return Array(targetCount).fill(0.1) as number[];
  }

  if (data.length <= targetCount) {
    // Pad with zeros if we don't have enough data
    const result = [...data];
    while (result.length < targetCount) {
      result.push(0.1);
    }
    return result;
  }

  // Downsample by averaging chunks
  const chunkSize = Math.floor(data.length / targetCount);
  const result: number[] = [];

  for (let i = 0; i < targetCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, data.length);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += data[j] ?? 0;
    }
    result.push(sum / (end - start));
  }

  return result;
}

/**
 * Waveform visualization component.
 *
 * Displays audio waveform as vertical bars with optional animation.
 * Used for real-time visualization during recording and preview playback.
 */
export function WaveformVisualizer({
  data,
  isAnimating = false,
  className,
}: WaveformVisualizerProps): React.ReactElement {
  const bars = downsampleWaveform(data, WAVEFORM_BAR_COUNT);

  return (
    <div
      className={cn("flex h-8 items-end justify-center gap-0.5", className)}
      role="img"
      aria-label="Audio waveform visualization"
    >
      {bars.map((amplitude, index) => {
        // Ensure minimum height for visibility
        const height = Math.max(0.1, Math.min(1, amplitude));
        const heightPercent = height * 100;

        return (
          <div
            key={index}
            className={cn(
              "w-1 rounded-full bg-primary/80 transition-all duration-75",
              isAnimating && "motion-safe:animate-pulse"
            )}
            style={{
              height: `${heightPercent}%`,
              minHeight: "4px",
            }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}
