"use client";

/**
 * RichTextRenderer - Read-only renderer for Plate.js rich text content.
 *
 * Renders formatted message content with support for:
 * - Bold, Italic, Underline, Strikethrough, Code marks
 * - Code blocks with syntax highlighting
 * - Links (clickable, XSS-safe)
 * - Lists (ordered and unordered) with compact spacing
 * - Mentions (@username display)
 * - Link previews (optional)
 */

import * as React from "react";

import { createSlateEditor } from "platejs";
import { PlateStatic } from "platejs/static";

import {
  BaseBoldPlugin,
  BaseCodePlugin,
  BaseItalicPlugin,
  BaseStrikethroughPlugin,
  BaseUnderlinePlugin,
} from "@platejs/basic-nodes";
import {
  BaseCodeBlockPlugin,
  BaseCodeLinePlugin,
  BaseCodeSyntaxPlugin,
} from "@platejs/code-block";
import { BaseIndentPlugin } from "@platejs/indent";
import { BaseLinkPlugin } from "@platejs/link";
import { BaseListPlugin } from "@platejs/list";
import { BaseMentionPlugin } from "@platejs/mention";
import { all, createLowlight } from "lowlight";
import { BaseParagraphPlugin, KEYS } from "platejs";

import { BlockListStatic } from "@/components/ui/block-list-static";
import {
  MessageCodeBlockStatic,
  MessageCodeLineStatic,
  MessageCodeSyntaxLeafStatic,
} from "@/components/messaging/code-block-message";
import {
  LinkPreviewList,
  type LinkMetadata,
} from "@/components/messaging/link-preview";
import {
  MentionContextProvider,
  MessageParagraphStatic,
  MessageLinkStatic,
  MessageMentionStatic,
  MessageCodeStatic,
} from "@/components/messaging/rich-text-static-components";
import {
  parseContent,
  textToPlateValue,
  extractLinkUrls,
  MAX_LINK_PREVIEWS,
} from "@/components/messaging/rich-text-renderer-utils";

import { cn } from "@/lib/utils";

// Re-export LinkMetadata for consumers of RichTextRenderer
export type { LinkMetadata } from "@/components/messaging/link-preview";

// ============================================================================
// Lowlight Instance (for syntax highlighting)
// ============================================================================

/**
 * Lowlight instance with all languages registered.
 * Used by the code block plugin for syntax highlighting.
 */
const lowlight = createLowlight(all);

// ============================================================================
// Minimal Plugins for Message Rendering
// ============================================================================

/**
 * Minimal set of plugins for rendering message content.
 * Excludes interactive/heavy plugins not needed for read-only display.
 */
const messageRenderPlugins = [
  // Basic structure
  BaseParagraphPlugin.withComponent(MessageParagraphStatic),

  // Basic marks (bold, italic, etc.)
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseStrikethroughPlugin,
  BaseCodePlugin.withComponent(MessageCodeStatic),

  // Links
  BaseLinkPlugin.withComponent(MessageLinkStatic),

  // Mentions
  BaseMentionPlugin.withComponent(MessageMentionStatic),

  // Code blocks with syntax highlighting
  BaseCodeBlockPlugin.configure({
    node: { component: MessageCodeBlockStatic },
    options: { lowlight },
  }),
  BaseCodeLinePlugin.withComponent(MessageCodeLineStatic),
  BaseCodeSyntaxPlugin.withComponent(MessageCodeSyntaxLeafStatic),

  // Indent plugin (required for list indentation)
  BaseIndentPlugin.configure({
    inject: {
      targetPlugins: [KEYS.p],
    },
  }),

  // Lists (ordered and unordered) with compact static rendering
  BaseListPlugin.configure({
    inject: {
      targetPlugins: [KEYS.p],
    },
    render: {
      belowNodes: BlockListStatic,
    },
  }),
];

// ============================================================================
// Types
// ============================================================================

export interface RichTextRendererProps {
  /**
   * The content to render.
   * Can be a serialized JSON string from Plate.js or raw text.
   */
  content: string;
  /**
   * Additional CSS classes to apply to the container.
   */
  className?: string;
  /**
   * The current user's display name for highlighting their mentions.
   * When provided, @mentions of the current user will be highlighted differently
   * (amber background) compared to other mentions (blue text).
   */
  currentUserName?: string;
  /**
   * Whether to show link previews below the message content.
   * When enabled, detects links in the content and renders preview cards.
   * @default false
   */
  showLinkPreviews?: boolean;
  /**
   * Pre-fetched link metadata map (URL -> metadata).
   * Used for caching link preview data.
   */
  linkMetadataMap?: Map<string, LinkMetadata | null>;
  /**
   * Set of URLs that are currently being fetched.
   */
  loadingLinkUrls?: Set<string>;
  /**
   * Callback when links are detected in the content.
   * Can be used to trigger metadata fetching.
   */
  onLinksDetected?: (urls: string[]) => void;
}

