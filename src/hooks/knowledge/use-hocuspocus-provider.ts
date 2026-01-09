"use client";

import { useRef, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { usePlateEditor } from "platejs/react";
import { YjsPlugin } from "@platejs/yjs/react";
import { Id } from "../../../convex/_generated/dataModel";
import { EditorKit } from "@/components/editor/editor-kit";
import type { CollaborationConfigData } from "./use-collaboration-config";

// Load API with require to avoid TS2589 deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;

// ============================================================================
// Constants
// ============================================================================

/**
 * Interval for checking/refreshing authentication tokens.
 * Set to 50 seconds to refresh 10 seconds before the typical 60-second token expiry.
 */
export const TOKEN_REFRESH_INTERVAL_MS = 50 * 1000;

/**
 * Timeout for initial WebSocket connection to Hocuspocus server.
 * If connection is not established within this time, report error state.
 */
export const CONNECTION_TIMEOUT_MS = 15 * 1000;

/**
 * Length of random suffix for connection IDs.
 * Uses base36 substring for compact unique identifiers.
 */
const CONNECTION_ID_RANDOM_LENGTH = 7;

// ============================================================================
// Types
// ============================================================================

export type HocuspocusConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface UseHocuspocusProviderOptions {
  documentId: Id<"kbDocuments">;
  config: CollaborationConfigData;
  cursorName: string;
  /** Function to get fresh auth token (from Clerk) */
  getToken: () => Promise<string | null>;
  /** Callback when connection status changes */
  onConnectionChange?: (status: HocuspocusConnectionStatus) => void;
}

export interface UseHocuspocusProviderReturn {
  /** The Plate editor instance with Yjs plugin configured */
  editor: ReturnType<typeof usePlateEditor>;
  /** Whether the editor is connected to Hocuspocus server */
  isConnected: boolean;
  /** Whether the editor content is ready (synced and has children) */
  isEditorReady: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing Hocuspocus/Yjs real-time collaboration provider.
 *
 * Handles:
 * - Creating Plate editor with YjsPlugin configured
 * - Hocuspocus connection lifecycle (connect, disconnect, error)
 * - Token refresh for long-running sessions
 * - Session tracking via Convex (join/leave)
 * - Empty document initialization after Yjs sync
 *
 * @example
 * ```tsx
 * const { editor, isConnected, isEditorReady } = useHocuspocusProvider({
 *   documentId,
 *   config: collabConfig,
 *   cursorName: userName,
 *   getToken,
 *   onConnectionChange: setConnectionStatus,
 * });
 *
 * if (!isEditorReady) {
 *   return <EditorSkeleton />;
 * }
 *
 * return <Plate editor={editor}>...</Plate>;
 * ```
 */
export function useHocuspocusProvider({
  documentId,
  config,
  cursorName,
  getToken,
  onConnectionChange,
}: UseHocuspocusProviderOptions): UseHocuspocusProviderReturn {
  const joinSession = useMutation(api.knowledge.collaboration.joinSession);
  const leaveSession = useMutation(api.knowledge.collaboration.leaveSession);

  // Generate unique connection ID for this session
  const connectionIdRef = useRef<string>(
    `${config.roomName}-${Date.now()}-${Math.random().toString(36).substring(2, 2 + CONNECTION_ID_RANDOM_LENGTH)}`
  );

  const [isConnected, setIsConnected] = useState(false);
  const hasJoinedRef = useRef(false);
  const initCalledRef = useRef(false);

  // Track when editor is ready (has children) to force re-render.
  // PlateContent returns null when editor.children is empty, so we need
  // to trigger a React re-render when children are added after Yjs sync.
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Store callbacks in refs to avoid useEffect dependency changes causing re-initialization.
  // This prevents the infinite WebSocket loop where:
  // 1. onConnect calls onConnectionChange("connected")
  // 2. Parent state updates, causing re-render
  // 3. New callback references would trigger useEffect cleanup
  // 4. Cleanup destroys provider, causing disconnect
  // 5. New effect creates new provider, connects again -> loop
  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;

  // Create a stable token getter that Hocuspocus will call on each auth request
  // This ensures we always get a fresh token from Clerk
  const tokenGetterRef = useRef<() => Promise<string | null>>(getToken);
  tokenGetterRef.current = getToken;

  // Create editor with Yjs plugin for real-time collaboration
  const editor = usePlateEditor({
    plugins: [
      ...EditorKit,
      YjsPlugin.configure({
        options: {
          providers: [
            {
              type: "hocuspocus" as const,
              options: {
                url: config.url,
                name: config.roomName,
                // Pass a function instead of static token - Hocuspocus calls this on each auth request
                // This allows automatic token refresh without disconnecting
                token: async () => {
                  const token = await tokenGetterRef.current();
                  return token ?? "";
                },
                // Handle authentication failures - these are NOT exposed through YjsPlugin callbacks
                // but can be passed directly to the Hocuspocus provider
                onAuthenticationFailed: ({ reason }: { reason: string }) => {
                  console.error("[Hocuspocus] Authentication failed:", reason);
                  onConnectionChangeRef.current?.("error");
                },
                // Handle connection status changes for better debugging
                onStatus: ({ status }: { status: string }) => {
                  if (process.env.NODE_ENV === "development") {
                    // eslint-disable-next-line no-console
                    console.log("[Hocuspocus] Status changed:", status);
                  }
                },
              },
            },
          ],
          cursors: {
            data: {
              color: config.cursorColor,
              name: cursorName,
            },
          },
          onConnect: () => {
            if (process.env.NODE_ENV === "development") {
              // eslint-disable-next-line no-console
              console.log(
                "[YjsPlugin] onConnect fired - setting isConnected to true"
              );
            }
            setIsConnected(true);
            onConnectionChangeRef.current?.("connected");
            // Join collaboration session in Convex (only once)
            if (!hasJoinedRef.current) {
              hasJoinedRef.current = true;
              joinSession({
                documentId,
                connectionId: connectionIdRef.current,
              }).catch(console.error);
            }
          },
          onDisconnect: () => {
            if (process.env.NODE_ENV === "development") {
              // eslint-disable-next-line no-console
              console.log(
                "[YjsPlugin] onDisconnect fired - setting isConnected to false"
              );
            }
            setIsConnected(false);
            onConnectionChangeRef.current?.("disconnected");
          },
          onError: ({ error }) => {
            console.error("[YjsPlugin] onError fired:", error);
            onConnectionChangeRef.current?.("error");
          },
          onSyncChange: ({ isSynced, type }) => {
            if (process.env.NODE_ENV === "development") {
              // eslint-disable-next-line no-console
              console.log("[YjsPlugin] onSyncChange fired:", { isSynced, type });
            }
            // CRITICAL FIX: When Yjs syncs an empty document, the editor has no children.
            // PlateContent returns null when editor.children is empty, making the editor invisible.
            // We need to ensure the editor always has at least one paragraph element.
            if (
              isSynced &&
              (!editor.children || editor.children.length === 0)
            ) {
              if (process.env.NODE_ENV === "development") {
                // eslint-disable-next-line no-console
                console.log(
                  "[YjsPlugin] Empty document detected after sync - inserting default paragraph"
                );
              }
              // Insert a default empty paragraph using Slate's Transforms
              // This is synchronized via Yjs to all collaborators
              editor.tf.insertNodes(
                { type: "p", children: [{ text: "" }] },
                { at: [0] }
              );
            }
            // CRITICAL: Signal that the editor is ready to render.
            // PlateContent returns null when editor.children is empty.
            // Setting this state forces a React re-render after Yjs populates the editor.
            if (isSynced && editor.children && editor.children.length > 0) {
              setIsEditorReady(true);
            }
          },
        },
      }),
    ],
    // CRITICAL: When using Yjs, do NOT pass the `value` prop.
    // Yjs manages document state via the Hocuspocus server.
    // Passing `value` causes "Path doesn't match yText" errors because
    // Plate tries to sync its JSON value with Yjs's document state.
    // `skipInitialization: true` tells Plate to let Yjs handle initialization.
    skipInitialization: true,
  });

  // Initialize Yjs collaboration - must be called manually as autoConnect is false internally
  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (initCalledRef.current) {
      return;
    }
    initCalledRef.current = true;

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[YjsPlugin] Initializing Yjs collaboration...");
    }

    // Set a connection timeout - if we don't connect within the timeout, report error
    // This handles cases where the server is unreachable or the connection hangs
    let timeoutId: NodeJS.Timeout | null = null;
    let initComplete = false;

    timeoutId = setTimeout(() => {
      // Only fire timeout if init hasn't completed and we're not connected
      if (!initComplete) {
        console.error(
          "[YjsPlugin] Connection timeout - server may be unreachable"
        );
        // Check the editor's Yjs connection state before reporting error
        const yjsOptions = editor.getOptions(YjsPlugin);
        if (!yjsOptions._isConnected) {
          onConnectionChangeRef.current?.("error");
        }
      }
    }, CONNECTION_TIMEOUT_MS);

    editor.api.yjs
      .init()
      .then(() => {
        // Mark init as complete when the promise resolves
        initComplete = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.log("[YjsPlugin] Init completed successfully");
        }
      })
      .catch((error: Error) => {
        initComplete = true;
        // Clear timeout on error
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        // Ignore "already connected" errors (can happen in Strict Mode)
        if (error.message.includes("already connected")) {
          return;
        }
        console.error("[YjsPlugin] Init error:", error);
        onConnectionChangeRef.current?.("error");
      });

    return () => {
      initCalledRef.current = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [editor]);

  // Cleanup on unmount - leave the collaboration session
  useEffect(() => {
    return () => {
      // Read current ref values at cleanup time (not at effect creation)
      const shouldLeave = hasJoinedRef.current;
      const connectionId = connectionIdRef.current;

      if (shouldLeave && connectionId) {
        leaveSession({
          documentId,
          connectionId,
        }).catch(console.error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are read at cleanup time, leaveSession is stable
  }, [documentId]);

  // Auto-refresh token before expiry to maintain WebSocket connection
  useEffect(() => {
    // Only run when connected
    if (!isConnected) return;

    const refreshConnection = async (): Promise<void> => {
      try {
        // Get fresh token from Clerk to verify auth is still valid
        const token = await tokenGetterRef.current();
        if (!token) {
          console.error(
            "[YjsPlugin] Failed to refresh token - no token available"
          );
          return;
        }

        // The token function passed to Hocuspocus will handle getting fresh tokens
        // on each auth request. However, if the WebSocket connection is stale,
        // we need to trigger a reconnection to force re-authentication.
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.log(
            "[YjsPlugin] Token refresh check - connection healthy, token valid"
          );
        }
      } catch (error) {
        console.error("[YjsPlugin] Token refresh failed:", error);
        // If token refresh fails, trigger reconnection to get new auth
        try {
          editor.api.yjs.disconnect();
          await editor.api.yjs.init();
          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.log("[YjsPlugin] Reconnected after token refresh failure");
          }
        } catch (reconnectError) {
          console.error("[YjsPlugin] Reconnection failed:", reconnectError);
          onConnectionChangeRef.current?.("error");
        }
      }
    };

    // Set up interval to check/refresh token
    const interval = setInterval(refreshConnection, TOKEN_REFRESH_INTERVAL_MS);

    // Clean up on unmount or when connection changes
    return () => clearInterval(interval);
  }, [isConnected, editor]);

  return {
    editor,
    isConnected,
    isEditorReady,
  };
}
