"use client";

import { useEffect, useState } from "react";
import { CloudOff, Loader2, RefreshCw, Wifi, WifiOff, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNetworkStatus, type ConnectionState } from "@/hooks/use-network-status";
import { useMessageQueue } from "@/hooks/use-message-queue";

// ============================================================================
// Types
// ============================================================================

export interface ConnectionStatusProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the pending message count */
  showPendingCount?: boolean;
  /** Whether to auto-hide when connected (after a delay) */
  autoHideWhenConnected?: boolean;
  /** Delay in ms before hiding when connected (default: 3000) */
  hideDelay?: number;
}

// ============================================================================
// Status Configuration
// ============================================================================

interface StatusConfig {
  label: string;
  description: string;
  icon: typeof Wifi;
  iconClassName: string;
  containerClassName: string;
  ariaLive: "polite" | "assertive";
}

const statusConfigs: Record<ConnectionState, StatusConfig> = {
  connected: {
    label: "Connected",
    description: "Your connection is stable",
    icon: Wifi,
    iconClassName: "text-emerald-500 dark:text-emerald-400",
    containerClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    ariaLive: "polite",
  },
  reconnecting: {
    label: "Reconnecting",
    description: "Attempting to restore connection...",
    icon: Loader2,
    iconClassName: "text-amber-500 dark:text-amber-400 animate-spin",
    containerClassName:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    ariaLive: "polite",
  },
  offline: {
    label: "Offline",
    description: "You're currently offline. Messages will be queued.",
    icon: WifiOff,
    iconClassName: "text-destructive",
    containerClassName:
      "border-destructive/30 bg-destructive/5 text-destructive dark:border-destructive/50 dark:bg-destructive/10",
    ariaLive: "assertive",
  },
};

// ============================================================================
// ConnectionStatusBanner Component
// ============================================================================

/**
 * A banner component that displays the current connection status.
 *
 * Features:
 * - Visual indicators for connected, reconnecting, and offline states
 * - Shows pending message count when offline
 * - Manual retry button for queued messages
 * - Accessible with proper ARIA attributes
 * - Auto-hides when connected (optional)
 *
 * @example
 * ```tsx
 * // In messages layout
 * <ConnectionStatusBanner showPendingCount autoHideWhenConnected />
 * ```
 */
export function ConnectionStatusBanner({
  className,
  showPendingCount = true,
  autoHideWhenConnected = true,
  hideDelay = 3000,
}: ConnectionStatusProps): React.ReactElement | null {
  const { connectionState } = useNetworkStatus();
  const { pendingCount, retryAll, isProcessing } = useMessageQueue();

  // State for auto-hide behavior
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // Track previous connection state to show "connected" briefly after reconnection
  const [showConnected, setShowConnected] = useState(false);

  // Handle auto-hide when connected
  useEffect(() => {
    if (connectionState === "connected") {
      // Show "connected" briefly after reconnection
      if (showConnected || !autoHideWhenConnected) {
        const hideTimer = setTimeout(() => {
          setIsVisible(false);
          setShowConnected(false);
        }, hideDelay);

        return () => clearTimeout(hideTimer);
      }
    } else {
      // Show banner when not connected
      setIsVisible(true);
      setIsDismissed(false);
      setShowConnected(true);
    }
    return undefined;
  }, [connectionState, autoHideWhenConnected, hideDelay, showConnected]);

  // Reset dismissed state when going offline
  useEffect(() => {
    if (connectionState !== "connected") {
      setIsDismissed(false);
    }
  }, [connectionState]);

  // Don't render if not visible or dismissed (when connected and no pending)
  if (!isVisible || (isDismissed && connectionState === "connected" && pendingCount === 0)) {
    return null;
  }

  // Don't show connected state if auto-hide is enabled and there are no pending messages
  if (
    connectionState === "connected" &&
    autoHideWhenConnected &&
    pendingCount === 0 &&
    !showConnected
  ) {
    return null;
  }

  const config = statusConfigs[connectionState];
  const Icon = config.icon;

  const handleDismiss = (): void => {
    setIsDismissed(true);
    setIsVisible(false);
  };

  const handleRetry = async (): Promise<void> => {
    await retryAll();
  };

  return (
    <div
      role="status"
      aria-live={config.ariaLive}
      aria-atomic="true"
      data-slot="connection-status"
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-all",
        config.containerClassName,
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn("size-4 shrink-0", config.iconClassName)}
          aria-hidden="true"
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{config.label}</span>
          {(connectionState !== "connected" || pendingCount > 0) && (
            <span className="text-xs opacity-80">
              {config.description}
              {showPendingCount && pendingCount > 0 && (
                <span className="ml-1">
                  ({pendingCount} message{pendingCount > 1 ? "s" : ""} queued)
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Retry button - only shown when connected with pending messages */}
        {connectionState === "connected" && pendingCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            disabled={isProcessing}
            className="h-7 gap-1.5 text-xs"
            aria-label={isProcessing ? "Sending queued messages..." : "Retry sending queued messages"}
          >
            <RefreshCw
              className={cn(
                "size-3",
                isProcessing && "animate-spin"
              )}
              aria-hidden="true"
            />
            {isProcessing ? "Sending..." : "Retry"}
          </Button>
        )}

        {/* Dismiss button - only when connected */}
        {connectionState === "connected" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="size-6 shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="size-3" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ConnectionStatusIndicator Component (Compact)
// ============================================================================

export interface ConnectionStatusIndicatorProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the label text */
  showLabel?: boolean;
}

/**
 * A compact connection status indicator.
 *
 * Use this for inline status display (e.g., in a header or toolbar).
 *
 * @example
 * ```tsx
 * <ConnectionStatusIndicator showLabel />
 * ```
 */
export function ConnectionStatusIndicator({
  className,
  showLabel = false,
}: ConnectionStatusIndicatorProps): React.ReactElement | null {
  const { connectionState } = useNetworkStatus();
  const { pendingCount } = useMessageQueue();

  // Don't render when connected with no pending messages
  if (connectionState === "connected" && pendingCount === 0) {
    return null;
  }

  const config = statusConfigs[connectionState];
  const Icon = connectionState === "offline" ? CloudOff : config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${config.label}${pendingCount > 0 ? `. ${pendingCount} messages queued.` : ""}`}
      data-slot="connection-indicator"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        connectionState === "offline" && "text-destructive",
        connectionState === "reconnecting" && "text-amber-600 dark:text-amber-400",
        className
      )}
    >
      <Icon
        className={cn(
          "size-3.5",
          connectionState === "reconnecting" && "animate-spin"
        )}
        aria-hidden="true"
      />
      {showLabel && (
        <span>
          {config.label}
          {pendingCount > 0 && ` (${pendingCount})`}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

export { ConnectionStatusBanner as ConnectionStatus };
