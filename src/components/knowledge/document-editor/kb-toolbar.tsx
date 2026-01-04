"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import type { Id } from "../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../convex/_generated/api").api;
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import {
  Globe,
  GlobeLock,
  History,
  Loader2,
  Save,
  Share2,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-plate/tooltip";

/**
 * Document metadata type matching the Convex query return type.
 */
interface DocumentMetadata {
  _id: Id<"kbDocuments">;
  _creationTime: number;
  title: string;
  folderId: Id<"kbFolders">;
  icon?: string;
  coverImageId?: Id<"_storage">;
  creatorId: Id<"users">;
  status: "draft" | "published" | "archived";
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
 * Props for the KBToolbar component.
 */
interface KBToolbarProps {
  /** The document ID */
  documentId: Id<"kbDocuments">;
  /** Document metadata */
  document: DocumentMetadata;
  /** Callback when save button is clicked */
  onSave: () => Promise<void>;
  /** Whether the document is in read-only mode */
  readOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Knowledge Base Toolbar.
 *
 * Provides KB-specific actions:
 * - Publish/Unpublish button
 * - Version history link
 * - Share button (opens permission dialog)
 * - Document info (word count, last edited)
 *
 * @example
 * ```tsx
 * <KBToolbar
 *   documentId={doc._id}
 *   document={doc}
 *   onSave={handleSave}
 * />
 * ```
 */
export function KBToolbar({
  documentId,
  document,
  onSave,
  readOnly = false,
  className,
}: KBToolbarProps): React.ReactElement {
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);

  // Mutations
  const publishMutation = useMutation(api.knowledge.documents.publish);
  const unpublishMutation = useMutation(api.knowledge.documents.unpublish);

  // Handle save
  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  // Handle publish/unpublish
  const handlePublishToggle = async (): Promise<void> => {
    setIsPublishing(true);
    try {
      if (document.status === "published") {
        await unpublishMutation({ id: documentId });
        toast.success("Document unpublished");
      } else {
        await publishMutation({ id: documentId });
        toast.success("Document published");
      }
    } catch (error) {
      console.error("Failed to update publish status:", error);
      toast.error(
        document.status === "published"
          ? "Failed to unpublish document"
          : "Failed to publish document"
      );
    } finally {
      setIsPublishing(false);
    }
  };

  // Format last edited time
  const lastEditedText = React.useMemo(() => {
    const date = new Date(document.updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }, [document.updatedAt]);

  // Format word count
  const wordCountText = React.useMemo(() => {
    const count = document.wordCount ?? 0;
    if (count === 0) return "0 words";
    if (count === 1) return "1 word";
    return `${count.toLocaleString()} words`;
  }, [document.wordCount]);

  const isPublished = document.status === "published";
  const isArchived = document.status === "archived";

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      {/* Document icon and title */}
      <div className="flex items-center gap-2 min-w-0">
        {document.icon ? (
          <span className="text-lg">{document.icon}</span>
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-medium truncate max-w-[200px]">
          {document.title}
        </span>
      </div>

      {/* Status badge */}
      <Badge
        variant={isPublished ? "default" : isArchived ? "destructive" : "secondary"}
      >
        {isPublished ? "Published" : isArchived ? "Archived" : "Draft"}
      </Badge>

      <div className="flex-1" />

      {/* Document info */}
      <div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground">
        <span>{wordCountText}</span>
        <Separator orientation="vertical" className="h-4" />
        <span>Edited {lastEditedText}</span>
      </div>

      <Separator orientation="vertical" className="h-6 hidden md:block" />

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Save button */}
        {!readOnly && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save document</TooltipContent>
          </Tooltip>
        )}

        {/* Version history link */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              render={<Link href={`/knowledge/documents/${documentId}/history`} />}
            >
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Version history</TooltipContent>
        </Tooltip>

        {/* Share button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              render={<Link href={`/knowledge/documents/${documentId}/share`} />}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share document</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Publish/Unpublish button */}
        {!readOnly && !isArchived && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isPublished ? "ghost" : "default"}
                size="sm"
                onClick={handlePublishToggle}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPublished ? (
                  <>
                    <GlobeLock className="h-4 w-4" data-icon="inline-start" />
                    Unpublish
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" data-icon="inline-start" />
                    Publish
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isPublished
                ? "Unpublish document (make it draft)"
                : "Publish document (make it visible)"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
