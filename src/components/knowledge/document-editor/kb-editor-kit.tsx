"use client";

/**
 * KB Editor Kit - Complete plugin assembly for the Knowledge Base editor.
 *
 * This module provides all the Plate.js plugins needed for the KB document editor,
 * extending the base editor kit with KB-specific functionality like course and
 * lesson embeds.
 *
 * @module kb-editor-kit
 */

import * as React from "react";
import { createPlatePlugin } from "platejs/react";
import type { PlateElementProps } from "platejs/react";
import type { Id } from "../../../../convex/_generated/dataModel";

// Base editor kit (contains all standard plugins)
import { BaseEditorKit } from "@/components/editor/editor-base-kit";

// Additional kits for full editing experience
import { BasicMarksKit } from "@/components/editor/plugins/basic-marks-kit";
import { SlashKit } from "@/components/editor/plugins/slash-kit";
import { DndKit } from "@/components/editor/plugins/dnd-kit";
import { BlockMenuKit } from "@/components/editor/plugins/block-menu-kit";
import { AutoformatKit } from "@/components/editor/plugins/autoformat-kit";
import { ExitBreakKit } from "@/components/editor/plugins/exit-break-kit";
import { DiscussionKit } from "@/components/editor/plugins/discussion-kit";
import { FixedToolbarKit } from "@/components/editor/plugins/fixed-toolbar-kit";
import { FloatingToolbarKit } from "@/components/editor/plugins/floating-toolbar-kit";

// KB-specific block components
import { CourseEmbed } from "./blocks/course-embed";
import { LessonEmbed } from "./blocks/lesson-embed";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/**
 * Options for configuring the KB Editor Kit.
 */
export interface KBEditorKitOptions {
  /** Enable collaboration features (cursor awareness, real-time sync) */
  collaboration?: boolean;
  /** Enable AI features (AI assist, suggestions) */
  ai?: boolean;
  /** Enable comments functionality */
  comments?: boolean;
  /** Custom upload handler for media files */
  uploadHandler?: (file: File) => Promise<string>;
  /** Whether the editor is in read-only mode */
  readOnly?: boolean;
  /** Whether to show the fixed toolbar */
  showFixedToolbar?: boolean;
}

/**
 * Course embed element data structure.
 */
export interface CourseEmbedElement {
  type: "course-embed";
  courseId: Id<"courses">;
  children: [{ text: "" }];
}

/**
 * Lesson embed element data structure.
 */
export interface LessonEmbedElement {
  type: "lesson-embed";
  lessonId: Id<"lessons">;
  children: [{ text: "" }];
}

// --------------------------------------------------------------------------
// Plugin Keys
// --------------------------------------------------------------------------

/** Plugin key for course embed blocks */
export const COURSE_EMBED_KEY = "course-embed";

/** Plugin key for lesson embed blocks */
export const LESSON_EMBED_KEY = "lesson-embed";

// --------------------------------------------------------------------------
// Course Embed Plugin
// --------------------------------------------------------------------------

/**
 * Course Embed Element Component.
 *
 * Renders the CourseEmbed block within the Plate.js editor.
 * This is a void element (non-editable block).
 */
function CourseEmbedElementComponent({
  element,
  className,
  children,
  ...props
}: PlateElementProps): React.ReactElement {
  const courseElement = element as unknown as CourseEmbedElement;

  return (
    <div
      data-slate-void
      data-slate-node="element"
      data-slate-inline={false}
      contentEditable={false}
      className={className}
      {...props}
    >
      <CourseEmbed
        courseId={courseElement.courseId}
        className="my-4"
        readOnly={false}
      />
      {/* Hidden children for Slate DOM reconciliation */}
      <span style={{ display: "none" }}>{children}</span>
    </div>
  );
}

/**
 * Course Embed Plugin.
 *
 * Defines the course-embed element type as a void element with React renderer.
 */
export const CourseEmbedPlugin = createPlatePlugin({
  key: COURSE_EMBED_KEY,
  node: {
    isElement: true,
    isVoid: true,
    type: COURSE_EMBED_KEY,
    component: CourseEmbedElementComponent,
  },
});

// --------------------------------------------------------------------------
// Lesson Embed Plugin
// --------------------------------------------------------------------------

/**
 * Lesson Embed Element Component.
 *
 * Renders the LessonEmbed block within the Plate.js editor.
 * This is a void element (non-editable block).
 */
function LessonEmbedElementComponent({
  element,
  className,
  children,
  ...props
}: PlateElementProps): React.ReactElement {
  const lessonElement = element as unknown as LessonEmbedElement;

  return (
    <div
      data-slate-void
      data-slate-node="element"
      data-slate-inline={false}
      contentEditable={false}
      className={className}
      {...props}
    >
      <LessonEmbed
        lessonId={lessonElement.lessonId}
        className="my-3"
        readOnly={false}
      />
      {/* Hidden children for Slate DOM reconciliation */}
      <span style={{ display: "none" }}>{children}</span>
    </div>
  );
}

/**
 * Lesson Embed Plugin.
 *
 * Defines the lesson-embed element type as a void element with React renderer.
 */
export const LessonEmbedPlugin = createPlatePlugin({
  key: LESSON_EMBED_KEY,
  node: {
    isElement: true,
    isVoid: true,
    type: LESSON_EMBED_KEY,
    component: LessonEmbedElementComponent,
  },
});

// --------------------------------------------------------------------------
// KB Embed Kit
// --------------------------------------------------------------------------

/**
 * KB Embed Kit - Contains all KB-specific embed plugins.
 *
 * Includes:
 * - CourseEmbedPlugin: For embedding course cards
 * - LessonEmbedPlugin: For embedding lesson links
 */
