"use client";

import * as React from "react";
import { AlertCircle, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";

// ============================================================================
// Types
// ============================================================================

interface RoomFullBannerProps {
  /** Number of active editors currently in the document */
  activeEditors: number;
  /** Maximum number of concurrent editors allowed */
  maxEditors: number;
  /** Callback to retry joining the room */
  onRetry: () => void;
  /** Whether auto-polling is enabled for availability check */
  isPolling?: boolean;
  /** Polling interval in seconds (for countdown display) */
  pollIntervalSeconds?: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Banner shown when document has reached 25-editor limit.
 * Shows current count, max limit, and retry option with polling status.
 *
 * @example
 * ```tsx
 * <RoomFullBanner
 *   activeEditors={25}
 *   maxEditors={25}
 *   onRetry={retry}
 *   isPolling={true}
 * />
 * ```
 */
export function RoomFullBanner({
  activeEditors,
  maxEditors,
  onRetry,
  isPolling = true,
  pollIntervalSeconds = 10,
}: RoomFullBannerProps): React.ReactElement {
  const [retryCountdown, setRetryCountdown] = React.useState(pollIntervalSeconds);

  // Reset countdown when pollIntervalSeconds changes
  React.useEffect(() => {
    setRetryCountdown(pollIntervalSeconds);
  }, [pollIntervalSeconds]);

  // Countdown timer for auto-retry
  React.useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          // Trigger retry and reset countdown
          onRetry();
          return pollIntervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPolling, onRetry, pollIntervalSeconds]);

  const occupancyPercent = Math.min(100, (activeEditors / maxEditors) * 100);

  return (
    <Alert variant="destructive" className="mx-4 mt-4">
      <AlertCircle className="size-4" />
      <AlertTitle>Document at Maximum Capacity</AlertTitle>
      <AlertDescription className="space-y-4">
        <p>
          This document has reached the maximum of {maxEditors} concurrent editors.
          You will be able to join when someone leaves.
        </p>

        {/* Occupancy indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              Active editors: {activeEditors}/{maxEditors}
            </span>
            <span className="font-medium">{occupancyPercent.toFixed(0)}% full</span>
          </div>
          <Progress value={occupancyPercent}>
            <ProgressTrack className="h-2">
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        </div>

        {/* Retry section */}
        <div className="flex items-center justify-between pt-2">
          {isPolling ? (
            <p className="text-sm text-muted-foreground">
              Automatically checking for availability in {retryCountdown}s...
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click the button to check availability.
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onRetry();
              setRetryCountdown(pollIntervalSeconds);
            }}
            className="gap-2 shrink-0"
          >
            <RefreshCw className="size-3" />
            Check Now
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
