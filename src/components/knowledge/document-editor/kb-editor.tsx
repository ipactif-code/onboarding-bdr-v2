"use client";

import * as React from "react";
import { NodeIdPlugin, type Value } from "platejs";
import type { PlateEditor as PlateEditorInstance } from "platejs/react";
import { Plate, usePlateEditor } from "platejs/react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Editor, EditorContainer } from "@/components/ui/editor";

import { BaseEditorKit } from "@/components/editor/editor-base-kit";
import { BasicMarksKit } from "@/components/editor/plugins/basic-marks-kit";
import { SlashKit } from "@/components/editor/plugins/slash-kit";
import { DndKit } from "@/components/editor/plugins/dnd-kit";
import { BlockMenuKit } from "@/components/editor/plugins/block-menu-kit";
import { AutoformatKit } from "@/components/editor/plugins/autoformat-kit";
import { ExitBreakKit } from "@/components/editor/plugins/exit-break-kit";
import { DiscussionKit } from "@/components/editor/plugins/discussion-kit";
import { FixedToolbarKit } from "@/components/editor/plugins/fixed-toolbar-kit";
import { FloatingToolbarKit } from "@/components/editor/plugins/floating-toolbar-kit";

import { TocSidebar } from "./toc-sidebar";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/**
 * Layout variants for the KB Editor.
 */
export type KBEditorLayout = "default" | "full-width";

/**
 * Props for the KBEditor component.
 */
export interface KBEditorProps {
  /** The KB document ID (for future collaboration/persistence) */
  documentId: string;
  /** Initial editor value (Plate.js JSON) */
  initialValue?: Value;
  /** Callback when editor content changes */
  onChange?: (value: Value) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Layout mode: 'default' (centered) or 'full-width' */
  layout?: KBEditorLayout;
  /** Show table of contents sidebar */
  showToc?: boolean;
  /** Show fixed toolbar at top */
  showToolbar?: boolean;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Auto-focus the editor on mount */
  autoFocus?: boolean;
  /** Additional CSS classes for the root container */
  className?: string;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

/**
 * Default editor value to prevent "Cannot resolve a Slate node from DOM node" errors.
 * Plate.js requires at least one paragraph node with text content for proper DOM-to-Slate mapping.
 */
const DEFAULT_EDITOR_VALUE: Value = [
  { type: "p", children: [{ text: "" }] },
];

/**
 * Returns a valid editor value, falling back to default if undefined or empty.
 */
function getEditorValue(value: Value | undefined): Value {
  return value && value.length > 0 ? value : [...DEFAULT_EDITOR_VALUE];
}

// --------------------------------------------------------------------------
// Plugin Sets
// --------------------------------------------------------------------------

/**
 * Full plugin set with fixed toolbar (for editable mode).
 */
const pluginsWithToolbar = [
  ...BaseEditorKit,
  ...BasicMarksKit,
  ...SlashKit,
  ...DndKit,
  ...BlockMenuKit,
  ...AutoformatKit,
  ...ExitBreakKit,
  ...DiscussionKit,
  ...FixedToolbarKit,
  ...FloatingToolbarKit,
  NodeIdPlugin.configure({ priority: 50 }),
];

/**
 * Plugin set without fixed toolbar (for embedded or minimal mode).
 */
const pluginsWithoutToolbar = [
  ...BaseEditorKit,
  ...BasicMarksKit,
  ...SlashKit,
  ...DndKit,
  ...BlockMenuKit,
  ...AutoformatKit,
  ...ExitBreakKit,
  ...DiscussionKit,
  ...FloatingToolbarKit,
  NodeIdPlugin.configure({ priority: 50 }),
];

// --------------------------------------------------------------------------
// Variants
// --------------------------------------------------------------------------

/**
 * Container variants for the main KB editor wrapper.
 */
const kbEditorContainerVariants = cva(
  "flex h-full w-full overflow-hidden bg-background",
  {
    variants: {
      layout: {
        default: "",
        "full-width": "",
      },
    },
    defaultVariants: {
      layout: "default",
    },
  }
);

/**
 * Editor area variants based on layout mode.
 */
const kbEditorAreaVariants = cva(
  "flex flex-1 flex-col overflow-hidden",
  {
    variants: {
      layout: {
        default: "",
        "full-width": "",
      },
    },
    defaultVariants: {
      layout: "default",
    },
  }
);

/**
 * Content wrapper variants for centering/full-width behavior.
 */
const kbEditorContentVariants = cva(
  "flex-1 overflow-y-auto",
  {
    variants: {
      layout: {
        default: "px-4 sm:px-8 lg:px-12",
        "full-width": "px-4 sm:px-6",
      },
    },
    defaultVariants: {
      layout: "default",
    },
  }
);

/**
 * Inner content max-width constraint for centered layout.
 */
const kbEditorInnerVariants = cva(
  "mx-auto min-h-full",
  {
    variants: {
      layout: {
        default: "max-w-3xl",
        "full-width": "max-w-none w-full",
      },
    },
    defaultVariants: {
      layout: "default",
    },
  }
);

// --------------------------------------------------------------------------
// Inner Editor Component
// --------------------------------------------------------------------------

interface KBEditorInnerProps {
  editor: PlateEditorInstance;
  layout: KBEditorLayout;
  showToc: boolean;
  readOnly: boolean;
  placeholder: string;
  autoFocus: boolean;
  onChange?: (value: Value) => void;
}

/**
 * Inner editor component that has access to the Plate context.
 * Separated to allow hooks that require Plate context.
 */
function KBEditorInner({
  editor,
  layout,
  showToc,
  readOnly,
  placeholder,
  autoFocus,
  onChange,
}: KBEditorInnerProps): React.ReactElement {
  // TOC sidebar state
  const [isTocOpen, setIsTocOpen] = React.useState(true);

  // Handle TOC toggle
  const handleTocToggle = React.useCallback(() => {
    setIsTocOpen((prev) => !prev);
  }, []);

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => {
        onChange?.(value);
      }}
    >
      <div
        data-slot="kb-editor"
        className={kbEditorContainerVariants({ layout })}
      >
        {/* TOC Sidebar - only show if enabled */}
        {showToc && (
          <TocSidebar
            editor={editor}
            isOpen={isTocOpen}
            onToggle={handleTocToggle}
          />
        )}

