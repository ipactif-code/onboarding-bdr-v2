"use client";

import * as React from "react";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { AlertTriangle, ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Document {
  _id: Id<"kbDocuments">;
  title: string;
  content?: unknown;
  icon?: string;
}

interface BreadcrumbItem {
  id: string;
  title: string;
  type: "workspace" | "folder" | "document";
}

interface DocumentEditorClientProps {
  documentId: Id<"kbDocuments">;
  initialDocument: Document;
  breadcrumbs: BreadcrumbItem[];
}

/**
 * Temporary placeholder for the Knowledge Base Document Editor.
 *
 * This component is displayed while the Potion editor is being installed.
 * It shows document metadata and a placeholder message.
 *
 * TODO: Replace with Potion-based KB editor once installed
 */
export function DocumentEditorClient({
  initialDocument,
  breadcrumbs,
}: DocumentEditorClientProps): React.ReactElement {
  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 px-4 py-2 text-sm text-muted-foreground border-b">
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
              {crumb.title}
            </Link>
          </React.Fragment>
        ))}
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

      {/* Placeholder Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="size-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-semibold">Editor Not Available</h2>
          <p className="text-muted-foreground">
            The Knowledge Base editor is being upgraded to use the Potion editor.
            Document editing will be available once the installation is complete.
          </p>
          <div className="pt-4">
            <Link
              href="/knowledge"
              className="text-primary hover:underline"
            >
              ← Back to Knowledge Base
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentEditorClient;
