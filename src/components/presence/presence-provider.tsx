"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useReducer,
  type ReactNode,
} from "react";
import { useMutation } from "convex/react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;

/**
 * Interval in milliseconds between presence heartbeat updates.
 * Default: 30 seconds (matching the backend expectation)
 */
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

/**
 * Context value for presence state
 */
interface PresenceContextValue {
  /**
   * Whether the heartbeat is currently active (user is being tracked as online)
   */
  isOnline: boolean;

  /**
   * Timestamp of the last successful heartbeat, or null if none yet
   */
  lastHeartbeat: number | null;
}

const PresenceContext = createContext<PresenceContextValue>({
  isOnline: false,
  lastHeartbeat: null,
});

interface PresenceProviderProps {
  children: ReactNode;
}

/**
 * PresenceProvider - Manages user presence heartbeat for real-time status tracking.
 *
 * Features:
 * - Sends heartbeat every 30 seconds using updatePresence mutation
 * - Pauses heartbeat when page is hidden (document.hidden)
 * - Resumes heartbeat when page becomes visible
 * - Calls goOffline mutation on beforeunload event
 * - Provides PresenceContext for children to access status
 *
 * Should be placed inside ConvexProviderWithClerk to have access to Convex mutations.
 */
export function PresenceProvider({ children }: PresenceProviderProps): React.ReactNode {
  // Convex mutations for presence
  const updatePresenceMutation = useMutation(api.presence.updatePresence);
  const goOfflineMutation = useMutation(api.presence.goOffline);

  // State refs for tracking
  const isOnlineRef = useRef<boolean>(false);
  const lastHeartbeatRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Force re-render when state changes
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  /**
   * Send a heartbeat to the server to indicate the user is active.
   */
  const sendHeartbeat = useCallback(async (): Promise<void> => {
    try {
      await updatePresenceMutation();
      lastHeartbeatRef.current = Date.now();
      if (!isOnlineRef.current) {
        isOnlineRef.current = true;
        forceUpdate();
      }
    } catch (error) {
      // Silently fail - network errors shouldn't crash the app
      // The server will mark the user as away/offline after timeout
      console.warn("Presence heartbeat failed:", error);
    }
  }, [updatePresenceMutation]);

  /**
   * Start the heartbeat interval.
   */
  const startHeartbeat = useCallback((): void => {
    // Clear any existing interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Send immediate heartbeat
    void sendHeartbeat();

    // Start interval
    heartbeatIntervalRef.current = setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    isOnlineRef.current = true;
    forceUpdate();
  }, [sendHeartbeat]);

  /**
   * Stop the heartbeat interval.
   */
  const stopHeartbeat = useCallback((): void => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    isOnlineRef.current = false;
    forceUpdate();
  }, []);

  /**
   * Handle page visibility change.
   * Pause heartbeat when hidden, resume when visible.
   */
  const handleVisibilityChange = useCallback((): void => {
    if (document.hidden) {
      // Page is hidden - stop heartbeat to save resources
      stopHeartbeat();
    } else {
      // Page is visible again - resume heartbeat
      startHeartbeat();
    }
  }, [startHeartbeat, stopHeartbeat]);

  /**
   * Handle beforeunload - attempt to mark user as offline.
   * Note: This is best-effort as beforeunload is not guaranteed to complete.
   */
  const handleBeforeUnload = useCallback((): void => {
    // Fire and forget - we can't await in beforeunload
    void goOfflineMutation();
  }, [goOfflineMutation]);

  // Set up heartbeat on mount
  useEffect(() => {
    // Start heartbeat immediately
    startHeartbeat();

    // Clean up on unmount
    return () => {
      stopHeartbeat();
      // Try to mark as offline on unmount
      void goOfflineMutation();
    };
  }, [startHeartbeat, stopHeartbeat, goOfflineMutation]);

  // Set up visibility change listener
  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  // Set up beforeunload listener
  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [handleBeforeUnload]);

  const contextValue: PresenceContextValue = {
    isOnline: isOnlineRef.current,
    lastHeartbeat: lastHeartbeatRef.current,
  };

  return (
    <PresenceContext.Provider value={contextValue}>
      {children}
    </PresenceContext.Provider>
  );
}

/**
 * Hook to access the presence context.
 *
 * @returns PresenceContextValue with isOnline and lastHeartbeat
 * @throws Error if used outside of PresenceProvider
 */
export function usePresenceContext(): PresenceContextValue {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error("usePresenceContext must be used within a PresenceProvider");
  }
  return context;
}
