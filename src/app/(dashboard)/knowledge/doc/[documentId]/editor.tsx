"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { useDocument, useAutoSave } from "@/hooks/knowledge";
import type { DocumentMetadata } from "@/hooks/knowledge";
import { KBDocumentEditor } from "@/components/knowledge/document-editor";
import { toast } from "sonner";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Icons
import {
  ArrowLeftIcon,
  CheckIcon,
  CloudIcon,
  FileTextIcon,
  FolderIcon,
  HomeIcon,
  Loader2Icon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  GlobeIcon,
  EyeOffIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface BreadcrumbItemData {
  type: "workspace" | "folder" | "document";
  id: string;
  name: string;
}

interface DocumentEditorClientProps {
  /** The KB document ID to edit */
  documentId: Id<"kbDocuments">;
  /** Initial document metadata from server */
  initialDocument: DocumentMetadata;
  /** Breadcrumb navigation path */
  breadcrumbs: BreadcrumbItemData[];
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({
  status,
}: {
  status: "draft" | "published" | "archived";
}): React.ReactElement {
  const variants: Record<typeof status, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }> = {
    draft: {
      variant: "outline",
      label: "Draft",
      icon: <FileTextIcon className="size-3" />,
    },
    published: {
      variant: "default",
      label: "Published",
      icon: <GlobeIcon className="size-3" />,
    },
    archived: {
      variant: "destructive",
      label: "Archived",
      icon: <ArchiveIcon className="size-3" />,
    },
  };

  const config = variants[status];

  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

// ============================================================================
// Save Status Indicator
// ============================================================================

function SaveStatusIndicator({
  isSaving,
  hasPendingChanges,
  lastSaved,
}: {
  isSaving: boolean;
  hasPendingChanges: boolean;
  lastSaved: Date | null;
}): React.ReactElement {
  if (isSaving) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" />
        <span>Saving...</span>
      </div>
    );
  }

  if (hasPendingChanges) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CloudIcon className="size-3.5" />
        <span>Unsaved changes</span>
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CheckIcon className="size-3.5 text-green-600" />
        <span>Saved {formatRelativeTime(lastSaved)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <CloudIcon className="size-3.5" />
      <span>All changes saved</span>
    </div>
  );
}

/**
 * Format a date as relative time (e.g., "just now", "2 min ago").
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffSeconds < 10) {
    return "just now";
  }
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  return date.toLocaleTimeString();
}

// ============================================================================
// Document Header
// ============================================================================

interface DocumentHeaderProps {
  document: DocumentMetadata;
  breadcrumbs: BreadcrumbItemData[];
  isSaving: boolean;
  hasPendingChanges: boolean;
  lastSaved: Date | null;
  onPublish: () => Promise<void>;
  onUnpublish: () => Promise<void>;
  onArchive: () => Promise<void>;
  onRestore: () => Promise<void>;
  isActionPending: boolean;
}

function DocumentHeader({
  document,
  breadcrumbs,
  isSaving,
  hasPendingChanges,
  lastSaved,
  onPublish,
  onUnpublish,
  onArchive,
  onRestore,
  isActionPending,
}: DocumentHeaderProps): React.ReactElement {
  const router = useRouter();

  // Handle back navigation
  const handleBack = (): void => {
    // Navigate to parent folder if available
    const folderBreadcrumb = breadcrumbs.find((b) => b.type === "folder");
    if (folderBreadcrumb) {
      router.push(`/knowledge?folder=${folderBreadcrumb.id}`);
    } else {
      router.push("/knowledge");
    }
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Breadcrumbs Row */}
      <div className="flex items-center gap-3 px-4 py-2 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-1.5"
        >
          <ArrowLeftIcon className="size-4" />
          <span className="sr-only sm:not-sr-only">Back</span>
        </Button>

        <div className="h-4 w-px bg-border" aria-hidden="true" />

        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {item.type === "document" ? (
                    <BreadcrumbPage className="flex items-center gap-1.5">
                      <FileTextIcon className="size-3.5" />
                      <span className="max-w-[200px] truncate">
                        {item.name}
                      </span>
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      render={
                        <Link
                          href={
                            item.type === "workspace"
                              ? "/knowledge"
                              : `/knowledge?folder=${item.id}`
                          }
                        />
                      }
                      className="flex items-center gap-1.5"
                    >
                      {item.type === "workspace" ? (
                        <HomeIcon className="size-3.5" />
                      ) : (
                        <FolderIcon className="size-3.5" />
                      )}
                      <span className="max-w-[150px] truncate">{item.name}</span>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Document Info Row */}
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Document Icon */}
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-xl">
            {document.icon || <FileTextIcon className="size-5 text-muted-foreground" />}
          </div>

          {/* Document Title and Status */}
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold leading-none">
              {document.title}
            </h1>
            <div className="flex items-center gap-2">
              <StatusBadge status={document.status} />
              <span className="text-xs text-muted-foreground">
                {document.wordCount
                  ? `${document.wordCount.toLocaleString()} words`
                  : "No content yet"}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Save Status */}
          <SaveStatusIndicator
            isSaving={isSaving}
            hasPendingChanges={hasPendingChanges}
            lastSaved={lastSaved}
          />

          <div className="h-4 w-px bg-border" aria-hidden="true" />

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Publish/Unpublish */}
            {document.status === "draft" && (
              <Button
                variant="default"
                size="sm"
                onClick={onPublish}
                disabled={isActionPending}
                className="gap-1.5"
                title="Make this document visible to all users"
              >
                {isActionPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <GlobeIcon className="size-4" />
                )}
                Publish
              </Button>
            )}

            {document.status === "published" && (
              <Button
                variant="outline"
                size="sm"
                onClick={onUnpublish}
                disabled={isActionPending}
                className="gap-1.5"
                title="Revert to draft status"
              >
                {isActionPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <EyeOffIcon className="size-4" />
                )}
                Unpublish
              </Button>
            )}

            {/* Archive/Restore */}
            {document.status === "archived" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onRestore}
                disabled={isActionPending}
                className="gap-1.5"
                title="Restore this document from archive"
              >
                {isActionPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <ArchiveRestoreIcon className="size-4" />
                )}
                Restore
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onArchive}
                disabled={isActionPending}
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                title="Move to archive (can be restored)"
              >
                {isActionPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <ArchiveIcon className="size-4" />
                )}
                <span className="sr-only sm:not-sr-only">Archive</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// Document Editor Client Component
