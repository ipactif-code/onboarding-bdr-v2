"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { parseContent } from "@/components/messaging/rich-text-renderer-utils";

export interface RichTextRendererProps {
  content: unknown;
  className?: string;
  /** Current user's name for mention highlighting */
  currentUserName?: string;
}

/**
 * Temporary simplified rich text renderer.
 *
 * This component extracts and displays plain text from Slate/Plate JSON content
 * while the rich text editor is being upgraded.
 *
 * TODO: Enhance with proper rich text formatting support
 */
export function RichTextRenderer({
  content,
  className,
}: RichTextRendererProps): React.ReactElement {
  const textContent = React.useMemo(() => {
    if (!content) return "";

    // If content is a string, try to parse it as Plate.js JSON first
    if (typeof content === "string") {
      const parsed = parseContent(content);
      if (parsed) {
        return extractTextFromSlateContent(parsed);
      }
      // Not valid JSON, return as plain text
      return content;
    }

    // Already an array (parsed Plate.js content)
    if (Array.isArray(content)) {
      return extractTextFromSlateContent(content);
    }

    return "";
  }, [content]);

  if (!textContent) {
    return (
      <span className={cn("text-muted-foreground italic", className)}>
        No content
      </span>
    );
  }

  return (
    <div className={cn("whitespace-pre-wrap break-words", className)}>
      {textContent}
    </div>
  );
}

/**
 * Extract plain text from Slate/Plate JSON content.
 */
function extractTextFromSlateContent(nodes: unknown[]): string {
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
      // Add line break after block-level elements
      if (n.type && typeof n.type === "string") {
        const blockTypes = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li"];
        if (blockTypes.includes(n.type)) {
          texts.push("\n");
        }
      }
    }
  }

  for (const node of nodes) {
    walk(node);
  }

  return texts.join("").trim();
}

export default RichTextRenderer;