        {/* Main Editor Area */}
        <div
          data-slot="kb-editor-area"
          className={kbEditorAreaVariants({ layout })}
        >
          {/* Editor Container with scrollable content */}
          <EditorContainer
            data-slot="kb-editor-container"
            className="flex-1 border-0"
          >
            <div className={kbEditorContentVariants({ layout })}>
              <div className={kbEditorInnerVariants({ layout })}>
                <Editor
                  placeholder={placeholder}
                  readOnly={readOnly}
                  autoFocus={autoFocus}
                  variant={layout === "full-width" ? "fullWidth" : "default"}
                  className="min-h-full"
                />
              </div>
            </div>
          </EditorContainer>
        </div>
      </div>
    </Plate>
  );
}

// --------------------------------------------------------------------------
// Main Component
// --------------------------------------------------------------------------

/**
 * Knowledge Base Editor - Potion-style editor with TOC sidebar integration.
 *
 * Features:
 * - Notion/Potion-like editing experience
 * - Collapsible Table of Contents sidebar
 * - Default (centered) or full-width layout modes
 * - Fixed toolbar at top (optional)
 * - Floating toolbar on text selection
 * - All Plate.js block types and plugins
 * - Responsive design
 *
 * @example
 * ```tsx
 * // Basic usage
 * <KBEditor
 *   documentId="doc_123"
 *   initialValue={content}
 *   onChange={(value) => saveDocument(value)}
 * />
 *
 * // Full-width with no TOC
 * <KBEditor
 *   documentId="doc_123"
 *   layout="full-width"
 *   showToc={false}
 *   initialValue={content}
 * />
 *
 * // Read-only mode
 * <KBEditor
 *   documentId="doc_123"
 *   readOnly
 *   showToolbar={false}
 *   initialValue={content}
 * />
 * ```
 */
