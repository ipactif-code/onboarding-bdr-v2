'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { Id } from '../../convex/_generated/dataModel';

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require('../../convex/_generated/api').api;

/**
 * Configuration options for session tracking.
 */
interface SessionTrackingOptions {
  /**
   * Interval in milliseconds between heartbeat calls.
   * Default: 30 seconds
   */
  heartbeatInterval?: number;

  /**
   * Whether to automatically start a session when the hook mounts.
   * Default: true
   */
  autoStart?: boolean;

  /**
   * Whether to end the session when the browser tab becomes hidden.
   * Default: false
   */
  endOnHide?: boolean;
}

/**
 * T160: Implement session tracking hook
 *
 * This hook manages user session tracking for analytics:
 * - Starts a session when the user loads the app
 * - Sends periodic heartbeats to keep the session alive
 * - Ends the session when the user leaves
 *
 * @param options - Configuration options
 * @returns Session control functions
 */
interface UseSessionTrackingReturn {
  sessionId: Id<'sessions'> | null;
  startSession: () => Promise<Id<'sessions'> | null>;
  endSession: () => Promise<void>;
  sendHeartbeat: () => Promise<void>;
  isActive: boolean;
}

export function useSessionTracking(options: SessionTrackingOptions = {}): UseSessionTrackingReturn {
  const {
    heartbeatInterval = 30000, // 30 seconds
    autoStart = true,
    endOnHide = false,
  } = options;

  const sessionIdRef = useRef<Id<'sessions'> | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStartingRef = useRef(false);

  const startSessionMutation = useMutation(api.analytics.startSession);
  const endSessionMutation = useMutation(api.analytics.endSession);
  const heartbeatMutation = useMutation(api.analytics.heartbeat);

  /**
   * Start a new session.
   */
  const startSession = useCallback(async () => {
    // Prevent concurrent start attempts
    if (isStartingRef.current || sessionIdRef.current) {
      return sessionIdRef.current;
    }

    isStartingRef.current = true;

    try {
      const sessionId = await startSessionMutation();
      sessionIdRef.current = sessionId;

      // Start heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      heartbeatIntervalRef.current = setInterval(async () => {
        if (sessionIdRef.current) {
          try {
            await heartbeatMutation({ sessionId: sessionIdRef.current });
          } catch (error) {
            // Heartbeat failed - session may have expired
            console.warn('Session heartbeat failed:', error);
          }
        }
      }, heartbeatInterval);

      return sessionId;
    } catch (error) {
      console.error('Failed to start session:', error);
      return null;
    } finally {
      isStartingRef.current = false;
    }
  }, [startSessionMutation, heartbeatMutation, heartbeatInterval]);

  /**
   * End the current session.
   */
  const endSession = useCallback(async () => {
    // Clear heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (!sessionIdRef.current) {
      return;
    }

    try {
      await endSessionMutation({ sessionId: sessionIdRef.current });
    } catch (error) {
      console.error('Failed to end session:', error);
    } finally {
      sessionIdRef.current = null;
    }
  }, [endSessionMutation]);

  /**
   * Send a heartbeat to keep the session alive.
   */
  const sendHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current) {
      return;
    }

    try {
      await heartbeatMutation({ sessionId: sessionIdRef.current });
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }, [heartbeatMutation]);

  // Auto-start session on mount
  useEffect(() => {
    if (autoStart) {
      startSession();
    }

    // Cleanup on unmount
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [autoStart, startSession]);

  // Handle page visibility changes
  useEffect(() => {
    if (!endOnHide) {
      return;
    }

    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        // Page is hidden - optionally end session
        endSession();
      } else {
        // Page is visible again - start new session
        startSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [endOnHide, startSession, endSession]);

  // Handle beforeunload to end session when user leaves
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      // Use sendBeacon for reliable delivery on page unload
      if (sessionIdRef.current) {
        // Note: We can't use Convex mutation here since it's async
        // The session will be cleaned up by inactivity detection
        // or the next login will end old sessions
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return {
    sessionId: sessionIdRef.current,
    startSession,
    endSession,
    sendHeartbeat,
    isActive: !!sessionIdRef.current,
  };
}

/**
 * Hook to track user activity and update status.
 * This is a lighter-weight alternative that just tracks activity
 * without full session management.
 */
interface UseActivityTrackingReturn {
  trackActivity: () => void;
  setSessionId: (id: Id<'sessions'> | null) => void;
  getLastActivityTime: () => number;
}

export function useActivityTracking(): UseActivityTrackingReturn {
  const heartbeatMutation = useMutation(api.analytics.heartbeat);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionIdRef = useRef<Id<'sessions'> | null>(null);

  // Track user activity
  const trackActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Set session ID for heartbeats
  const setSessionId = useCallback((id: Id<'sessions'> | null) => {
    sessionIdRef.current = id;
  }, []);

  // Listen for user activity events
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = (): void => {
      trackActivity();
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [trackActivity]);

  // Send heartbeat on activity (throttled)
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;

      // Only send heartbeat if there was recent activity (within 1 minute)
      if (timeSinceActivity < 60000 && sessionIdRef.current) {
        try {
          await heartbeatMutation({ sessionId: sessionIdRef.current });
        } catch {
          // Ignore heartbeat errors
        }
      }
    }, 30000); // Check every 30 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [heartbeatMutation]);

  return {
    trackActivity,
    setSessionId,
    getLastActivityTime: () => lastActivityRef.current,
  };
}
