"use client";

import { Play, Pause, Loader2, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { PLAYBACK_SPEEDS, type PlayerState, type PlaybackSpeed } from "./types";

// ============================================================================
// Helper: Format time display
// ============================================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ============================================================================
// PlayPauseButton Component
// ============================================================================

export interface PlayPauseButtonProps {
  state: PlayerState;
  isPlaying: boolean;
  onClick: () => void;
  onRetry: () => void;
}

/**
 * Play/pause button for VoicePlayer.
 * Shows loading spinner, retry button on error, or play/pause icon.
 */
export function PlayPauseButton({
  state,
  isPlaying,
  onClick,
  onRetry,
}: PlayPauseButtonProps): React.ReactElement {
  if (state === "loading") {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="Loading audio"
        className="shrink-0"
      >
        <Loader2 className="size-5 animate-spin" />
      </Button>
    );
  }

  if (state === "error") {
    return (
      <Tooltip>
        <TooltipTrigger
          onClick={onRetry}
          aria-label="Retry loading audio"
          className={cn(
            "inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-destructive transition-colors",
            "hover:bg-muted hover:text-destructive",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <RefreshCw className="size-5" />
        </TooltipTrigger>
        <TooltipContent>Retry loading audio</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={isPlaying ? "Pause" : "Play"}
      className="min-h-11 min-w-11 shrink-0"
    >
      {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
    </Button>
  );
}

// ============================================================================
// TimeDisplay Component
// ============================================================================

export interface TimeDisplayProps {
  currentTime: number;
  duration: number;
  isLoading: boolean;
}

/**
 * Time display showing current time and duration.
 */
export function TimeDisplay({
  currentTime,
  duration,
  isLoading,
}: TimeDisplayProps): React.ReactElement {
  if (isLoading) {
    return (
      <Skeleton className="h-4 w-16 shrink-0" aria-label="Loading time" />
    );
  }

  return (
    <div
      className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground tabular-nums"
      aria-label={`${formatTime(currentTime)} of ${formatTime(duration)}`}
    >
      <time dateTime={`PT${Math.floor(currentTime)}S`}>
        {formatTime(currentTime)}
      </time>
      <span aria-hidden="true">/</span>
      <time dateTime={`PT${Math.floor(duration)}S`}>
        {formatTime(duration)}
      </time>
    </div>
  );
}

// ============================================================================
// SpeedSelector Component
// ============================================================================

export interface SpeedSelectorProps {
  currentSpeed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  disabled: boolean;
}

/**
 * Dropdown menu for selecting playback speed.
 */
export function SpeedSelector({
  currentSpeed,
  onSpeedChange,
  disabled,
}: SpeedSelectorProps): React.ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium tabular-nums transition-colors",
          "hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
        aria-label={`Playback speed: ${currentSpeed}x. Click to change.`}
      >
        {currentSpeed}x
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PLAYBACK_SPEEDS.map((speed) => (
          <DropdownMenuItem
            key={speed}
            onClick={() => onSpeedChange(speed)}
            className={cn(
              "tabular-nums",
              speed === currentSpeed && "bg-accent"
            )}
          >
            {speed}x
            {speed === 1 && (
              <span className="ml-2 text-muted-foreground">(Normal)</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