export function KBEditor({
  documentId,
  initialValue,
  onChange,
  readOnly = false,
  layout = "default",
  showToc = true,
  showToolbar = true,
  placeholder = "Start writing...",
  autoFocus = false,
  className,
}: KBEditorProps): React.ReactElement {
  // Select plugins based on toolbar visibility and read-only state
  const plugins = React.useMemo(() => {
    if (readOnly) {
      return pluginsWithoutToolbar;
    }
    return showToolbar ? pluginsWithToolbar : pluginsWithoutToolbar;
  }, [readOnly, showToolbar]);

  // Create the Plate editor instance
  const editor = usePlateEditor({
    plugins,
    value: getEditorValue(initialValue),
    override: {
      components: {},
    },
  });

  return (
    <div
      data-slot="kb-editor-root"
      data-document-id={documentId}
      className={cn("flex h-full w-full flex-col", className)}
    >
      <KBEditorInner
        editor={editor}
        layout={layout}
        showToc={showToc}
        readOnly={readOnly}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={onChange}
      />
    </div>
  );
}

// --------------------------------------------------------------------------
// Skeleton Loading State
// --------------------------------------------------------------------------

/**
 * Skeleton loading state for the KB Editor.
 */
export function KBEditorSkeleton({
  showToc = true,
  className,
}: {
  showToc?: boolean;
  className?: string;
}): React.ReactElement {
  return (
    <div
      data-slot="kb-editor-skeleton"
      className={cn("flex h-full w-full", className)}
    >
      {/* TOC Sidebar Skeleton */}
      {showToc && (
        <div className="hidden lg:flex w-64 flex-col border-r bg-background">
          {/* Header skeleton */}
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <div className="h-4 w-4 rounded bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          </div>

          {/* Content skeleton */}
          <div className="flex-1 p-2 space-y-2">
            <div className="h-7 w-full rounded bg-muted animate-pulse" />
            <div className="h-7 w-5/6 rounded bg-muted animate-pulse ml-3" />
            <div className="h-7 w-4/5 rounded bg-muted animate-pulse ml-3" />
            <div className="h-7 w-full rounded bg-muted animate-pulse" />
            <div className="h-7 w-3/4 rounded bg-muted animate-pulse ml-3" />
          </div>
        </div>
      )}

      {/* Editor Area Skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar skeleton */}
        <div className="flex items-center gap-2 px-4 py-2 border-b">
          <div className="flex items-center gap-1">
            <div className="h-8 w-8 rounded bg-muted animate-pulse" />
            <div className="h-8 w-8 rounded bg-muted animate-pulse" />
            <div className="h-8 w-8 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-6 w-px bg-muted mx-1" />
          <div className="flex items-center gap-1">
            <div className="h-8 w-8 rounded bg-muted animate-pulse" />
            <div className="h-8 w-8 rounded bg-muted animate-pulse" />
            <div className="h-8 w-8 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex-1" />
          <div className="h-8 w-24 rounded bg-muted animate-pulse" />
        </div>

        {/* Content skeleton */}
        <div className="flex-1 p-8">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="h-10 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-5 w-full rounded bg-muted animate-pulse" />
            <div className="h-5 w-full rounded bg-muted animate-pulse" />
            <div className="h-5 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-8" />
            <div className="h-5 w-full rounded bg-muted animate-pulse" />
            <div className="h-5 w-5/6 rounded bg-muted animate-pulse" />
            <div className="h-5 w-full rounded bg-muted animate-pulse" />
            <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Type exports are done inline with type definitions above
