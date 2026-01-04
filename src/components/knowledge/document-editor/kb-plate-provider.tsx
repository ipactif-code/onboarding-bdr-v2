"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import {
  getHocuspocusUrl,
  generateCursorData,
  getConnectionState,
  type ConnectionState,
  type CursorData,
} from "@/lib/knowledge";

// Use the awareness type from the provider instance instead of importing directly
// This avoids module resolution issues with y-protocols in pnpm
type Awareness = NonNullable<HocuspocusProvider["awareness"]>;

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/**
 * Connection status for the collaboration provider.
 * More detailed than ConnectionState, includes 'error' state.
 */
export type CollaborationConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "syncing"
  | "synced"
  | "disconnected"
  | "error";

/**
 * User presence data for cursor awareness.
 */
export interface AwarenessUser {
  /** User's display name */
  name: string;
  /** HSL color for the cursor */
  color: string;
  /** User ID (optional) */
  userId?: string;
}

/**
 * Props for the KBPlateProvider component.
 */
export interface KBPlateProviderProps {
  /** The document ID to connect to */
  documentId: string;
  /** React children */
  children: React.ReactNode;
  /** Callback when connection status changes */
  onConnectionChange?: (status: CollaborationConnectionStatus) => void;
  /** If true, disables collaboration (local-only mode) */
  disableCollaboration?: boolean;
  /** Authentication token for the connection (optional, depends on server config) */
  authToken?: string;
  /** User information for cursor display */
  user?: {
    name: string;
    identifier?: string;
    userId?: string;
  };
}

/**
 * Context value for KB collaboration.
 */
export interface KBCollaborationContextValue {
  /** The YJS document instance */
  ydoc: Y.Doc | null;
  /** The Hocuspocus provider instance */
  provider: HocuspocusProvider | null;
  /** Current connection status */
  status: CollaborationConnectionStatus;
  /** Whether in local-only mode (no collaboration server) */
  isLocalOnly: boolean;
  /** Whether the document is synced with the server */
  isSynced: boolean;
  /** Cursor data for the current user */
  cursorData: CursorData | null;
  /** Error message if connection failed */
  errorMessage: string | null;
  /** Retry connection */
  retry: () => void;
}

/**
 * Context value for awareness (cursors/presence).
 */
export interface AwarenessContextValue {
  /** The YJS Awareness instance */
  awareness: Awareness | null;
  /** List of connected users */
  users: AwarenessUser[];
  /** Set local user state */
  setLocalState: (state: Partial<AwarenessUser>) => void;
}

// --------------------------------------------------------------------------
// Contexts
// --------------------------------------------------------------------------

const KBCollaborationContext = createContext<KBCollaborationContextValue>({
  ydoc: null,
  provider: null,
  status: "idle",
  isLocalOnly: true,
  isSynced: false,
  cursorData: null,
  errorMessage: null,
  retry: () => {},
});

const AwarenessContext = createContext<AwarenessContextValue>({
  awareness: null,
  users: [],
  setLocalState: () => {},
});

// --------------------------------------------------------------------------
// Provider Component
// --------------------------------------------------------------------------

/**
 * KBPlateProvider - YJS collaboration provider for the Knowledge Base editor.
 *
 * Features:
 * - Manages YDoc and Hocuspocus provider lifecycle
 * - Provides connection status and error handling
 * - Supports local-only mode when Hocuspocus server is unavailable
 * - Manages cursor awareness for collaborative editing
 *
 * Usage:
 * ```tsx
 * <KBPlateProvider
 *   documentId="doc_123"
 *   user={{ name: "John Doe", identifier: "john@example.com" }}
 *   onConnectionChange={(status) => console.log(status)}
 * >
 *   <YourEditor />
 * </KBPlateProvider>
 * ```
 */