export const KBEmbedKit = [CourseEmbedPlugin, LessonEmbedPlugin];

// --------------------------------------------------------------------------
// Pre-configured Plugin Arrays
// --------------------------------------------------------------------------

/**
 * Full KB Editor Kit with fixed toolbar.
 *
 * Pre-configured plugin array with:
 * - All base editing functionality
 * - KB-specific embed blocks
 * - Slash commands
 * - Drag and drop
 * - Block menu
 * - Autoformat (markdown shortcuts)
 * - Exit break handling
 * - Discussion/comments
 * - Fixed and floating toolbars
 */
export const kbEditorKit = [
  ...BaseEditorKit,
  ...BasicMarksKit,
  ...KBEmbedKit,
  ...SlashKit,
  ...DndKit,
  ...BlockMenuKit,
  ...AutoformatKit,
  ...ExitBreakKit,
  ...DiscussionKit,
  ...FixedToolbarKit,
  ...FloatingToolbarKit,
];

/**
 * KB Editor Kit without fixed toolbar.
 *
 * Same as kbEditorKit but without the fixed toolbar.
 * Useful for embedded editors or minimal UI contexts.
 */
export const kbEditorKitWithoutFixedToolbar = [
  ...BaseEditorKit,
  ...BasicMarksKit,
  ...KBEmbedKit,
  ...SlashKit,
  ...DndKit,
  ...BlockMenuKit,
  ...AutoformatKit,
  ...ExitBreakKit,
  ...DiscussionKit,
  ...FloatingToolbarKit,
];

/**
 * KB Editor Kit for read-only rendering.
 *
 * Minimal plugin set for displaying KB content without editing:
 * - Base rendering plugins
 * - KB embed blocks
 * - Basic marks for text styling
 */
export const kbEditorKitReadOnly = [
  ...BaseEditorKit,
  ...BasicMarksKit,
  ...KBEmbedKit,
];

/**
 * KB Editor Kit without comments/discussions.
 *
 * Full editing experience without discussion functionality.
 */
export const kbEditorKitNoComments = [
  ...BaseEditorKit,
  ...BasicMarksKit,
  ...KBEmbedKit,
  ...SlashKit,
  ...DndKit,
  ...BlockMenuKit,
  ...AutoformatKit,
  ...ExitBreakKit,
  ...FixedToolbarKit,
  ...FloatingToolbarKit,
];

// --------------------------------------------------------------------------
// Factory Function
// --------------------------------------------------------------------------

/**
 * Creates a KB Editor plugin array with the specified options.
 *
 * This factory function assembles all necessary plugins for the KB editor,
 * allowing fine-grained control over which features are enabled.
 *
 * @param options - Configuration options for the editor
 * @returns Array of Plate.js plugins
 *
 * @example
 * ```tsx
 * const plugins = createKBEditorKit({
 *   collaboration: true,
 *   comments: true,
 *   showFixedToolbar: true,
 * });
 *
 * function MyEditor() {
 *   const editor = usePlateEditor({ plugins });
 *   return <Plate editor={editor}>...</Plate>;
 * }
 * ```
 */
export function createKBEditorKit(
  options: KBEditorKitOptions = {}
): typeof kbEditorKit {
  const {
    comments = true,
    showFixedToolbar = true,
    readOnly = false,
  } = options;

  // Read-only mode: minimal plugins
  if (readOnly) {
    return kbEditorKitReadOnly;
  }

  // No comments mode
  if (!comments) {
    return showFixedToolbar
      ? kbEditorKitNoComments
      : [
          ...BaseEditorKit,
          ...BasicMarksKit,
          ...KBEmbedKit,
          ...SlashKit,
          ...DndKit,
          ...BlockMenuKit,
          ...AutoformatKit,
          ...ExitBreakKit,
          ...FloatingToolbarKit,
        ];
  }

  // Full mode
  return showFixedToolbar ? kbEditorKit : kbEditorKitWithoutFixedToolbar;
}

// --------------------------------------------------------------------------
// Utility Functions
// --------------------------------------------------------------------------

/**
 * Creates a course embed element for insertion into the editor.
 *
 * @param courseId - The ID of the course to embed
 * @returns A CourseEmbedElement node
 *
 * @example
 * ```tsx
 * const element = createCourseEmbedElement(courseId);
 * editor.tf.insertNodes([element]);
 * ```
 */
export function createCourseEmbedElement(
  courseId: Id<"courses">
): CourseEmbedElement {
  return {
    type: COURSE_EMBED_KEY,
    courseId,
    children: [{ text: "" }],
  };
}

/**
 * Creates a lesson embed element for insertion into the editor.
 *
 * @param lessonId - The ID of the lesson to embed
 * @returns A LessonEmbedElement node
 *
 * @example
 * ```tsx
 * const element = createLessonEmbedElement(lessonId);
 * editor.tf.insertNodes([element]);
 * ```
 */
export function createLessonEmbedElement(
  lessonId: Id<"lessons">
): LessonEmbedElement {
  return {
    type: LESSON_EMBED_KEY,
    lessonId,
    children: [{ text: "" }],
  };
}

/**
 * Checks if a node is a course embed element.
 *
 * @param node - The Slate node to check
 * @returns True if the node is a course embed
 */
export function isCourseEmbed(node: unknown): node is CourseEmbedElement {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in node &&
    (node as { type: unknown }).type === COURSE_EMBED_KEY
  );
}

/**
 * Checks if a node is a lesson embed element.
 *
 * @param node - The Slate node to check
 * @returns True if the node is a lesson embed
 */
export function isLessonEmbed(node: unknown): node is LessonEmbedElement {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in node &&
    (node as { type: unknown }).type === LESSON_EMBED_KEY
  );
}
