"use client";

import * as React from "react";
import type { Value } from "platejs";
import { useQuery, useMutation } from "convex/react";
import type { Id } from "../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../convex/_generated/api").api;
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";

// Import new Potion-style components
import { KBPlateProvider } from "./kb-plate-provider";
import { KBEditor, KBEditorSkeleton } from "./kb-editor";
import { KBToolbar } from "./kb-toolbar";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/**
 * Props for the KBDocumentEditor component.
 */
export interface KBDocumentEditorProps {
  /** The KB document ID to edit */
  documentId: Id<"kbDocuments">;
  /** Initial content (Plate.js JSON) - optional, will be fetched if not provided */
  initialContent?: Value;
  /** Callback when content is saved */
  onSave?: (content: Value) => Promise<void>;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Show table of contents sidebar */
  showToc?: boolean;
  /** Show fixed toolbar at top */
  showToolbar?: boolean;
  /** Enable collaboration features */
  enableCollaboration?: boolean;
  /** User information for collaboration */
  user?: {
    name: string;
    identifier?: string;
    userId?: string;
  };
  /** Additional CSS classes */
  className?: string;
}

/**
 * Default empty editor value for Plate.js.
 * Ensures DOM-to-Slate mapping works correctly.
 */
const DEFAULT_EDITOR_VALUE: Value = [
  { type: "p", children: [{ text: "" }] },
];

/**
 * Returns valid editor value, falling back to default if undefined/empty.
 */
function getEditorValue(value: Value | undefined): Value {
  return value && value.length > 0 ? value : [...DEFAULT_EDITOR_VALUE];
}

// --------------------------------------------------------------------------
// Main Component
// --------------------------------------------------------------------------

/**
 * Knowledge Base Document Editor.
 *
 * Composes the new Potion-style components into a full-featured document editor:
 * - KBPlateProvider: YJS collaboration context (optional)
 * - KBToolbar: Document-level actions (save, publish, share)
 * - KBEditor: Main editor with TOC sidebar
 *
 * Features:
 * - Fetches document metadata and content from Convex
 * - Auto-save via onChange callback
 * - Real-time collaboration (when enabled)
 * - Table of Contents sidebar
 * - Document versioning and publishing
 *
 * @example
 * ```tsx
 * // Basic usage
 * <KBDocumentEditor
 *   documentId={documentId}
 *   onSave={async (content) => {
 *     await updateContent({ documentId, content });
 *   }}
 * />
 *
 * // With collaboration
 * <KBDocumentEditor
 *   documentId={documentId}
 *   enableCollaboration
 *   user={{ name: "John", identifier: "john@example.com" }}
 * />
 *
 * // Read-only mode
 * <KBDocumentEditor
 *   documentId={documentId}
 *   readOnly
 *   showToolbar={false}
 * />
 * ```
 */
