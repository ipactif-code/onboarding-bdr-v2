"use client";

import { cn } from "@/lib/utils";
import { formatDuration, type RecordingTimerProps } from "./types";

/**
 * Recording indicator with pulsing dot.
 *
 * Shows "REC" with a pulsing red dot while recording,
 * or "Paused" with an amber dot when paused.
 */
function RecordingIndicator({
  isPaused,
}: {
  isPaused: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "size-2 rounded-full",
          isPaused ? "bg-amber-500" : "bg-destructive motion-safe:animate-pulse"
        )}
        aria-hidden="true"
      />
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {isPaused ? "Paused" : "REC"}
      </span>
    </div>
  );
}

/**
 * Progress bar showing recording progress towards max duration.
 *
 * Changes to amber color when approaching the limit (80%+).
 */
function DurationProgress({
  current,
  max,
}: {
  current: number;
  max: number;
}): React.ReactElement {
  const progress = Math.min((current / max) * 100, 100);
  const isNearLimit = current >= max * 0.8;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "text-xs tabular-nums flex items-center gap-1",
          isNearLimit ? "text-amber-500 font-medium" : "text-muted-foreground"
        )}
      >
        <time dateTime={`PT${Math.floor(current)}S`}>
          {formatDuration(current)}
        </time>
        <span aria-hidden="true">/</span>
        <time dateTime={`PT${Math.floor(max)}S`}>
          {formatDuration(max)}
        </time>
      </div>
      <div
        className="h-1 w-16 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Recording duration"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-valuetext={`${formatDuration(current)} of ${formatDuration(max)} maximum`}
      >
        <div
          className={cn(
            "h-full transition-all duration-100",
            isNearLimit ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Recording timer component.
 *
 * Displays recording indicator and duration progress bar.
 * Used in the header during recording/paused states.
 */
export function RecordingTimer({
  current,
  max,
  isPaused,
}: RecordingTimerProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <RecordingIndicator isPaused={isPaused} />
      <DurationProgress current={current} max={max} />
    </div>
  );
}
