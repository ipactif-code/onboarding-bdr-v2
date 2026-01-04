"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface PlateEditorProps {
  value?: unknown[];
  onChange?: (value: unknown[]) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
}

/**
 * Temporary placeholder for PlateEditor.
 *
 * This component is used while the editor is being reinstalled.
 * Replace this with the actual Potion editor once it's set up.
 *
 * TODO: Replace with actual Potion editor from plate-plus/potion
 */
export function PlateEditor({
  className,
  placeholder = "Editor content will appear here...",
}: PlateEditorProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-8 bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-lg min-h-[200px]",
        className
      )}
    >
      <AlertTriangle className="size-8 text-amber-500" />
      <div className="text-center space-y-2">
        <h3 className="font-semibold text-foreground">Editor Not Available</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          The rich text editor is being upgraded. Content editing will be available once the Potion editor is installed.
        </p>
        <p className="text-xs text-muted-foreground italic">
          {placeholder}
        </p>
      </div>
    </div>
  );
}

interface ContentRendererProps {
  value?: unknown[];
  className?: string;
}

/**
 * Temporary placeholder for ContentRenderer.
 *
 * This component is used while the editor is being reinstalled.
 * Replace this with the actual Potion content renderer once it's set up.
 *
 * TODO: Replace with actual Potion content renderer
 */
export function ContentRenderer({
  value,
  className,
}: ContentRendererProps): React.ReactElement {
  // If no content, show placeholder
  if (!value || !Array.isArray(value) || value.length === 0) {
    return (
      <div className={cn("text-muted-foreground italic", className)}>
        No content to display.
      </div>
    );
  }

  // Attempt to extract text content from the value
  const textContent = extractTextContent(value);

  if (!textContent) {
    return (
      <div className={cn("text-muted-foreground italic", className)}>
        Content available (editor renderer pending).
      </div>
    );
  }

  return (
    <div className={cn("prose prose-neutral max-w-none", className)}>
      {textContent.split("\n\n").map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

/**
 * Extract plain text content from Slate/Plate value.
 */
function extractTextContent(nodes: unknown[]): string {
  const texts: string[] = [];

  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;

    const n = node as Record<string, unknown>;

    // If it's a text node, extract the text
    if (typeof n.text === "string") {
      texts.push(n.text);
      return;
    }

    // If it has children, walk them
    if (Array.isArray(n.children)) {
      for (const child of n.children) {
        walk(child);
      }
      // Add paragraph break after block-level elements
      if (n.type && typeof n.type === "string" && ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"].includes(n.type)) {
        texts.push("\n\n");
      }
    }
  }

  for (const node of nodes) {
    walk(node);
  }

  return texts.join("").trim();
}
