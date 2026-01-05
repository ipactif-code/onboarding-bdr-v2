"use client";

import * as React from "react";
import { useState } from "react";
import { type Value } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";
import { useQuery, useMutation } from "convex/react";
import { Id } from "../../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../../convex/_generated/api").api;
import { ChevronRight, Home, Save, Loader2, Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useDebouncedCallback } from "@/hooks/use-debounce-callback";
import { EditorKit } from "@/components/editor/editor-kit";
import { Editor, EditorContainer } from "@/components/plate-ui/editor";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
// Save Status Indicator
// ============================================================================

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveStatusIndicator({ status }: { status: SaveStatus }): React.ReactElement | null {
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
// Editor Component (Internal)
// ============================================================================

interface EditorContentProps {
  documentId: Id<"kbDocuments">;
  initialValue: Value;
  onSaveStatusChange: (status: SaveStatus) => void;
}

function EditorContent({
  documentId,
  initialValue,
  onSaveStatusChange,
}: EditorContentProps): React.ReactElement {
  const updateContent = useMutation(api.knowledge.documents.updateContent);

  // Use a separate key state to force editor remount when content changes
  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue,
  });

  // Debounced save handler
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
        }, 2000);
      } catch (error) {
        console.error("Failed to save document:", error);
        onSaveStatusChange("error");
        toast.error("Failed to save document");
      }
    },
    500,
    { maxWait: 2000 }
  );

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => {
        debouncedSave(value);
      }}
    >
      <EditorContainer className="flex-1 overflow-auto">
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
// Main Component
// ============================================================================

/**
 * Knowledge Base Document Editor with Potion (Plate.js) integration.
 *
 * Features:
 * - Real-time content loading from Convex
 * - Auto-save with debouncing (500ms delay, 2s max wait)
 * - Save status indicator
 * - Plain text extraction for search indexing
 * - Word count tracking
 */
export function DocumentEditorClient({
  documentId,
  initialDocument,
  breadcrumbs,
}: DocumentEditorClientProps): React.ReactElement {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Fetch document content (separate from metadata for performance)
  const contentData = useQuery(api.knowledge.documents.getContent, {
    documentId,
  });

  // Determine initial value for editor
  const initialValue: Value = React.useMemo(() => {
    if (contentData?.content && Array.isArray(contentData.content)) {
      return contentData.content as Value;
    }
    // Default empty paragraph
    return [{ type: "p", children: [{ text: "" }] }] as Value;
  }, [contentData?.content]);

  // Show loading skeleton while fetching content
  if (contentData === undefined) {
    return <DocumentEditorSkeleton />;
  }

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
                  index === breadcrumbs.length - 1 && "text-foreground font-medium"
                )}
              >
                {crumb.title || crumb.name}
              </Link>
            </React.Fragment>
          ))}
        </div>

        {/* Save status indicator */}
        <SaveStatusIndicator status={saveStatus} />
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

      {/* Plate Editor */}
      <div className="flex-1 overflow-hidden">
        <EditorContent
          key={documentId}
          documentId={documentId}
          initialValue={initialValue}
          onSaveStatusChange={setSaveStatus}
        />
      </div>
    </div>
  );
}

export default DocumentEditorClient;
