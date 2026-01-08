"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { type Value } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { YjsPlugin } from "@platejs/yjs/react";
import { Id } from "../../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../../convex/_generated/api").api;
import {
  ChevronRight,
  Home,
  Save,
  Loader2,
  Check,
  Wifi,
  WifiOff,
  Users,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useDebouncedCallback } from "@/hooks/use-debounce-callback";
import { useRecordAccess } from "@/hooks/knowledge/use-record-access";
import { EditorKit } from "@/components/editor/editor-kit";
import { Editor, EditorContainer } from "@/components/plate-ui/editor";
import { PresenceAvatars } from "@/components/knowledge/collaboration";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

// ============================================================================
// Constants
// ============================================================================

/**
 * Interval for checking/refreshing authentication tokens.
 * Set to 50 seconds to refresh 10 seconds before the typical 60-second token expiry.
 */
const TOKEN_REFRESH_INTERVAL_MS = 50 * 1000;

/**
 * Timeout for initial WebSocket connection to Hocuspocus server.
 * If connection is not established within this time, report error state.
 */
const CONNECTION_TIMEOUT_MS = 15 * 1000;

/**
 * Duration to display "Saved" status indicator before resetting to idle.
 */
const SAVE_STATUS_DISPLAY_MS = 2000;

/**
 * Debounce delay for auto-save when in collaborative mode (offline fallback).
 * Longer delay since Yjs handles real-time sync when connected.
 */
const COLLAB_SAVE_DEBOUNCE_MS = 1000;

/**
 * Maximum wait time for debounced save in collaborative mode.
 * Ensures save occurs within this window regardless of continued typing.
 */
const COLLAB_SAVE_MAX_WAIT_MS = 5000;

/**
 * Debounce delay for auto-save in standalone (non-collaborative) mode.
 * Shorter delay for more responsive saving without Yjs sync.
 */
const STANDALONE_SAVE_DEBOUNCE_MS = 500;

/**
 * Maximum wait time for debounced save in standalone mode.
 */
const STANDALONE_SAVE_MAX_WAIT_MS = 2000;

/**
 * Default cursor color for collaboration presence.
 * Used when user's personalized color is not yet available.
 */
const DEFAULT_CURSOR_COLOR = "#FF5733";

/**
 * Length of random suffix for connection IDs.
 * Uses base36 substring for compact unique identifiers.
 */
const CONNECTION_ID_RANDOM_LENGTH = 7;

// ============================================================================
// Types
// ============================================================================

interface Document {
  _id: Id<"kbDocuments">;
  title: string;
  content?: unknown;
  icon?: string;
}

interface BreadcrumbItem {
  id: string;
  title?: string;
  name?: string;
  type: "workspace" | "folder" | "document";
}

interface DocumentEditorClientProps {
  documentId: Id<"kbDocuments">;
  initialDocument: Document;
  breadcrumbs: BreadcrumbItem[];
}

// ============================================================================
// Collaboration Types
// ============================================================================

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface CollaborationConfig {
  url: string;
  roomName: string;
  token: string;
  cursorColor: string;
  activeEditors: number;
}

interface CollaborationState {
  status: ConnectionStatus;
  config: CollaborationConfig | null;
  canJoin: boolean;
  error: string | null;
  activeEditors: number;
}

