"use client";

import { cn } from "@/lib/utils";
import { WAVEFORM_BAR_COUNT } from "./types";

/**
 * Props for VoiceRecorderSkeleton component.
 */
interface VoiceRecorderSkeletonProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Skeleton loader for VoiceRecorder.
 *
 * Displays animated placeholder UI while the recorder is loading.
 * Mimics the recording state layout with header, waveform, and controls.
 */
export function VoiceRecorderSkeleton({
  className,
}: VoiceRecorderSkeletonProps): React.ReactElement {
  return (
    <div
      data-slot="voice-recorder-skeleton"
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-3",
        className
      )}
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-2 motion-safe:animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-8 motion-safe:animate-pulse rounded bg-muted" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-16 motion-safe:animate-pulse rounded bg-muted" />
          <div className="h-1 w-16 motion-safe:animate-pulse rounded-full bg-muted" />
        </div>
      </div>

      {/* Waveform skeleton */}
      <div className="flex h-8 items-end justify-center gap-0.5 py-2">
        {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, i) => (
          <div
            key={i}
            className="w-1 motion-safe:animate-pulse rounded-full bg-muted"
            style={{
              height: `${Math.random() * 60 + 20}%`,
              animationDelay: `${i * 50}ms`,
            }}
          />
        ))}
      </div>

      {/* Controls skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-16 motion-safe:animate-pulse rounded bg-muted" />
        <div className="flex items-center gap-2">
          <div className="size-8 motion-safe:animate-pulse rounded-lg bg-muted" />
          <div className="size-8 motion-safe:animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
