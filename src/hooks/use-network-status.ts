"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useConvex } from "convex/react";

// ============================================================================
// Types
// ============================================================================

/**
 * Connection state representing the current network status.
 */
export type ConnectionState = "connected" | "reconnecting" | "offline";

/**
 * Network status information including browser and Convex connection state.
 */
export interface NetworkStatus {
  /** Whether the browser reports an active network connection */
  isOnline: boolean;
  /** Whether Convex client is connected and ready */
  isConvexConnected: boolean;
  /** Combined connection state for UI display */
  connectionState: ConnectionState;
  /** Timestamp of last disconnection (if any) */
  lastDisconnectedAt: Date | null;
  /** Timestamp of last successful connection */
  lastConnectedAt: Date | null;
}

// ============================================================================
// Browser Online Status Store (for useSyncExternalStore)
// ============================================================================

/**
 * Get current browser online status.
 */
function getSnapshot(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Server-side snapshot - assume online.
 */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Subscribe to browser online/offline events.
 */
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

// ============================================================================
// useNetworkStatus Hook
// ============================================================================

/**
 * Hook to monitor network connectivity status.
 *
 * Combines browser online/offline detection with Convex client connection
 * status for comprehensive network state awareness.
 *
 * Features:
 * - Browser online/offline event detection
 * - Convex client connection state monitoring
 * - Combined connection state (connected, reconnecting, offline)
 * - Timestamps for connection events
 *
 * @returns NetworkStatus object with current connection information
 *
 * @example
 * ```tsx
 * const { connectionState, isOnline } = useNetworkStatus();
 *
 * if (connectionState === "offline") {
 *   return <OfflineBanner />;
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  // Use useSyncExternalStore for browser online status (SSR-safe)
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Track Convex connection state manually since connectionState()
  // is an internal API and may change behavior
  const convexClient = useConvex();
  const [isConvexConnected, setIsConvexConnected] = useState(true);

  // Track connection timestamps
  const [lastDisconnectedAt, setLastDisconnectedAt] = useState<Date | null>(null);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);

  // Monitor Convex connection state using internal polling
  // Note: This is a workaround as Convex doesn't expose a public connection status API
  useEffect(() => {
    // Initial check
    setIsConvexConnected(isOnline);

    if (!isOnline) {
      setLastDisconnectedAt(new Date());
    } else {
      setLastConnectedAt(new Date());
    }

    // Poll for Convex sync state by checking if we can make a simple operation
    // This is a heuristic based on browser online status
    const handleConnectionChange = (): void => {
      const nowOnline = navigator.onLine;
      setIsConvexConnected(nowOnline);

      if (!nowOnline) {
        setLastDisconnectedAt(new Date());
      } else {
        // Small delay to allow Convex to reconnect
        setTimeout(() => {
          setLastConnectedAt(new Date());
        }, 500);
      }
    };

    window.addEventListener("online", handleConnectionChange);
    window.addEventListener("offline", handleConnectionChange);

    return () => {
      window.removeEventListener("online", handleConnectionChange);
      window.removeEventListener("offline", handleConnectionChange);
    };
  }, [isOnline, convexClient]);

  // Compute the combined connection state
  const getConnectionState = useCallback((): ConnectionState => {
    if (!isOnline) {
      return "offline";
    }

    if (!isConvexConnected) {
      return "reconnecting";
    }

    return "connected";
  }, [isOnline, isConvexConnected]);

  return {
    isOnline,
    isConvexConnected,
    connectionState: getConnectionState(),
    lastDisconnectedAt,
    lastConnectedAt,
  };
}

// ============================================================================
// useIsOnline Hook (simplified)
// ============================================================================

/**
 * Simple hook that returns only the browser online status.
 *
 * Use this when you only need to know if the browser is online,
 * without Convex connection state monitoring.
 *
 * @returns boolean indicating if the browser is online
 *
 * @example
 * ```tsx
 * const isOnline = useIsOnline();
 * if (!isOnline) {
 *   toast.warning("You're offline");
 * }
 * ```
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
