"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useAction } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Id } from "../../../convex/_generated/dataModel";

// Load API with require to avoid TS2589 deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"
  | "room_full";

export interface CollaborationConfig {
  url: string;
  roomName: string;
  token: string;
  cursorColor: string;
  userName: string;
  userId: string;
}

export interface UseCollaborationOptions {
  documentId: Id<"kbDocuments">;
  /** Polling interval for checking room availability when full (ms). Default: 10000 */
  roomFullPollInterval?: number;
  /** Auto-retry connection on disconnect. Default: true */
  autoReconnect?: boolean;
}

export interface UseCollaborationReturn {
  /** Current connection status */
  status: ConnectionStatus;
  /** Configuration for Hocuspocus provider (null if not ready) */
  config: CollaborationConfig | null;
  /** Error message if connection failed */
  error: string | null;
  /** Whether the room is full (25 editors) */
  isRoomFull: boolean;
  /** Number of active editors */
  activeEditors: number;
  /** Maximum allowed editors */
  maxEditors: number;
  /** Retry connection */
  retry: () => void;
  /** Leave the collaboration session */
  leave: () => Promise<void>;
  /** Join mutation for session tracking */
  joinSession: (connectionId: string) => Promise<void>;
  /** Leave mutation for session tracking */
  leaveSession: (connectionId: string) => Promise<void>;
  /** Update cursor position */
  updateCursor: (cursorPosition?: unknown, selectionRange?: unknown) => void;
  /** Set typing indicator */
  setTyping: (isTyping: boolean) => void;
  /** Send heartbeat to keep session alive */
  heartbeat: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_EDITORS = 25;
const DEFAULT_POLL_INTERVAL = 10000; // 10 seconds

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing real-time collaboration in the Knowledge Base editor.
 *
 * Handles:
 * - Fetching Hocuspocus connection token
 * - 25-editor limit enforcement with polling when room is full
 * - Session join/leave tracking
 * - Cursor position and typing indicator updates
 * - Auto-reconnection on disconnect
 *
 * @example
 * ```tsx
 * const {
 *   status,
 *   config,
 *   isRoomFull,
 *   retry,
 *   joinSession,
 *   leaveSession,
 * } = useCollaboration({ documentId });
 *
 * if (status === "room_full") {
 *   return <RoomFullBanner activeEditors={activeEditors} maxEditors={25} onRetry={retry} />;
 * }
 *
 * if (config) {
 *   // Initialize Hocuspocus provider with config
 * }
 * ```
 */
export function useCollaboration({
  documentId,
  roomFullPollInterval = DEFAULT_POLL_INTERVAL,
  autoReconnect = true,
}: UseCollaborationOptions): UseCollaborationReturn {
  const { getToken } = useAuth();
  const { user } = useUser();

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [config, setConfig] = useState<CollaborationConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRoomFull, setIsRoomFull] = useState(false);
  const [activeEditors, setActiveEditors] = useState(0);

  const connectionIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Convex mutations and actions
  const getHocuspocusToken = useAction(api.actions.hocuspocus.getHocuspocusToken);
  const joinSessionMutation = useMutation(api.knowledge.collaboration.joinSession);
  const leaveSessionMutation = useMutation(api.knowledge.collaboration.leaveSession);
  const updateCursorMutation = useMutation(api.knowledge.collaboration.updateCursor);
  const setTypingMutation = useMutation(api.knowledge.collaboration.setTyping);
  const heartbeatMutation = useMutation(api.knowledge.collaboration.heartbeat);

  // ---------------------------------------------------------------------------
  // Initialize Collaboration
  // ---------------------------------------------------------------------------

  const initCollaboration = useCallback(async () => {
    if (!mountedRef.current) return;

    setStatus("connecting");
    setError(null);

    try {
      // Get Hocuspocus connection details from Convex action
      const tokenResult = await getHocuspocusToken({ documentId });

      if (!mountedRef.current) return;

      if (!tokenResult.canJoin) {
        // Check if room is full (25-editor limit)
        if (tokenResult.reason?.includes("maximum")) {
          setStatus("room_full");
          setIsRoomFull(true);
          setActiveEditors(tokenResult.activeEditors ?? MAX_EDITORS);
          setError(tokenResult.reason ?? "Room is full");

          // Start polling for availability if enabled
          if (roomFullPollInterval > 0) {
            pollIntervalRef.current = setInterval(() => {
              initCollaboration();
            }, roomFullPollInterval);
          }
        } else {
          setStatus("error");
          setError(tokenResult.reason ?? "Cannot join collaboration");
        }
        return;
      }

      // Clear any existing polling interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      // Get Clerk JWT token for Hocuspocus authentication
      const clerkToken = await getToken();

      if (!clerkToken || !mountedRef.current) {
        setStatus("error");
        setError("Authentication required");
        return;
      }

      // Generate cursor color from the action result or use default
      const cursorColor = "#FF5733"; // Default color, actual assigned in joinSession

      // Set configuration for Hocuspocus provider
      setConfig({
        url: tokenResult.url!,
        roomName: tokenResult.roomName!,
        token: clerkToken,
        cursorColor,
        userName: user?.fullName ?? user?.firstName ?? "Anonymous",
        userId: user?.id ?? "",
      });

      setStatus("connected");
      setIsRoomFull(false);
      setActiveEditors(tokenResult.activeEditors ?? 0);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("[useCollaboration] Init error:", err);
      setStatus("error");
      setError("Failed to connect to collaboration server");
    }
  }, [documentId, getHocuspocusToken, getToken, user, roomFullPollInterval]);

