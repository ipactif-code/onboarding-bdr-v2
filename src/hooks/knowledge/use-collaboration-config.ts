"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAction } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { Id } from "../../../convex/_generated/dataModel";

// Load API with require to avoid TS2589 deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;

// ============================================================================
// Constants
// ============================================================================

/**
 * Default cursor color for collaboration presence.
 * Used when user's personalized color is not yet available.
 */
const DEFAULT_CURSOR_COLOR = "#FF5733";

/**
 * Reasons that indicate graceful fallback rather than error.
 * These are expected conditions where we should use standalone mode silently.
 */
const GRACEFUL_FALLBACK_REASONS = ["Collaboration server not configured."];

// ============================================================================
// Types
// ============================================================================

export type CollaborationConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface CollaborationConfigData {
  url: string;
  roomName: string;
  token: string;
  cursorColor: string;
  activeEditors: number;
}

export interface CollaborationState {
  status: CollaborationConnectionStatus;
  config: CollaborationConfigData | null;
  canJoin: boolean;
  error: string | null;
  activeEditors: number;
}

export interface UseCollaborationConfigOptions {
  documentId: Id<"kbDocuments">;
}

export interface UseCollaborationConfigReturn {
  state: CollaborationState;
  retry: () => void;
  /** True if collaboration is simply not configured (graceful fallback), false if there's an actual error */
  isNotConfigured: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for fetching and managing collaboration configuration.
 *
 * Handles:
 * - Fetching Hocuspocus token and connection details from Convex
 * - Graceful fallback to standalone mode when collaboration is not configured
 * - Error handling for actual errors (room full, access denied, etc.)
 * - Retry mechanism for failed connections
 *
 * @example
 * ```tsx
 * const { state, retry, isNotConfigured } = useCollaborationConfig({
 *   documentId,
 * });
 *
 * if (!state.canJoin && state.error && !isNotConfigured) {
 *   return <ErrorState error={state.error} onRetry={retry} />;
 * }
 *
 * if (state.config) {
 *   // Initialize collaborative editor with config
 * }
 * ```
 */
export function useCollaborationConfig({
  documentId,
}: UseCollaborationConfigOptions): UseCollaborationConfigReturn {
  const { getToken } = useAuth();
  const getHocuspocusToken = useAction(
    api.actions.hocuspocus.getHocuspocusToken
  );

  // Store the latest getHocuspocusToken in a ref to avoid infinite loops.
  // useAction returns a new function reference on every render, which would
  // cause useCallback to recreate initCollaboration, triggering useEffect,
  // which calls setState, causing a re-render -> infinite loop.
  const getHocuspocusTokenRef = useRef(getHocuspocusToken);
  getHocuspocusTokenRef.current = getHocuspocusToken;

  const [state, setState] = useState<CollaborationState>({
    status: "connecting",
    config: null,
    canJoin: true,
    error: null,
    activeEditors: 0,
  });

  // Track if collaboration is simply not configured (vs actual error)
  const [isNotConfigured, setIsNotConfigured] = useState(false);

  const initAttemptRef = useRef(0);

  const initCollaboration = useCallback(async () => {
    try {
      setState((prev) => ({
        ...prev,
        status: "connecting",
        error: null,
      }));
      setIsNotConfigured(false);

      // Debug: Development logging for collaboration initialization
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log("[Collaboration] Initializing for document:", documentId);
      }

      // 1. Get token and connection details from Convex
      // Use ref to access the latest getHocuspocusToken without adding it to dependencies
      const tokenResult = await getHocuspocusTokenRef.current({ documentId });

      // Debug: Development logging for token result
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log("[Collaboration] Token result:", {
          canJoin: tokenResult.canJoin,
          hasUrl: !!tokenResult.url,
          reason: tokenResult.reason,
        });
      }

      if (!tokenResult.canJoin) {
        // Check if this is a graceful fallback condition (not configured)
        const isGracefulFallback = GRACEFUL_FALLBACK_REASONS.includes(
          tokenResult.reason || ""
        );

        if (isGracefulFallback) {
          // Debug: Development logging for graceful fallback
          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.log(
              "[Collaboration] Server not configured - using standalone mode"
            );
          }
          setIsNotConfigured(true);
          setState({
            status: "disconnected",
            config: null,
            canJoin: false,
            error: null, // No error - this is expected
            activeEditors: 0,
          });
          return;
        }

        // Actual error (e.g., max editors reached, no access)
        if (process.env.NODE_ENV === "development") {
          console.warn("[Collaboration] Cannot join:", tokenResult.reason);
        }
        setState({
          status: "error",
          config: null,
          canJoin: false,
          error: tokenResult.reason || "Cannot join collaboration",
          activeEditors: tokenResult.activeEditors || 0,
        });
        return;
      }

      // 2. Get Clerk JWT token for Hocuspocus authentication
      const clerkToken = await getToken();
      if (!clerkToken) {
        setState({
          status: "error",
          config: null,
          canJoin: false,
          error: "Authentication required. Please sign in.",
          activeEditors: 0,
        });
        return;
      }

      // 3. Set configuration (YjsPlugin will handle connection)
      // Debug: Development logging for configuration ready
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log(
          "[Collaboration] Configuration ready, connecting to:",
          tokenResult.url
        );
      }
      setState({
        status: "connecting",
        config: {
          url: tokenResult.url!,
          roomName: tokenResult.roomName!,
          token: clerkToken,
          cursorColor: DEFAULT_CURSOR_COLOR,
          activeEditors: tokenResult.activeEditors || 0,
        },
        canJoin: true,
        error: null,
        activeEditors: tokenResult.activeEditors || 0,
      });
    } catch (error) {
      console.error("[Collaboration] Init error:", error);
      // Treat unexpected errors as graceful fallback to standalone mode
      setIsNotConfigured(true);
      setState({
        status: "disconnected",
        config: null,
        canJoin: false,
        error: null, // Don't show error UI - just fall back to standalone
        activeEditors: 0,
      });
    }
    // Note: getHocuspocusToken is intentionally excluded from dependencies.
    // It's accessed via getHocuspocusTokenRef to avoid infinite render loops
    // caused by useAction returning a new function reference on each render.
  }, [documentId, getToken]);

  // Initialize on mount
  useEffect(() => {
    initCollaboration();
  }, [initCollaboration]);

  const retry = useCallback(() => {
    initAttemptRef.current += 1;

    // Reset state and retry
    setState({
      status: "connecting",
      config: null,
      canJoin: true,
      error: null,
      activeEditors: 0,
    });
    setIsNotConfigured(false);

    initCollaboration();
  }, [initCollaboration]);

  return { state, retry, isNotConfigured };
}
