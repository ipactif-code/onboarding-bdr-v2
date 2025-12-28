"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { WaveformDisplay } from "./waveform-display";

// ============================================================================
// Types
// ============================================================================

export interface WaveformDisplaySkeletonProps {
  /** Number of bars to show in skeleton */
  barCount?: number;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// WaveformDisplaySkeleton Component
// ============================================================================

/**
 * Skeleton placeholder for WaveformDisplay while loading.
 * Shows animated bars with random heights.
 */
export function WaveformDisplaySkeleton({
  barCount = 50,
  className,
}: WaveformDisplaySkeletonProps): React.ReactElement {
  // Generate pseudo-random heights for visual interest
  const skeletonData = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      // Use a simple deterministic pattern for consistent skeleton appearance
      return 0.3 + Math.abs(Math.sin(i * 0.5)) * 0.5;
    });
  }, [barCount]);

  return (
    <div
      data-slot="waveform-display-skeleton"
      className={cn("h-8 w-full motion-safe:animate-pulse", className)}
      aria-label="Loading waveform"
      role="progressbar"
      aria-busy="true"
    >
      <WaveformDisplay
        data={skeletonData}
        barColor="hsl(var(--muted))"
        className="opacity-50"
        ariaLabel="Loading waveform"
      />
    </div>
  );
}