// ============================================================================
// RichTextRenderer Component
// ============================================================================

/**
 * Renders formatted message content in read-only mode.
 *
 * Supports:
 * - Bold, Italic, Underline, Strikethrough, Code marks
 * - Code blocks with syntax highlighting
 * - Links (clickable, opens in new tab, XSS-safe)
 * - Lists (ordered and unordered) with compact spacing
 * - Nested lists with proper indentation
 * - Mentions (@username display)
 * - Link previews (optional, shows title/description/thumbnail for URLs)
 *
 * List rendering uses BlockListStatic for proper marker display and
 * compact vertical spacing suitable for messaging contexts.
 *
 * Gracefully handles:
 * - Empty content
 * - Plain text (non-JSON)
 * - Malformed JSON (falls back to plain text display)
 *
 * @example
 * ```tsx
 * // With Plate.js JSON content
 * <RichTextRenderer content='[{"type":"p","children":[{"text":"Hello "},{"bold":true,"text":"world"}]}]' />
 *
 * // With plain text (auto-converted)
 * <RichTextRenderer content="Hello world" />
 *
 * // With link previews enabled
 * <RichTextRenderer
 *   content='[{"type":"a","url":"https://example.com","children":[{"text":"Link"}]}]'
 *   showLinkPreviews
 *   linkMetadataMap={metadataMap}
 *   loadingLinkUrls={loadingUrls}
 * />
 * ```
 */
export function RichTextRenderer({
  content,
  className,
  currentUserName,
  showLinkPreviews = false,
  linkMetadataMap,
  loadingLinkUrls,
  onLinksDetected,
}: RichTextRendererProps): React.ReactElement {
  // Parse and validate content
  const plateValue = React.useMemo(() => {
    const parsed = parseContent(content);
    if (parsed) {
      return parsed;
    }
    // Fallback to plain text conversion
    return textToPlateValue(content);
  }, [content]);

  // Extract link URLs from content (only when link previews are enabled)
  const linkUrls = React.useMemo(() => {
    if (!showLinkPreviews) return [];
    return extractLinkUrls(plateValue);
  }, [plateValue, showLinkPreviews]);

  // Notify parent of detected links (for metadata fetching)
  React.useEffect(() => {
    if (showLinkPreviews && linkUrls.length > 0 && onLinksDetected) {
      onLinksDetected(linkUrls);
    }
  }, [showLinkPreviews, linkUrls, onLinksDetected]);

  // Create a static editor instance for rendering
  const editor = React.useMemo(() => {
    return createSlateEditor({
      plugins: messageRenderPlugins,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: plateValue as any,
    });
  }, [plateValue]);

  // Handle empty content
  if (!content || content.trim() === "") {
    return (
      <div
        data-slot="rich-text-renderer"
        className={cn("text-sm text-muted-foreground italic", className)}
      >
        No content
      </div>
    );
  }

  return (
    <MentionContextProvider currentUserName={currentUserName}>
      <div data-slot="rich-text-renderer" className={className}>
        {/* Message content */}
        <div
          className={cn(
            // Base styles for message context
            "text-sm leading-relaxed",
            // Compact list rendering (Plate.js uses inline ol/ul wrapper per item)
            // These selectors target the list wrappers created by BlockListStatic
            "[&_ol]:my-0.5 [&_ol]:ml-5 [&_ol]:pl-0",
            "[&_ul]:my-0.5 [&_ul]:ml-5 [&_ul]:pl-0",
            "[&_li]:my-0 [&_li]:py-0 [&_li]:leading-snug",
            // Nested list indentation
            "[&_li_ol]:ml-4 [&_li_ul]:ml-4",
            // Ensure proper list markers display
            "[&_ol>li]:list-decimal [&_ol>li]:list-inside",
            "[&_ul>li]:list-disc [&_ul>li]:list-inside",
            // Mark styles (applied via Slate's default rendering)
            "[&_strong]:font-semibold",
            "[&_em]:italic",
            "[&_u]:underline",
            "[&_s]:line-through"
          )}
        >
          <PlateStatic editor={editor} />
        </div>

        {/* Link previews (shown below message content) */}
        {showLinkPreviews && linkUrls.length > 0 && (
          <LinkPreviewList
            urls={linkUrls}
            metadataMap={linkMetadataMap}
            loadingUrls={loadingLinkUrls}
            maxPreviews={MAX_LINK_PREVIEWS}
          />
        )}
      </div>
    </MentionContextProvider>
  );
}

/**
 * Skeleton component for RichTextRenderer loading state.
 */
export function RichTextRendererSkeleton({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      data-slot="rich-text-renderer-skeleton"
      className={cn("motion-safe:animate-pulse space-y-1", className)}
    >
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-4 w-1/2 rounded bg-muted" />
    </div>
  );
}
