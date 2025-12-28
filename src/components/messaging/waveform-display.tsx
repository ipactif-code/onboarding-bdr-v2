"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface WaveformDisplayProps {
  /** Normalized amplitude values (0-1) for each bar */
  data: number[];
  /** Playback progress as a value between 0-1 */
  progress?: number;
  /** Additional CSS classes */
  className?: string;
  /** Color for unplayed bars */
  barColor?: string;
  /** Color for played (progress) bars */
  progressColor?: string;
  /** Width of each bar in pixels */
  barWidth?: number;
  /** Gap between bars in pixels */
  barGap?: number;
  /** Minimum height of bars in pixels (for visual consistency) */
  minBarHeight?: number;
  /** Maximum height of bars in pixels */
  maxBarHeight?: number;
  /** Whether to render as interactive (clickable for seeking) */
  interactive?: boolean;
  /** Callback when user clicks on waveform (progress 0-1) */
  onSeek?: (progress: number) => void;
  /** Accessible label for the waveform */
  ariaLabel?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BAR_COLOR = "hsl(var(--muted-foreground) / 0.3)";
const DEFAULT_PROGRESS_COLOR = "hsl(var(--primary))";
const DEFAULT_BAR_WIDTH = 2;
const DEFAULT_BAR_GAP = 1;
const DEFAULT_MIN_BAR_HEIGHT = 2;
const DEFAULT_MAX_BAR_HEIGHT = 32;

// ============================================================================
// WaveformDisplay Component
// ============================================================================

/**
 * WaveformDisplay renders a static or semi-interactive audio waveform visualization.
 * Uses pure CSS/SVG for rendering, making it lightweight for message previews.
 * For full WaveSurfer.js integration, use the VoicePlayer component.
 *
 * @example
 * ```tsx
 * // Static preview
 * <WaveformDisplay data={waveformData} />
 *
 * // With playback progress
 * <WaveformDisplay data={waveformData} progress={0.5} />
 *
 * // Interactive with seeking
 * <WaveformDisplay
 *   data={waveformData}
 *   progress={currentTime / duration}
 *   interactive
 *   onSeek={(p) => audioRef.current.currentTime = p * duration}
 * />
 * ```
 */
function WaveformDisplayComponent({
  data,
  progress = 0,
  className,
  barColor = DEFAULT_BAR_COLOR,
  progressColor = DEFAULT_PROGRESS_COLOR,
  barWidth = DEFAULT_BAR_WIDTH,
  barGap = DEFAULT_BAR_GAP,
  minBarHeight = DEFAULT_MIN_BAR_HEIGHT,
  maxBarHeight = DEFAULT_MAX_BAR_HEIGHT,
  interactive = false,
  onSeek,
  ariaLabel = "Audio waveform",
}: WaveformDisplayProps): React.ReactElement {
  // Calculate dimensions
  const totalWidth = useMemo(() => {
    return data.length * barWidth + (data.length - 1) * barGap;
  }, [data.length, barWidth, barGap]);

  // Calculate which bar index corresponds to current progress
  const progressBarIndex = useMemo(() => {
    return Math.floor(progress * data.length);
  }, [progress, data.length]);

  // Handle click for seeking
  const handleClick = (event: React.MouseEvent<SVGSVGElement>): void => {
    if (!interactive || !onSeek) return;

    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const seekProgress = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(seekProgress);
  };

  // Handle keyboard navigation for accessibility
  const handleKeyDown = (event: React.KeyboardEvent<SVGSVGElement>): void => {
    if (!interactive || !onSeek) return;

    const step = 0.05; // 5% per key press
    let newProgress = progress;

    switch (event.key) {
      case "ArrowLeft":
        newProgress = Math.max(0, progress - step);
        event.preventDefault();
        break;
      case "ArrowRight":
        newProgress = Math.min(1, progress + step);
        event.preventDefault();
        break;
      case "Home":
        newProgress = 0;
        event.preventDefault();
        break;
      case "End":
        newProgress = 1;
        event.preventDefault();
        break;
      default:
        return;
    }

    onSeek(newProgress);
  };

  // If no data, render empty placeholder
  if (data.length === 0) {
    return (
      <div
        data-slot="waveform-display"
        className={cn("flex h-8 items-center justify-center", className)}
        aria-label={ariaLabel}
      >
        <span className="text-xs text-muted-foreground">No waveform data</span>
      </div>
    );
  }

  return (
    <svg
      data-slot="waveform-display"
      className={cn(
        "h-full w-full",
        interactive && "cursor-pointer",
        className
      )}
      viewBox={`0 0 ${totalWidth} ${maxBarHeight}`}
      preserveAspectRatio="none"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? "slider" : "img"}
      aria-label={ariaLabel}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? Math.round(progress * 100) : undefined}
      aria-valuetext={
        interactive ? `${Math.round(progress * 100)}% played` : undefined
      }
    >
      {data.map((amplitude, index) => {
        // Calculate bar height based on amplitude (0-1)
        const height = Math.max(
          minBarHeight,
          amplitude * (maxBarHeight - minBarHeight) + minBarHeight
        );

        // Calculate x position for this bar
        const x = index * (barWidth + barGap);

        // Calculate y position to center the bar vertically
        const y = (maxBarHeight - height) / 2;

        // Determine if this bar is in the "played" section
        const isPlayed = index < progressBarIndex;

        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={height}
            rx={barWidth / 2}
            ry={barWidth / 2}
            fill={isPlayed ? progressColor : barColor}
            className="transition-[fill] duration-100"
          />
        );
      })}
    </svg>
  );
}

// Memoize for performance - waveform data doesn't change often
export const WaveformDisplay = memo(WaveformDisplayComponent);

// ============================================================================
// Re-export skeleton for backward compatibility
// ============================================================================

export {
  WaveformDisplaySkeleton,
  type WaveformDisplaySkeletonProps,
} from "./waveform-skeleton";

// ============================================================================
// Utility: Generate placeholder waveform
// ============================================================================

/**
 * Generates placeholder waveform data for display before real data is available.
 * Creates a visually interesting pattern without actual audio analysis.
 *
 * @param length - Number of data points to generate
 * @returns Array of normalized amplitude values (0-1)
 */
export function generatePlaceholderWaveform(length: number = 50): number[] {
  return Array.from({ length }, (_, i) => {
    // Create a wave-like pattern
    const wave1 = Math.sin((i / length) * Math.PI * 3) * 0.3;
    const wave2 = Math.sin((i / length) * Math.PI * 7) * 0.2;
    const base = 0.4;
    return Math.max(0.1, Math.min(1, base + wave1 + wave2));
  });
}
