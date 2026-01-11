"use client";

import * as React from "react";
import { useState, useCallback, useMemo, useRef, memo } from "react";
import { type Value } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { Id } from "../../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../../convex/_generated/api").api;
import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRecordAccess } from "@/hooks/knowledge/use-record-access";
import {
  useCollaborationConfig,
  type CollaborationConnectionStatus,
} from "@/hooks/knowledge/use-collaboration-config";
import {
  useHocuspocusProvider,
  type HocuspocusConnectionStatus,
} from "@/hooks/knowledge/use-hocuspocus-provider";
import {
  useEditorSave,
  type SaveStatus,
} from "@/hooks/knowledge/use-editor-save";
import { EditorKit } from "@/components/editor/editor-kit";
import { useDiscussionPluginSync } from "@/components/editor/plugins/discussion-kit";
import { Editor, EditorContainer } from "@/components/plate-ui/editor";
import { PresenceAvatars } from "@/components/knowledge/collaboration";
import { DiscussionProvider } from "@/components/knowledge/discussions";
import { EditorErrorBoundary } from "@/components/knowledge/editor-error-boundary";
import {
  SaveStatusIndicator,
  ConnectionStatusIndicator,
  DocumentEditorSkeleton,
  EditorContentSkeleton,
  ErrorState,
  type EditorConnectionStatus,
} from "@/components/knowledge/editor-indicators";

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

// Unified connection status type for UI display
type ConnectionStatus =
  | CollaborationConnectionStatus
  | HocuspocusConnectionStatus
  | EditorConnectionStatus;

// ============================================================================
// Collaborative Editor Component (with Yjs)
// ============================================================================

interface CollaborativeEditorContentProps {
  documentId: Id<"kbDocuments">;
  config: NonNullable<
    ReturnType<typeof useCollaborationConfig>["state"]["config"]
  >;
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
  // Use the extracted Hocuspocus provider hook
  const { editor, isConnected, isEditorReady } = useHocuspocusProvider({
    documentId,
    config,
    cursorName,
    getToken,
    onConnectionChange,
  });

  // Sync discussion context to Plate.js plugin
  // Pass isEditorReady so comment marks wait for Yjs content to sync
  useDiscussionPluginSync(editor, isEditorReady);

  // Use the extracted editor save hook for offline fallback
  const { save: debouncedSave } = useEditorSave({
    documentId,
    isConnected,
    onSaveStatusChange,
  });

  // Show loading state until editor is ready.
  if (!isEditorReady) {
    return <EditorContentSkeleton />;
  }

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => {
        // DUAL-WRITE: Always save to Convex for persistence and search indexing.
        // Yjs handles real-time sync, while Convex handles durable storage.
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.log("[Editor] onChange fired, calling debouncedSave");
        }
        debouncedSave(value);
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
  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue,
  });

  // Sync discussion context to Plate.js plugin
  useDiscussionPluginSync(editor);

  // Use the extracted editor save hook
  const { save: debouncedSave } = useEditorSave({
    documentId,
    isConnected: false,
    onSaveStatusChange,
  });

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

  // ============================================================================
  // Yjs-First Architecture: Mode decision refs
  // Mode is decided ONCE at mount and NEVER changes during component lifecycle.
  // This prevents WebSocket disconnections when Convex content updates.
  // ============================================================================
  const modeDecidedRef = useRef(false);
  const useCollaborativeModeRef = useRef<boolean | null>(null);

  // Create stable callback handlers to prevent child component re-renders.
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

  // Get collaboration configuration using extracted hook
  const {
    state: collabState,
    retry: retryConnection,
    isNotConfigured,
  } = useCollaborationConfig({
    documentId,
  });

  // Fetch document content (separate from metadata for performance)
  const contentData = useQuery(api.knowledge.documents.getContent, {
    documentId,
  });

  // ============================================================================
  // Yjs-First Architecture: ONE-TIME mode decision
  // This runs ONCE when we have enough data to make the decision.
  // After the decision is made, mode NEVER changes regardless of Convex updates.
  // NOTE: We wait for config loading to complete before making the decision.
  // Config loading is complete when:
  // - collabState.config !== null (config loaded successfully), OR
  // - isNotConfigured === true (no config available - graceful fallback), OR
  // - collabState.status === "error" (error occurred)
  // ============================================================================
  const isConfigLoadingComplete =
    collabState.config !== null ||
    isNotConfigured ||
    collabState.status === "error";

  if (
    !modeDecidedRef.current &&
    contentData !== undefined &&
    isConfigLoadingComplete
  ) {
    modeDecidedRef.current = true;

    // Decide: use collaborative if config is available
    useCollaborativeModeRef.current =
      !isNotConfigured &&
      !!collabState.config &&
      collabState.canJoin;

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log(
        "[Editor] Mode decided ONCE:",
        useCollaborativeModeRef.current ? "collaborative" : "standalone",
        {
          isNotConfigured,
          hasConfig: !!collabState.config,
          canJoin: collabState.canJoin,
          configStatus: collabState.status,
        }
      );
    }
  }

  // Determine initial value for editor
  const initialValue: Value = useMemo(() => {
    if (contentData?.content && Array.isArray(contentData.content)) {
      return contentData.content as Value;
    }
    // Default empty paragraph
    return [{ type: "p", children: [{ text: "" }] }] as Value;
  }, [contentData?.content]);

  // Memoize the collaboration config to prevent unnecessary re-renders.
  const stableConfig = useMemo(
    () => collabState.config,
    [collabState.config]
  );

  // Show loading skeleton while fetching content
  if (contentData === undefined) {
    return <DocumentEditorSkeleton />;
  }

  // Show loading while getting collaboration config (but only on initial load)
  if (!collabState.config && !isNotConfigured) {
    return <DocumentEditorSkeleton />;
  }

  // Show error state ONLY if there's an actual error (not just "not configured")
  if (!collabState.canJoin && collabState.error && !isNotConfigured) {
    return <ErrorState error={collabState.error} onRetry={retryConnection} />;
  }

  // ============================================================================
  // Use the REF-based mode decision (immutable after first decision)
  // This prevents mode switching when Convex content updates
  // ============================================================================
  const useCollaborativeEditor = useCollaborativeModeRef.current === true;

  // Use the actual connection status from the editor when connected
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
          {(!useCollaborativeEditor ||
            connectionStatus === "disconnected") && (
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
        <DiscussionProvider documentId={documentId}>
          <EditorErrorBoundary backUrl="/knowledge">
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
          </EditorErrorBoundary>
        </DiscussionProvider>
      </div>
    </div>
  );
}

export default DocumentEditorClient;
