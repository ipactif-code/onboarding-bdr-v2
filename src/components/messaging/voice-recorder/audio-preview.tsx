"use client";

import { useCallback, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WaveformVisualizer } from "./waveform-visualizer";
import { formatDuration, type AudioPreviewProps } from "./types";

/**
 * Audio preview player for recorded messages.
 *
 * Features:
 * - Play/pause toggle with visual feedback
 * - Waveform visualization
 * - Duration display showing current time during playback
 * - Keyboard navigation support (Enter/Space to toggle)
 */
export function AudioPreview({
  audioUrl,
  duration,
  waveformData,
}: AudioPreviewProps): React.ReactElement {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play();
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handlePlayPause();
      }
    },
    [handlePlayPause]
  );

  return (
    <div
      className="flex flex-col gap-2"
      role="region"
      aria-label="Voice message preview"
    >
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={handlePlayPause}
          onKeyDown={handleKeyDown}
          aria-label={isPlaying ? "Pause preview" : "Play preview"}
          className="min-h-11 min-w-11 shrink-0"
        >
          {isPlaying ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
        </Button>

        <div className="flex-1">
          <WaveformVisualizer data={waveformData} />
        </div>

        <time
          dateTime={`PT${Math.floor(isPlaying ? currentTime : duration)}S`}
          className="shrink-0 text-xs tabular-nums text-muted-foreground"
        >
          {formatDuration(isPlaying ? currentTime : duration)}
        </time>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
        aria-label={`Voice message preview, ${formatDuration(duration)} seconds`}
      />
    </div>
  );
}