// ============================================================================
// Save Status Indicator
// ============================================================================

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveStatusIndicator({
  status,
}: {
  status: SaveStatus;
}): React.ReactElement | null {
  if (status === "idle") return null;

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {status === "saving" && (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="size-3.5 text-green-500" />
          <span>Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <Save className="size-3.5 text-destructive" />
          <span className="text-destructive">Save failed</span>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Connection Status Indicator
// ============================================================================

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
  error: string | null;
  activeEditors: number;
}

function ConnectionStatusIndicator({
  status,
  error,
  activeEditors,
}: ConnectionStatusIndicatorProps): React.ReactElement {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            {status === "connecting" && (
              <>
                <div className="size-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">
                  Connecting...
                </span>
              </>
            )}
            {status === "connected" && (
              <>
                <Wifi className="size-3.5 text-green-500" />
                <span className="text-xs text-muted-foreground">Live</span>
                {activeEditors > 1 && (
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Users className="size-3" />
                    {activeEditors}
                  </span>
                )}
              </>
            )}
            {status === "disconnected" && (
              <>
                <WifiOff className="size-3.5 text-gray-400" />
                <span className="text-xs text-muted-foreground">Offline</span>
              </>
            )}
            {status === "error" && (
              <>
                <div className="size-2 rounded-full bg-red-500" />
                <span className="text-xs text-destructive">Error</span>
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {status === "connecting" && "Connecting to collaboration server..."}
          {status === "connected" &&
            `Real-time collaboration active${activeEditors > 1 ? ` (${activeEditors} editors)` : ""}`}
          {status === "disconnected" &&
            "Offline - changes saved locally, will sync when reconnected"}
          {status === "error" && (error || "Connection error")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function DocumentEditorSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumbs skeleton */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <Skeleton className="size-4" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Header skeleton */}
      <div className="px-8 py-6 border-b">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8" />
          <Skeleton className="h-8 w-64" />
        </div>
      </div>

      {/* Editor skeleton */}
      <div className="flex-1 px-8 py-6 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <div className="text-center">
        <WifiOff className="size-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Cannot Join Collaboration
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">{error}</p>
      </div>
      <Button onClick={onRetry} variant="outline">
        Retry Connection
      </Button>
    </div>
  );
}

// ============================================================================
// Collaborative Editor Component (with Yjs)
// ============================================================================

interface CollaborativeEditorContentProps {
  documentId: Id<"kbDocuments">;
  config: CollaborationConfig;
  cursorName: string;
  getToken: () => Promise<string | null>;
  onSaveStatusChange: (status: SaveStatus) => void;
  onConnectionChange: (status: ConnectionStatus) => void;
}

const CollaborativeEditorContent = memo(function CollaborativeEditorContent({
  documentId,
  config,
  cursorName,
  getToken,
  onSaveStatusChange,
  onConnectionChange,
}: CollaborativeEditorContentProps): React.ReactElement {
  const updateContent = useMutation(api.knowledge.documents.updateContent);
  const joinSession = useMutation(api.knowledge.collaboration.joinSession);
  const leaveSession = useMutation(api.knowledge.collaboration.leaveSession);
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

  const onSaveStatusChangeRef = useRef(onSaveStatusChange);
  onSaveStatusChangeRef.current = onSaveStatusChange;

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
                  onConnectionChangeRef.current("error");
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
              console.log("[YjsPlugin] onConnect fired - setting isConnected to true");
            }
            setIsConnected(true);
            // Use ref to avoid triggering parent re-render causing effect cleanup
            onConnectionChangeRef.current("connected");
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
              console.log("[YjsPlugin] onDisconnect fired - setting isConnected to false");
            }
            setIsConnected(false);
            // Use ref to avoid triggering parent re-render causing effect cleanup
            onConnectionChangeRef.current("disconnected");
          },
          onError: ({ error }) => {
            console.error("[YjsPlugin] onError fired:", error);
            // Use ref to avoid triggering parent re-render causing effect cleanup
            onConnectionChangeRef.current("error");
          },
          onSyncChange: ({ isSynced, type }) => {
            if (process.env.NODE_ENV === "development") {
              // eslint-disable-next-line no-console
              console.log("[YjsPlugin] onSyncChange fired:", { isSynced, type });
            }
            // CRITICAL FIX: When Yjs syncs an empty document, the editor has no children.
            // PlateContent returns null when editor.children is empty, making the editor invisible.
            // We need to ensure the editor always has at least one paragraph element.
            if (isSynced && (!editor.children || editor.children.length === 0)) {
              if (process.env.NODE_ENV === "development") {
                // eslint-disable-next-line no-console
                console.log("[YjsPlugin] Empty document detected after sync - inserting default paragraph");
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
  // CRITICAL: Remove onConnectionChange from dependencies to prevent infinite loop.
  // The callback is accessed via onConnectionChangeRef to always call the latest version.
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
    // Note: We check isConnected state to avoid race conditions with onConnect callback
    let timeoutId: NodeJS.Timeout | null = null;
    let initComplete = false;

    timeoutId = setTimeout(() => {
      // Only fire timeout if init hasn't completed and we're not connected
      // The isConnected state is managed by the onConnect callback in YjsPlugin options
      if (!initComplete) {
        console.error("[YjsPlugin] Connection timeout - server may be unreachable");
        // Check the editor's Yjs connection state before reporting error
        const yjsOptions = editor.getOptions(YjsPlugin);
        if (!yjsOptions._isConnected) {
          onConnectionChangeRef.current("error");
        }
      }
    }, CONNECTION_TIMEOUT_MS);

    editor.api.yjs.init().then(() => {
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
    }).catch((error: Error) => {
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
      // Use ref to avoid dependency on callback
      onConnectionChangeRef.current("error");
    });

    return () => {
      initCalledRef.current = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [editor]);

  // Cleanup on unmount - leave the collaboration session
  // We intentionally read ref values at cleanup time to get their current state
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
  // This is a backup mechanism - the primary refresh happens via the token function
  // passed to Hocuspocus (which is called on each auth request)
  useEffect(() => {
    // Only run when connected
    if (!isConnected) return;

    const refreshConnection = async (): Promise<void> => {
      try {
        // Get fresh token from Clerk to verify auth is still valid
        // Use ref to access latest getToken without causing effect re-runs
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
        // Check if we need to reconnect by attempting a disconnect/connect cycle
        // only if the connection appears degraded.
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
          // Use ref to avoid dependency on callback
          onConnectionChangeRef.current("error");
        }
      }
    };

    // Set up interval to check/refresh token
    const interval = setInterval(refreshConnection, TOKEN_REFRESH_INTERVAL_MS);

    // Clean up on unmount or when connection changes
    return () => clearInterval(interval);
  }, [isConnected, editor]);

  // Debounced save handler for local backup when disconnected
  // When connected, Yjs handles persistence via the Hocuspocus server
  // Uses ref for onSaveStatusChange to avoid unnecessary effect re-runs
  const debouncedSave = useDebouncedCallback(
    async (value: Value) => {
      // Only save locally when disconnected (as a backup)
      if (isConnected) {
        onSaveStatusChangeRef.current("idle");
        return;
      }

      onSaveStatusChangeRef.current("saving");
      try {
        // Extract plain text for search indexing
        const contentText = extractTextFromSlate(value);
        const wordCount = countWords(contentText);

        await updateContent({
          documentId,
          content: value,
          contentText,
          wordCount,
        });
        onSaveStatusChangeRef.current("saved");

        // Reset to idle after a delay
        setTimeout(() => {
          onSaveStatusChangeRef.current("idle");
        }, SAVE_STATUS_DISPLAY_MS);
      } catch (error) {
        console.error("Failed to save document:", error);
        onSaveStatusChangeRef.current("error");
        toast.error("Failed to save document");
      }
    },
    COLLAB_SAVE_DEBOUNCE_MS,
    { maxWait: COLLAB_SAVE_MAX_WAIT_MS }
  );

  // Show loading state until editor is ready.
  // PlateContent returns null when editor.children is empty, so we show a
  // skeleton loader until Yjs syncs and populates the editor with content.
  if (!isEditorReady) {
    return (
      <div className="h-full overflow-auto px-[100px] py-4">
        <div className="space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => {
        // When disconnected, fall back to local save
        if (!isConnected) {
          debouncedSave(value);
        }
      }}
    >
      {/* h-full ensures the container fills parent, overflow-auto allows scrolling */}
      <EditorContainer className="h-full overflow-auto">
        <Editor placeholder="Start writing..." />
      </EditorContainer>
    </Plate>
  );
});

// ============================================================================
// Standalone Editor Component (without Yjs - fallback mode)
// ============================================================================

interface StandaloneEditorContentProps {
  documentId: Id<"kbDocuments">;
  initialValue: Value;
  onSaveStatusChange: (status: SaveStatus) => void;
}

function StandaloneEditorContent({
  documentId,
  initialValue,
  onSaveStatusChange,
}: StandaloneEditorContentProps): React.ReactElement {
  const updateContent = useMutation(api.knowledge.documents.updateContent);

  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue,
  });

  // Debounced save handler for standalone mode
  const debouncedSave = useDebouncedCallback(
    async (value: Value) => {
      onSaveStatusChange("saving");
      try {
        // Extract plain text for search indexing
        const contentText = extractTextFromSlate(value);
        const wordCount = countWords(contentText);

        await updateContent({
          documentId,
          content: value,
          contentText,
          wordCount,
        });
        onSaveStatusChange("saved");

        // Reset to idle after a delay
        setTimeout(() => {
          onSaveStatusChange("idle");
        }, SAVE_STATUS_DISPLAY_MS);
      } catch (error) {
        console.error("Failed to save document:", error);
        onSaveStatusChange("error");
        toast.error("Failed to save document");
      }
    },
    STANDALONE_SAVE_DEBOUNCE_MS,
    { maxWait: STANDALONE_SAVE_MAX_WAIT_MS }
  );

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => {
        debouncedSave(value);
      }}
    >
      {/* h-full ensures the container fills parent, overflow-auto allows scrolling */}
      <EditorContainer className="h-full overflow-auto">
        <Editor placeholder="Start writing..." />
      </EditorContainer>
    </Plate>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract plain text from Slate value for search indexing.
 */
