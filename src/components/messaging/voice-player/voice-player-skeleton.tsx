"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { WaveformDisplaySkeleton } from "@/components/messaging/waveform-display";

import type { VoicePlayerSkeletonProps } from "./types";

// ============================================================================
// VoicePlayerSkeleton Component
// ============================================================================

/**
 * Skeleton placeholder for VoicePlayer while loading.
 * Shows animated skeleton for all player elements.
 */
export function VoicePlayerSkeleton({
  showTranscription = true,
  className,
}: VoicePlayerSkeletonProps): React.ReactElement {
  return (
    <div
      data-slot="voice-player-skeleton"
      className={cn("rounded-lg border border-border bg-card p-3", className)}
      aria-label="Loading voice player"
      role="progressbar"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        {/* Play button skeleton */}
        <Skeleton className="size-8 shrink-0 rounded-lg" />

        {/* Waveform skeleton */}
        <WaveformDisplaySkeleton className="h-10 flex-1" barCount={60} />

        {/* Time skeleton */}
        <Skeleton className="h-4 w-16 shrink-0" />

        {/* Speed button skeleton */}
        <Skeleton className="h-6 w-10 shrink-0 rounded-md" />
      </div>

      {/* Transcription skeleton */}
      {showTranscription && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}
    </div>
  );
}