export function KBDocumentEditor({
  documentId,
  initialContent,
  onSave,
  readOnly = false,
  showToc = true,
  showToolbar = true,
  enableCollaboration = false,
  user,
  className,
}: KBDocumentEditorProps): React.ReactElement {
  // Track local content state for controlled editing
  const [localContent, setLocalContent] = React.useState<Value | undefined>(
    initialContent
  );

  // Fetch document metadata
  const document = useQuery(api.knowledge.documents.get, { id: documentId });

  // Fetch document content (separate query for performance)
  const contentData = useQuery(api.knowledge.documents.getContent, {
    documentId,
  });

  // Mutation for saving content
  const updateContentMutation = useMutation(
    api.knowledge.content.updateWithMetadata
  );

  // Sync local content when fetched content changes (initial load)
  React.useEffect(() => {
    if (contentData?.content !== undefined && localContent === undefined) {
      setLocalContent(
        getEditorValue(contentData.content as Value | undefined)
      );
    }
  }, [contentData?.content, localContent]);

  // Use initial content if provided, otherwise use fetched content
  const editorContent = React.useMemo((): Value | undefined => {
    if (initialContent !== undefined) {
      return getEditorValue(initialContent);
    }
    if (localContent !== undefined) {
      return localContent;
    }
    if (contentData?.content !== undefined) {
      return getEditorValue(contentData.content as Value | undefined);
    }
    return undefined;
  }, [initialContent, localContent, contentData?.content]);

  // Handle content changes
  const handleChange = React.useCallback(
    async (newContent: Value): Promise<void> => {
      setLocalContent(newContent);

      // Call onSave if provided (for external auto-save handling)
      if (onSave) {
        try {
          await onSave(newContent);
        } catch (error) {
          console.error("Failed to save content:", error);
          toast.error("Failed to save changes");
        }
      }
    },
    [onSave]
  );

  // Handle save action from toolbar
  const handleSave = React.useCallback(async (): Promise<void> => {
    if (!localContent) return;

    try {
      await updateContentMutation({
        documentId,
        content: localContent,
      });
      toast.success("Document saved");
    } catch (error) {
      console.error("Failed to save document:", error);
      toast.error("Failed to save document");
    }
  }, [documentId, localContent, updateContentMutation]);

  // Show skeleton while loading document or content
  if (document === undefined || (contentData === undefined && initialContent === undefined)) {
    return <KBDocumentEditorSkeleton showToc={showToc} className={className} />;
  }

  // Handle document not found
  if (document === null) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <p className="text-muted-foreground">Document not found</p>
      </div>
    );
  }

  // Handle content not found (create empty content)
  if (contentData === null && initialContent === undefined) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <p className="text-muted-foreground">
          Document content could not be loaded
        </p>
      </div>
    );
  }

  // Render with collaboration provider if enabled
  const editorElement = (
    <div className={cn("flex flex-col h-full", className)} data-slot="kb-document-editor">
      {/* KB-specific toolbar */}
      {showToolbar && (
        <KBToolbar
          documentId={documentId}
          document={document}
          onSave={handleSave}
          readOnly={readOnly}
        />
      )}

      {/* Plate.js editor with TOC */}
      <div className="flex-1 overflow-hidden">
        <KBEditor
          documentId={String(documentId)}
          initialValue={editorContent}
          onChange={handleChange}
          placeholder="Start writing your document..."
          readOnly={readOnly}
          showToc={showToc}
          showToolbar={false} // Toolbar is handled by KBToolbar above
          className="h-full"
        />
      </div>
    </div>
  );

  // Wrap with collaboration provider if enabled
  if (enableCollaboration) {
    return (
      <KBPlateProvider
        documentId={String(documentId)}
        user={user}
        disableCollaboration={!enableCollaboration}
      >
        {editorElement}
      </KBPlateProvider>
    );
  }

  return editorElement;
}

// --------------------------------------------------------------------------
// Skeleton Loading State
// --------------------------------------------------------------------------

/**
 * Skeleton loading state for the KB document editor.
 */
export function KBDocumentEditorSkeleton({
  showToc = true,
  className,
}: {
  showToc?: boolean;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn("flex flex-col h-full", className)} data-slot="kb-document-editor-skeleton">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-5 w-16" />
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      {/* Editor skeleton */}
      <div className="flex-1 overflow-hidden">
        <KBEditorSkeleton showToc={showToc} />
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Re-exports
// --------------------------------------------------------------------------

// Main components
export { KBEditor, KBEditorSkeleton } from "./kb-editor";
export type { KBEditorProps, KBEditorLayout } from "./kb-editor";

export { KBPlateProvider, useKBCollaboration, useAwareness, useConnectionState } from "./kb-plate-provider";
export type {
  KBPlateProviderProps,
  KBCollaborationContextValue,
  AwarenessContextValue,
  AwarenessUser,
  CollaborationConnectionStatus,
  ConnectionState,
} from "./kb-plate-provider";

export { KBToolbar } from "./kb-toolbar";

export { TocSidebar, TocSidebarSkeleton, useTocHeadings } from "./toc-sidebar";
export type { TocHeading, TocSidebarProps } from "./toc-sidebar";

// KB Editor Kit
export {
  kbEditorKit,
  kbEditorKitWithoutFixedToolbar,
  kbEditorKitReadOnly,
  kbEditorKitNoComments,
  KBEmbedKit,
  CourseEmbedPlugin,
  LessonEmbedPlugin,
  COURSE_EMBED_KEY,
  LESSON_EMBED_KEY,
  createKBEditorKit,
  createCourseEmbedElement,
  createLessonEmbedElement,
  isCourseEmbed,
  isLessonEmbed,
} from "./kb-editor-kit";
export type {
  KBEditorKitOptions,
  CourseEmbedElement,
  LessonEmbedElement,
} from "./kb-editor-kit";

// Block embeds
export {
  CourseEmbed,
  CourseEmbedSkeleton,
  CourseEmbedError,
  LessonEmbed,
  LessonEmbedSkeleton,
  LessonEmbedError,
} from "./blocks";