export function KBPlateProvider({
  documentId,
  children,
  onConnectionChange,
  disableCollaboration = false,
  authToken,
  user,
}: KBPlateProviderProps): React.ReactElement {
  // State
  const [status, setStatus] = React.useState<CollaborationConnectionStatus>("idle");
  const [isSynced, setIsSynced] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<AwarenessUser[]>([]);

  // Refs for stable references
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const documentIdRef = useRef(documentId);
  const retryCountRef = useRef(0);
  const maxRetriesRef = useRef(3);

  // Cursor data for this user
  const cursorData = React.useMemo((): CursorData | null => {
    if (!user) return null;
    return generateCursorData(user.name, user.identifier);
  }, [user]);

  // Check if we should use local-only mode
  const isLocalOnly = React.useMemo(() => {
    if (disableCollaboration) return true;
    const url = getHocuspocusUrl();
    return !url || url === "";
  }, [disableCollaboration]);

  // Update status and notify callback
  const updateStatus = useCallback(
    (newStatus: CollaborationConnectionStatus): void => {
      setStatus(newStatus);
      onConnectionChange?.(newStatus);
    },
    [onConnectionChange]
  );

  // Create awareness change handler
  const handleAwarenessChange = useCallback((): void => {
    if (!providerRef.current?.awareness) return;

    const awareness = providerRef.current.awareness;
    const states = awareness.getStates();
    const connectedUsers: AwarenessUser[] = [];

    states.forEach((state, _clientId) => {
      // Skip if no user data
      if (!state || typeof state !== "object") return;

      const userData = state as { user?: AwarenessUser };
      if (userData.user) {
        connectedUsers.push({
          ...userData.user,
          // clientId available via _clientId if needed for uniqueness
        });
      }
    });

    setUsers(connectedUsers);
  }, []);

  // Set local awareness state
  const setLocalState = useCallback((state: Partial<AwarenessUser>): void => {
    if (!providerRef.current?.awareness) return;

    const awareness = providerRef.current.awareness;
    const currentState = awareness.getLocalState() as { user?: AwarenessUser } | null;

    awareness.setLocalState({
      ...currentState,
      user: {
        ...currentState?.user,
        ...state,
      },
    });
  }, []);

  // Retry connection
  const retry = useCallback((): void => {
    if (retryCountRef.current >= maxRetriesRef.current) {
      setErrorMessage("Max retry attempts reached. Please refresh the page.");
      return;
    }

    retryCountRef.current += 1;

    // Disconnect current provider if exists
    if (providerRef.current) {
      providerRef.current.disconnect();
      providerRef.current.destroy();
      providerRef.current = null;
    }

    // Reset state and let effect recreate provider
    updateStatus("connecting");
    setErrorMessage(null);
    setIsSynced(false);
  }, [updateStatus]);

  // Initialize YDoc and Provider
  useEffect(() => {
    // Update document ID ref
    documentIdRef.current = documentId;

    // Create YDoc
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // If local-only mode, just use the local YDoc
    if (isLocalOnly) {
      // Log warning in development
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[KBPlateProvider] Running in local-only mode. " +
            "Set NEXT_PUBLIC_HOCUSPOCUS_URL to enable collaboration."
        );
      }
      updateStatus("synced");
      setIsSynced(true);
      return () => {
        ydoc.destroy();
        ydocRef.current = null;
      };
    }

    // Create Hocuspocus provider
    const url = getHocuspocusUrl();
    updateStatus("connecting");

    const provider = new HocuspocusProvider({
      url,
      name: documentId,
      document: ydoc,
      token: authToken,
      onConnect: () => {
        updateStatus("connected");
        retryCountRef.current = 0; // Reset retry count on successful connection
      },
      onClose: () => {
        updateStatus("disconnected");
        setIsSynced(false);
      },
      onSynced: ({ state }) => {
        if (state) {
          updateStatus("synced");
          setIsSynced(true);
        } else {
          updateStatus("syncing");
          setIsSynced(false);
        }
      },
      onAuthenticationFailed: ({ reason }) => {
        updateStatus("error");
        setErrorMessage(`Authentication failed: ${reason}`);
      },
    });

    providerRef.current = provider;

    // Set up awareness if user data is provided
    if (cursorData && provider.awareness) {
      provider.awareness.setLocalState({
        user: {
          name: cursorData.name,
          color: cursorData.color,
          userId: user?.userId,
        },
      });

      // Listen for awareness changes
      provider.awareness.on("change", handleAwarenessChange);
      // Initial update
      handleAwarenessChange();
    }

    // Cleanup
    return () => {
      if (provider.awareness) {
        provider.awareness.off("change", handleAwarenessChange);
      }
      provider.disconnect();
      provider.destroy();
      providerRef.current = null;

      ydoc.destroy();
      ydocRef.current = null;
    };
  }, [
    documentId,
    isLocalOnly,
    authToken,
    cursorData,
    user?.userId,
    updateStatus,
    handleAwarenessChange,
  ]);

  // Collaboration context value
  const collaborationValue = React.useMemo(
    (): KBCollaborationContextValue => ({
      ydoc: ydocRef.current,
      provider: providerRef.current,
      status,
      isLocalOnly,
      isSynced,
      cursorData,
      errorMessage,
      retry,
    }),
    [status, isLocalOnly, isSynced, cursorData, errorMessage, retry]
  );

  // Awareness context value
  const awarenessValue = React.useMemo(
    (): AwarenessContextValue => ({
      awareness: providerRef.current?.awareness ?? null,
      users,
      setLocalState,
    }),
    [users, setLocalState]
  );

  return (
    <KBCollaborationContext.Provider value={collaborationValue}>
      <AwarenessContext.Provider value={awarenessValue}>
        {children}
      </AwarenessContext.Provider>
    </KBCollaborationContext.Provider>
  );
}