function extractTextFromSlate(value: Value): string {
  const texts: string[] = [];

  function extractFromNode(node: unknown): void {
    if (!node || typeof node !== "object") return;

    const n = node as Record<string, unknown>;

    // If node has text property, it's a text node
    if (typeof n.text === "string") {
      texts.push(n.text);
      return;
    }

    // If node has children, recurse
    if (Array.isArray(n.children)) {
      for (const child of n.children) {
        extractFromNode(child);
      }
    }
  }

  for (const node of value) {
    extractFromNode(node);
  }

  return texts.join(" ").trim();
}

/**
 * Count words in a text string.
 */
function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).length;
}

// ============================================================================
// useCollaborationConfig Hook
// ============================================================================

interface UseCollaborationConfigOptions {
  documentId: Id<"kbDocuments">;
}

interface UseCollaborationConfigReturn {
  state: CollaborationState;
  retry: () => void;
  /** True if collaboration is simply not configured (graceful fallback), false if there's an actual error */
  isNotConfigured: boolean;
}

/**
 * Reasons that indicate graceful fallback rather than error.
 * These are expected conditions where we should use standalone mode silently.
 */
const GRACEFUL_FALLBACK_REASONS = [
  "Collaboration server not configured.",
];

function useCollaborationConfig({
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
        console.log("[Collaboration] Configuration ready, connecting to:", tokenResult.url);
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

// ============================================================================
// Main Component
// ============================================================================

/**
 * Knowledge Base Document Editor with real-time collaboration.
 *
 * Features:
 * - Real-time collaboration via Hocuspocus + Yjs
 * - Cursor presence and user awareness
 * - Fallback to local auto-save when offline
 * - Connection status indicator
 * - 25-editor limit enforcement
 * - Graceful error handling
 */
export function DocumentEditorClient({
  documentId,
  initialDocument,
  breadcrumbs,
}: DocumentEditorClientProps): React.ReactElement {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");

  // Create stable callback handlers to prevent child component re-renders.
  // Without useCallback, setSaveStatus/setConnectionStatus create new function
  // references on each render, which would cause the memoized child component
  // to re-render unnecessarily.
  const handleSaveStatusChange = useCallback((status: SaveStatus) => {
    setSaveStatus(status);
  }, []);

  const handleConnectionChange = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
  }, []);

  // Get token function for collaborative editor token refresh
  const { getToken } = useAuth();

  // Get current user for cursor name
  const currentUser = useQuery(api.users.me);
  const userName = currentUser?.name || "Anonymous";

  // Record document access for recents tracking
  useRecordAccess({ documentId });

  // Get collaboration configuration
  const { state: collabState, retry: retryConnection, isNotConfigured } =
    useCollaborationConfig({
      documentId,
    });

  // Fetch document content (separate from metadata for performance)
  const contentData = useQuery(api.knowledge.documents.getContent, {
    documentId,
  });

  // Debug logging for development
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[Editor] Document:", initialDocument._id);
    // eslint-disable-next-line no-console
    console.log("[Editor] Content type:", typeof contentData?.content);
    // eslint-disable-next-line no-console
    console.log("[Editor] Collab config state (from hook):", {
      configStatus: collabState.status, // This is the config fetch status, not actual connection
      canJoin: collabState.canJoin,
      hasConfig: !!collabState.config,
      isNotConfigured,
      error: collabState.error,
    });
    // eslint-disable-next-line no-console
    console.log("[Editor] Connection status (UI):", connectionStatus);
  }

  // Determine if document has existing JSON content
  // Documents with existing Plate.js JSON content should NOT attempt Yjs collaboration
  // because Yjs expects its own format and will fail with "Path doesn't match yText"
  const hasExistingJsonContent = React.useMemo(() => {
    if (!contentData?.content || !Array.isArray(contentData.content)) {
      return false;
    }
    // JSON format has objects with 'type' property (e.g., { type: "p", children: [...] })
    const firstElement = contentData.content[0];
    const hasJsonFormat =
      firstElement &&
      typeof firstElement === "object" &&
      "type" in firstElement &&
      "children" in firstElement;

    // Also check if content is non-empty (more than just default empty paragraph)
    const hasNonEmptyContent =
      contentData.content.length > 1 ||
      (firstElement?.children?.[0]?.text && firstElement.children[0].text.length > 0);

    if (hasJsonFormat && hasNonEmptyContent) {
      // Debug: Development logging for JSON content detection
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log("[Editor] Existing JSON content detected - will use standalone mode");
      }
      return true;
    }
    return false;
  }, [contentData?.content]);

  // Determine initial value for editor
  const initialValue: Value = React.useMemo(() => {
    if (contentData?.content && Array.isArray(contentData.content)) {
      return contentData.content as Value;
    }
    // Default empty paragraph
    return [{ type: "p", children: [{ text: "" }] }] as Value;
  }, [contentData?.content]);

  // Memoize the collaboration config to prevent unnecessary re-renders of the editor.
  // collabState.config is a new object each render, but we only care about the actual values.
  // We intentionally list individual fields to avoid re-creating when only object reference changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableConfig = useMemo(() => collabState.config, [
    collabState.config?.url,
    collabState.config?.roomName,
    collabState.config?.token,
    collabState.config?.cursorColor,
    collabState.config?.activeEditors,
  ]);

  // Show loading skeleton while fetching content
  if (contentData === undefined) {
    return <DocumentEditorSkeleton />;
  }

  // Show loading while getting collaboration config (but only on initial load)
  // Skip this check if collaboration is not configured - go straight to standalone
  // Note: We only check for config presence, not status. The status tracks config
  // readiness, while the actual WebSocket connection status comes from onConnect callback.
  if (!collabState.config && !isNotConfigured) {
    return <DocumentEditorSkeleton />;
  }

  // Show error state ONLY if there's an actual error (not just "not configured")
  // Real errors include: max editors reached, document not found, access denied
  if (!collabState.canJoin && collabState.error && !isNotConfigured) {
    return <ErrorState error={collabState.error} onRetry={retryConnection} />;
  }

  // Determine if we should use collaborative or standalone editor
  // Use standalone mode if:
  // 1. Collaboration is not configured (graceful fallback)
  // 2. Document has existing JSON content (Yjs incompatible)
  // 3. Collaboration config is not available
  const shouldUseStandalone =
    isNotConfigured || hasExistingJsonContent || !stableConfig;

  const useCollaborativeEditor =
    !shouldUseStandalone && stableConfig && collabState.canJoin;

  // Debug: Development logging for standalone mode selection
  if (shouldUseStandalone && !isNotConfigured && hasExistingJsonContent) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[Editor] Using standalone mode for existing JSON document");
    }
  }

  // Use the actual connection status from the editor when connected
  // For standalone mode, show "disconnected" (offline indicator)
  const displayStatus = useCollaborativeEditor
    ? connectionStatus
    : "disconnected";

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumbs */}
      <div className="flex items-center justify-between px-4 py-2 text-sm text-muted-foreground border-b">
        <div className="flex items-center gap-1">
          <Link href="/knowledge" className="hover:text-foreground">
            <Home className="size-4" />
          </Link>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight className="size-3" />
              <Link
                href={
                  crumb.type === "workspace"
                    ? `/knowledge/${crumb.id}`
                    : crumb.type === "folder"
                      ? `/knowledge/folder/${crumb.id}`
                      : `/knowledge/doc/${crumb.id}`
                }
                className={cn(
                  "hover:text-foreground",
                  index === breadcrumbs.length - 1 &&
                    "text-foreground font-medium"
                )}
              >
                {crumb.title || crumb.name}
              </Link>
            </React.Fragment>
          ))}
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-4">
          {/* Presence avatars showing collaborators */}
          <PresenceAvatars documentId={documentId} maxAvatars={4} />

          {/* Connection status */}
          <ConnectionStatusIndicator
            status={displayStatus}
            error={collabState.error}
            activeEditors={collabState.activeEditors}
          />

          {/* Save status (only shown in standalone/offline mode) */}
          {(!useCollaborativeEditor || connectionStatus === "disconnected") && (
            <SaveStatusIndicator status={saveStatus} />
          )}
        </div>
      </div>

      {/* Document Header */}
      <div className="px-8 py-6 border-b">
        <div className="flex items-center gap-3">
          {initialDocument.icon && (
            <span className="text-3xl">{initialDocument.icon}</span>
          )}
          <h1 className="text-3xl font-bold">{initialDocument.title}</h1>
        </div>
      </div>

      {/* Editor - min-h-0 is critical for flex children with overflow to work properly */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {useCollaborativeEditor && stableConfig ? (
          <CollaborativeEditorContent
            key={`collab-${documentId}`}
            documentId={documentId}
            config={stableConfig}
            cursorName={userName}
            getToken={getToken}
            onSaveStatusChange={handleSaveStatusChange}
            onConnectionChange={handleConnectionChange}
          />
        ) : (
          <StandaloneEditorContent
            key={`standalone-${documentId}`}
            documentId={documentId}
            initialValue={initialValue}
            onSaveStatusChange={handleSaveStatusChange}
          />
        )}
      </div>
    </div>
  );
}

export default DocumentEditorClient;