// ============================================================================

/**
 * Client-side document editor component.
 *
 * Provides:
 * - Real-time document editing with Plate.js
 * - Auto-save functionality with debouncing
 * - Publish/Unpublish/Archive actions
 * - Breadcrumb navigation
 * - Save status indicators
 *
 * @example
 * ```tsx
 * <DocumentEditorClient
 *   documentId={documentId}
 *   initialDocument={document}
 *   breadcrumbs={breadcrumbs}
 * />
 * ```
 */
export function DocumentEditorClient({
  documentId,
  initialDocument,
  breadcrumbs,
}: DocumentEditorClientProps): React.ReactElement {
  const router = useRouter();
  const [isActionPending, setIsActionPending] = React.useState(false);

  // Document hook for real-time updates and mutations
  const {
    document,
    isLoading,
    publish,
    unpublish,
    archive,
    restore,
    isArchived,
  } = useDocument({ documentId });

  // Auto-save hook for debounced content saving
  const {
    save: autoSave,
    forceSave,
    isSaving,
    hasPendingChanges,
    lastSaved,
  } = useAutoSave({
    documentId,
    delay: 3000, // 3 second debounce for auto-save
    enabled: !isArchived, // Disable auto-save for archived documents
  });

  // Use real-time document data, falling back to initial data
  const currentDocument = document ?? initialDocument;

  // Handle content changes - trigger auto-save
  const handleContentSave = React.useCallback(
    async (content: unknown[]): Promise<void> => {
      autoSave(content);
    },
    [autoSave]
  );

  // Handle publish action
  const handlePublish = React.useCallback(async (): Promise<void> => {
    try {
      setIsActionPending(true);
      // Force save any pending changes before publishing
      await forceSave();
      await publish();
    } catch (error) {
      // Error already handled by hook with toast
      console.error("Publish failed:", error);
    } finally {
      setIsActionPending(false);
    }
  }, [forceSave, publish]);

  // Handle unpublish action
  const handleUnpublish = React.useCallback(async (): Promise<void> => {
    try {
      setIsActionPending(true);
      await unpublish();
    } catch (error) {
      console.error("Unpublish failed:", error);
    } finally {
      setIsActionPending(false);
    }
  }, [unpublish]);

  // Handle archive action
  const handleArchive = React.useCallback(async (): Promise<void> => {
    try {
      setIsActionPending(true);
      // Force save before archiving
      await forceSave();
      await archive();
      // Navigate back to folder after archiving
      toast.info("Navigating back to folder...");
      router.push("/knowledge");
    } catch (error) {
      console.error("Archive failed:", error);
    } finally {
      setIsActionPending(false);
    }
  }, [forceSave, archive, router]);

  // Handle restore action
  const handleRestore = React.useCallback(async (): Promise<void> => {
    try {
      setIsActionPending(true);
      await restore();
    } catch (error) {
      console.error("Restore failed:", error);
    } finally {
      setIsActionPending(false);
    }
  }, [restore]);

  // Show loading state if document is loading and no initial data
  if (isLoading && !currentDocument) {
    return <DocumentEditorSkeleton />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Document Header with breadcrumbs and actions */}
      <DocumentHeader
        document={currentDocument}
        breadcrumbs={breadcrumbs}
        isSaving={isSaving}
        hasPendingChanges={hasPendingChanges}
        lastSaved={lastSaved}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onArchive={handleArchive}
        onRestore={handleRestore}
        isActionPending={isActionPending}
      />

      {/* Archived Banner */}
      {currentDocument.status === "archived" && (
        <div className="flex items-center gap-2 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <ArchiveIcon className="size-4" />
          <span>
            This document is archived. You can view it but cannot edit.
            <button
              onClick={handleRestore}
              disabled={isActionPending}
              className="ml-2 font-medium underline hover:no-underline"
            >
              Restore it
            </button>
            to make changes.
          </span>
        </div>
      )}

      {/* Editor */}
      <main className="flex-1 overflow-hidden">
        <KBDocumentEditor
          documentId={documentId}
          onSave={handleContentSave}
          readOnly={currentDocument.status === "archived"}
          className="h-full"
        />
      </main>
    </div>
  );
}

// ============================================================================
// Skeleton Loading State
// ============================================================================

/**
 * Full-page skeleton for document editor loading state.
 */
function DocumentEditorSkeleton(): React.ReactElement {
  return (
    <div className="flex h-full flex-col">
      {/* Header Skeleton */}
      <div className="border-b bg-background">
        {/* Breadcrumbs Row */}
        <div className="flex items-center gap-3 px-4 py-2 border-b">
          <Skeleton className="h-8 w-16" />
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Document Info Row */}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <div className="h-4 w-px bg-border" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </div>

      {/* Editor Skeleton */}
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="h-6" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

export { DocumentEditorSkeleton };
