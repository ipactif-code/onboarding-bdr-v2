"use client";

import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

/**
 * Document status from the schema.
 */
type DocumentStatus = "draft" | "published" | "archived";

/**
 * Document metadata from the API.
 */
export interface DocumentMetadata {
  _id: Id<"kbDocuments">;
  _creationTime: number;
  title: string;
  folderId: Id<"kbFolders">;
  icon?: string;
  coverImageId?: Id<"_storage">;
  creatorId: Id<"users">;
  status: DocumentStatus;
  publishedAt?: number;
  displayOrder: number;
  wordCount?: number;
  lastEditedBy?: Id<"users">;
  archivedAt?: number;
  archivedBy?: Id<"users">;
  permanentDeleteAt?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Document content from the API.
 */
export interface DocumentContent {
  documentId: Id<"kbDocuments">;
  content: unknown[];
  contentText?: string;
  contentSize: number;
  updatedAt: number;
}

/**
 * Options for the useDocument hook.
 */
export interface UseDocumentOptions {
  /** The document ID to fetch and manage */
  documentId: Id<"kbDocuments">;
}

/**
 * Return type for the useDocument hook.
 */
export interface UseDocumentReturn {
  /** Document metadata (undefined = loading, null = not found or no access) */
  document: DocumentMetadata | null | undefined;
  /** Document content (undefined = loading, null = not found) */
  content: unknown[] | undefined;
  /** Whether document or content is loading */
  isLoading: boolean;
  /** Error from the last operation */
  error: Error | null;

  // Mutations
  /** Update the document title */
  updateTitle: (title: string) => Promise<void>;
  /** Update the document content */
  updateContent: (content: unknown[]) => Promise<void>;
  /** Publish the document (draft -> published) */
  publish: () => Promise<void>;
  /** Unpublish the document (published -> draft) */
  unpublish: () => Promise<void>;
  /** Archive the document (soft delete) */
  archive: () => Promise<void>;
  /** Restore an archived document */
  restore: () => Promise<void>;
  /** Update the document icon */
  updateIcon: (icon: string) => Promise<void>;

  // Computed properties
  /** Whether the user can edit this document */
  canEdit: boolean;
  /** Whether the document is published */
  isPublished: boolean;
  /** Whether the document is a draft */
  isDraft: boolean;
  /** Whether the document is archived */
  isArchived: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Document management hook for Knowledge Base.
 *
 * Provides:
 * - Real-time document metadata and content subscriptions
 * - Mutation wrappers with toast notifications
 * - Computed state properties (canEdit, isPublished, etc.)
 *
 * @param options - Configuration options
 * @returns Document data, mutations, and computed properties
 *
 * @example
 * ```tsx
 * const {
 *   document,
 *   content,
 *   isLoading,
 *   updateTitle,
 *   updateContent,
 *   publish,
 *   isPublished,
 *   canEdit,
 * } = useDocument({ documentId: params.documentId });
 *
 * if (isLoading) return <Skeleton />;
 * if (!document) return <NotFound />;
 *
 * return (
 *   <Editor
 *     title={document.title}
 *     content={content}
 *     onTitleChange={updateTitle}
 *     onContentChange={updateContent}
 *     readOnly={!canEdit}
 *   />
 * );
 * ```
 */
export function useDocument(options: UseDocumentOptions): UseDocumentReturn {
  const { documentId } = options;

  // ============================================================================
  // Queries
  // ============================================================================

  // Subscribe to document metadata
  const document = useQuery(api.knowledge.documents.get, { id: documentId });

  // Subscribe to document content separately (for performance)
  const contentResult = useQuery(api.knowledge.documents.getContent, {
    documentId,
  });

  // ============================================================================
  // Mutations
  // ============================================================================

  const updateMutation = useMutation(api.knowledge.documents.update);
  const updateContentMutation = useMutation(api.knowledge.documents.updateContent);
  const publishMutation = useMutation(api.knowledge.documents.publish);
  const unpublishMutation = useMutation(api.knowledge.documents.unpublish);
  const archiveMutation = useMutation(api.knowledge.documents.archive);
  const restoreMutation = useMutation(api.knowledge.documents.restore);

  // ============================================================================
  // Mutation Handlers
  // ============================================================================

  /**
   * Update the document title.
   */
  const updateTitle = useCallback(
    async (title: string): Promise<void> => {
      try {
        await updateMutation({ id: documentId, title });
        toast.success("Title updated");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update title";
        toast.error(message);
        throw error;
      }
    },
    [documentId, updateMutation]
  );

  /**
   * Update the document icon.
   */
  const updateIcon = useCallback(
    async (icon: string): Promise<void> => {
      try {
        await updateMutation({ id: documentId, icon });
        toast.success("Icon updated");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update icon";
        toast.error(message);
        throw error;
      }
    },
    [documentId, updateMutation]
  );

  /**
   * Update the document content.
   */
  const updateContent = useCallback(
    async (content: unknown[]): Promise<void> => {
      try {
        await updateContentMutation({ documentId, content });
        // Don't show toast for content updates (handled by auto-save)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save content";
        toast.error(message);
        throw error;
      }
    },
    [documentId, updateContentMutation]
  );

  /**
   * Publish the document (draft -> published).
   */
  const publish = useCallback(async (): Promise<void> => {
    try {
      await publishMutation({ id: documentId });
      toast.success("Document published");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to publish document";
      toast.error(message);
      throw error;
    }
  }, [documentId, publishMutation]);

  /**
   * Unpublish the document (published -> draft).
   */
  const unpublish = useCallback(async (): Promise<void> => {
    try {
      await unpublishMutation({ id: documentId });
      toast.success("Document unpublished");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to unpublish document";
      toast.error(message);
      throw error;
    }
  }, [documentId, unpublishMutation]);

  /**
   * Archive the document (soft delete).
   */
  const archive = useCallback(async (): Promise<void> => {
    try {
      await archiveMutation({ id: documentId });
      toast.success("Document archived");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to archive document";
      toast.error(message);
      throw error;
    }
  }, [documentId, archiveMutation]);

  /**
   * Restore an archived document.
   */
  const restore = useCallback(async (): Promise<void> => {
    try {
      await restoreMutation({ id: documentId });
      toast.success("Document restored");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to restore document";
      toast.error(message);
      throw error;
    }
  }, [documentId, restoreMutation]);

  // ============================================================================
  // Computed Properties
  // ============================================================================

  // Loading state - either metadata or content is loading
  const isLoading = document === undefined || contentResult === undefined;

  // Document exists and is accessible - user can edit
  // Note: More granular permission check could be added via getEffectivePermission query
  const canEdit = document !== null && document !== undefined;

  // Status-based computed properties
  const isPublished = document?.status === "published";
  const isDraft = document?.status === "draft";
  const isArchived = document?.status === "archived";

  // Extract content array from result
  const content = contentResult?.content as unknown[] | undefined;

  return {
    document,
    content,
    isLoading,
    error: null, // Errors are handled via toast in mutations

    // Mutations
    updateTitle,
    updateContent,
    publish,
    unpublish,
    archive,
    restore,
    updateIcon,

    // Computed
    canEdit,
    isPublished,
    isDraft,
    isArchived,
  };
}
