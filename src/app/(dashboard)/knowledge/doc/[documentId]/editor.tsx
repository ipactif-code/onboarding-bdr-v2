"use client";

import * as React from "react";
import { useState, useCallback, useMemo, memo } from "react";
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
import { Editor, EditorContainer } from "@/components/plate-ui/editor";
import { PresenceAvatars } from "@/components/knowledge/collaboration";
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
  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue,
  });

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

  // Debug logging for development
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[Editor] Document:", initialDocument._id);
    // eslint-disable-next-line no-console
    console.log("[Editor] Content type:", typeof contentData?.content);
    // eslint-disable-next-line no-console
    console.log("[Editor] Collab config state (from hook):", {
      configStatus: collabState.status,
      canJoin: collabState.canJoin,
      hasConfig: !!collabState.config,
      isNotConfigured,
      error: collabState.error,
    });
    // eslint-disable-next-line no-console
    console.log("[Editor] Connection status (UI):", connectionStatus);
  }

  // Determine if document has existing JSON content
  const hasExistingJsonContent = useMemo(() => {
    if (!contentData?.content || !Array.isArray(contentData.content)) {
      return false;
    }
    const firstElement = contentData.content[0];
    const hasJsonFormat =
      firstElement &&
      typeof firstElement === "object" &&
      "type" in firstElement &&
      "children" in firstElement;

    const hasNonEmptyContent =
      contentData.content.length > 1 ||
      (firstElement?.children?.[0]?.text &&
        firstElement.children[0].text.length > 0);

    if (hasJsonFormat && hasNonEmptyContent) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log(
          "[Editor] Existing JSON content detected - will use standalone mode"
        );
      }
      return true;
    }
    return false;
  }, [contentData?.content]);

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

  // Determine if we should use collaborative or standalone editor
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
      </div>
    </div>
  );
}

export default DocumentEditorClient;