  // ---------------------------------------------------------------------------
  // Retry Connection
  // ---------------------------------------------------------------------------

  const retry = useCallback(() => {
    // Clear existing polling before retrying
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    initCollaboration();
  }, [initCollaboration]);

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  /**
   * Join session - call after Hocuspocus provider connects
   */
  const joinSession = useCallback(
    async (connectionId: string) => {
      connectionIdRef.current = connectionId;
      try {
        const result = await joinSessionMutation({ documentId, connectionId });
        if (result.cursorColor && config) {
          // Update config with assigned cursor color
          setConfig((prev) =>
            prev ? { ...prev, cursorColor: result.cursorColor! } : prev
          );
        }
      } catch (err) {
        console.error("[useCollaboration] Join session error:", err);
      }
    },
    [documentId, joinSessionMutation, config]
  );

  /**
   * Leave session - call when provider disconnects or component unmounts
   */
  const leaveSession = useCallback(
    async (connectionId: string) => {
      try {
        await leaveSessionMutation({ documentId, connectionId });
      } catch (err) {
        console.error("[useCollaboration] Leave session error:", err);
      }
    },
    [documentId, leaveSessionMutation]
  );

  /**
   * Leave the current session and reset state
   */
  const leave = useCallback(async () => {
    if (connectionIdRef.current) {
      await leaveSession(connectionIdRef.current);
      connectionIdRef.current = null;
    }
    setConfig(null);
    setStatus("disconnected");
  }, [leaveSession]);

  // ---------------------------------------------------------------------------
  // Cursor and Presence Updates
  // ---------------------------------------------------------------------------

  /**
   * Update cursor position (debounced in the calling component)
   */
  const updateCursor = useCallback(
    (cursorPosition?: unknown, selectionRange?: unknown) => {
      updateCursorMutation({ documentId, cursorPosition, selectionRange }).catch(
        (err) => console.error("[useCollaboration] Update cursor error:", err)
      );
    },
    [documentId, updateCursorMutation]
  );

  /**
   * Set typing indicator
   */
  const setTyping = useCallback(
    (isTyping: boolean) => {
      setTypingMutation({ documentId, isTyping }).catch((err) =>
        console.error("[useCollaboration] Set typing error:", err)
      );
    },
    [documentId, setTypingMutation]
  );

  /**
   * Send heartbeat to keep session alive
   */
  const heartbeat = useCallback(() => {
    heartbeatMutation({ documentId }).catch((err) =>
      console.error("[useCollaboration] Heartbeat error:", err)
    );
  }, [documentId, heartbeatMutation]);

  // ---------------------------------------------------------------------------
  // Lifecycle Effects
  // ---------------------------------------------------------------------------

  // Initialize on mount
  useEffect(() => {
    mountedRef.current = true;
    initCollaboration();

    return () => {
      mountedRef.current = false;

      // Cleanup polling interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      // Leave session on unmount
      if (connectionIdRef.current) {
        leaveSession(connectionIdRef.current).catch((err) =>
          console.error("[useCollaboration] Cleanup leave error:", err)
        );
      }
    };
  }, [initCollaboration, leaveSession]);

  // Handle auto-reconnect when disconnected
  useEffect(() => {
    if (autoReconnect && status === "disconnected" && !isRoomFull) {
      const timeout = setTimeout(() => {
        retry();
      }, 2000); // Wait 2 seconds before auto-reconnect

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [autoReconnect, status, isRoomFull, retry]);

  // ---------------------------------------------------------------------------
  // Return Hook API
  // ---------------------------------------------------------------------------

  return {
    status,
    config,
    error,
    isRoomFull,
    activeEditors,
    maxEditors: MAX_EDITORS,
    retry,
    leave,
    joinSession,
    leaveSession,
    updateCursor,
    setTyping,
    heartbeat,
  };
}