// --------------------------------------------------------------------------
// Hooks
// --------------------------------------------------------------------------

/**
 * Hook to access YDoc and connection status for collaboration.
 *
 * @returns KBCollaborationContextValue with ydoc, provider, and status
 * @throws Error if used outside of KBPlateProvider
 *
 * @example
 * ```tsx
 * function EditorStatus() {
 *   const { status, isSynced, isLocalOnly } = useKBCollaboration();
 *
 *   if (isLocalOnly) {
 *     return <span>Local mode</span>;
 *   }
 *
 *   return <span>{isSynced ? 'Synced' : 'Syncing...'}</span>;
 * }
 * ```
 */
export function useKBCollaboration(): KBCollaborationContextValue {
  const context = useContext(KBCollaborationContext);

  if (!context) {
    throw new Error("useKBCollaboration must be used within a KBPlateProvider");
  }

  return context;
}

/**
 * Hook to access cursor/presence awareness.
 *
 * @returns AwarenessContextValue with awareness instance and connected users
 * @throws Error if used outside of KBPlateProvider
 *
 * @example
 * ```tsx
 * function CollaboratorsList() {
 *   const { users } = useAwareness();
 *
 *   return (
 *     <div>
 *       {users.map((user, i) => (
 *         <span key={i} style={{ color: user.color }}>
 *           {user.name}
 *         </span>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAwareness(): AwarenessContextValue {
  const context = useContext(AwarenessContext);

  if (!context) {
    throw new Error("useAwareness must be used within a KBPlateProvider");
  }

  return context;
}

/**
 * Hook to get the derived connection state.
 *
 * This is a convenience hook that maps the collaboration status
 * to a simpler ConnectionState type from the knowledge library.
 *
 * @returns ConnectionState ('connecting' | 'connected' | 'disconnected' | 'syncing' | 'synced')
 */
export function useConnectionState(): ConnectionState {
  const { status, isSynced } = useKBCollaboration();

  return React.useMemo((): ConnectionState => {
    switch (status) {
      case "idle":
      case "connecting":
        return "connecting";
      case "connected":
      case "syncing":
        return getConnectionState(true, false);
      case "synced":
        return getConnectionState(true, true);
      case "disconnected":
      case "error":
        return "disconnected";
      default:
        return "disconnected";
    }
  }, [status, isSynced]);
}

// --------------------------------------------------------------------------
// Exports
// --------------------------------------------------------------------------

export { type ConnectionState };
