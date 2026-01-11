'use client';

import { useEffect, useRef } from 'react';
import { getCommentKey, getDraftCommentKey } from '@platejs/comment';
import { createPlatePlugin, type PlateEditor } from 'platejs/react';
import type { Path, Point } from 'platejs';

import { BlockDiscussion } from '@/components/plate-ui/block-discussion';
import { useOptionalDiscussionContext } from '@/components/knowledge/discussions/discussion-provider';
import type { PlateUser } from '@/hooks/knowledge/use-current-user';
import type { TDiscussion } from '@/hooks/knowledge/use-kb-discussions';

// Re-export types for backward compatibility
export type { TDiscussion, TComment } from '@/hooks/knowledge/use-kb-discussions';

/**
 * Convert a character offset to a Slate point (path + offset within node).
 * This is the inverse of getCharacterOffsetFromPath in comment.tsx.
 *
 * @param editor - The Plate.js editor instance
 * @param targetOffset - The character offset from document start (or block start if blockPath provided)
 * @param blockPath - Optional path to a block. If provided, search is limited to within this block.
 * @returns A Slate Point { path, offset } or null if offset is out of range
 */
function getPointFromCharacterOffset(
  editor: PlateEditor,
  targetOffset: number,
  blockPath?: Path
): Point | null {
  let currentOffset = 0;

  // Iterate through text nodes - either within block or entire document
  const textNodes = editor.api.nodes({
    at: blockPath ?? [],
    match: (node) => 'text' in node && typeof node.text === 'string',
  });

  for (const [node, path] of textNodes) {
    const textNode = node as { text: string };
    const nodeLength = textNode.text.length;

    // Check if the target offset falls within this node
    if (currentOffset + nodeLength >= targetOffset) {
      return {
        path,
        offset: targetOffset - currentOffset,
      };
    }

    currentOffset += nodeLength;
  }

  return null;
}

/**
 * Inject comment marks into the editor for discussions loaded from Convex.
 * This restores the visual highlighting for inline comments after page refresh.
 *
 * Uses absolute positioning: selectionStart + selectionEnd from document start
 *
 * @param editor - The Plate.js editor instance
 * @param discussions - Discussions from Convex with positioning data
 * @param injectedIds - Set of discussion IDs that have already been injected (mutated)
 */
function injectCommentMarks(
  editor: PlateEditor,
  discussions: TDiscussion[],
  injectedIds: Set<string>
): void {
  // RACE CONDITION FIX: Ensure discussions is defined before proceeding
  if (!discussions) {
    // eslint-disable-next-line no-console
    console.log('[Discussion DEBUG] Discussions not loaded yet, skipping injection');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[Discussion DEBUG] Starting mark injection...');

  // Filter to inline discussions that need position data
  // We'll check if each mark exists in editor before deciding to inject
  const inlineDiscussions = discussions.filter(
    (d) =>
      !d.isResolved &&
      d.selectionStart !== undefined &&
      d.selectionEnd !== undefined
  );

  if (inlineDiscussions.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[Discussion DEBUG] No inline discussions found');
    return;
  }

  // NEW ARCHITECTURE: Yjs marks are source of truth for positions
  // Only inject marks that don't already exist in the editor
  // This allows Yjs to track text movements while Convex stores metadata
  // eslint-disable-next-line no-console
  console.log('[Discussion DEBUG] Checking which marks need injection (Yjs-first approach)...');

  // Build a set of mark keys that already exist in the editor
  const existingMarkKeys = new Set<string>();
  const allTextNodes = Array.from(
    editor.api.nodes({
      at: [],
      match: (node) => 'text' in node && typeof node.text === 'string',
    })
  );

  for (const [node] of allTextNodes) {
    const nodeObj = node as Record<string, unknown>;
    Object.keys(nodeObj).forEach((key) => {
      if (key.startsWith('comment_') && !key.includes('draft')) {
        existingMarkKeys.add(key);
      }
    });
  }

  // eslint-disable-next-line no-console
  console.log('[Discussion DEBUG] Existing marks in editor:', Array.from(existingMarkKeys));

  // Filter to discussions whose marks DON'T exist in the editor yet
  // These are fallback injections for marks that weren't synced via Yjs
  const discussionsToInject = inlineDiscussions.filter((d) => {
    const markKey = getCommentKey(d.id);
    const exists = existingMarkKeys.has(markKey);
    if (exists) {
      // eslint-disable-next-line no-console
      console.log(`[Discussion DEBUG] Mark ${markKey} already exists - trusting Yjs position`);
      // Mark as injected so we don't check again
      injectedIds.add(d.id);
    }
    return !exists && !injectedIds.has(d.id);
  });

  if (discussionsToInject.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[Discussion DEBUG] All marks already exist in editor - no injection needed');
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[Discussion DEBUG] Injecting ${discussionsToInject.length} missing mark(s) as fallback`);

  // Log document structure BEFORE injection
  // eslint-disable-next-line no-console
  console.log('[Discussion DEBUG] Document structure:');
  // eslint-disable-next-line no-console
  console.log('  - Children count:', editor.children.length);

  // Calculate total document character count
  let totalChars = 0;
  const textNodes = editor.api.nodes({
    at: [],
    match: (node) => 'text' in node && typeof node.text === 'string',
  });

  for (const [node] of textNodes) {
    const textNode = node as { text: string };
    totalChars += textNode.text.length;
  }

  // eslint-disable-next-line no-console
  console.log('  - Total characters in document:', totalChars);
  // eslint-disable-next-line no-console
  console.log('  - Number of discussions to inject:', discussionsToInject.length);

  // Log each discussion's positioning info
  discussionsToInject.forEach((d) => {
    // eslint-disable-next-line no-console
    console.log(`  - Discussion ${d.id}: absolute [${d.selectionStart}, ${d.selectionEnd}]`);
  });

  // Batch all mark operations
  editor.tf.withMerging(() => {
    for (const discussion of discussionsToInject) {
      const { selectionStart, selectionEnd, id } = discussion;

      // eslint-disable-next-line no-console
      console.log(`\n[Discussion DEBUG] Processing discussion ${id}:`);

      const commentKey = getCommentKey(id);
      let range: { anchor: Point; focus: Point } | null = null;

      // Use absolute document positions
      if (selectionStart !== undefined && selectionEnd !== undefined) {
        // eslint-disable-next-line no-console
        console.log(`[Discussion DEBUG] Using absolute position: [${selectionStart}, ${selectionEnd}]`);

        const startPoint = getPointFromCharacterOffset(editor, selectionStart);
        const endPoint = getPointFromCharacterOffset(editor, selectionEnd);

        if (startPoint && endPoint) {
          range = { anchor: startPoint, focus: endPoint };
        }
      }

      if (!range) {
        console.warn(`[Discussion DEBUG] Could not calculate range for discussion ${id}`);
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `[Discussion] Could not find text range for discussion ${id}`,
            { selectionStart, selectionEnd }
          );
        }
        continue;
      }

      // eslint-disable-next-line no-console
      console.log('[Discussion DEBUG] Calculated range:');
      // eslint-disable-next-line no-console
      console.log('  - anchor:', range.anchor);
      // eslint-disable-next-line no-console
      console.log('  - focus:', range.focus);
      // eslint-disable-next-line no-console
      console.log('  - range:', range);
      // eslint-disable-next-line no-console
      console.log('  - commentKey:', commentKey);

      // Apply comment mark to the exact range with proper splitting
      try {
        // FIX: Preserve existing comment marks when injecting new ones
        // This allows multiple comments on the same text selection to coexist
        //
        // Strategy:
        // 1. First, get all nodes in the range that will be affected
        // 2. Collect their existing comment_* marks
        // 3. Apply new mark along with preserved existing marks
        //
        // Note: setNodes with split:true will split text nodes at range boundaries
        // We need to handle the case where the range spans nodes with different marks

        // Get nodes that will be affected by the range
        const nodesInRange = Array.from(
          editor.api.nodes({
            at: range,
            match: (node) => 'text' in node && typeof node.text === 'string',
          })
        );

        // Collect all existing comment marks from nodes in the range
        const existingMarks: Record<string, boolean> = {};
        for (const [node] of nodesInRange) {
          const nodeObj = node as Record<string, unknown>;
          Object.keys(nodeObj).forEach(key => {
            // Preserve all existing comment_* marks except the draft key
            if (key.startsWith('comment_') && !key.includes('draft')) {
              existingMarks[key] = true;
            }
          });
        }

        // Log for debugging multiple comments on same text
        if (Object.keys(existingMarks).length > 0) {
          // eslint-disable-next-line no-console
          console.log('[Discussion DEBUG] Preserving existing marks during injection:', Object.keys(existingMarks));
        }

        // Apply the comment mark with preserved existing marks
        // IMPORTANT: Apply ALL marks - existing ones + new ones
        // 1. Existing marks - preserve any comment_* marks already on nodes
        // 2. Base mark (comment: true) - for api.comment.nodes() detection
        // 3. ID mark ([commentKey]: true) - for identifying this discussion
        editor.tf.setNodes(
          {
            ...existingMarks,    // Preserve existing comment marks
            [commentKey]: true,  // Add new ID mark
            comment: true,       // Ensure base mark exists
          },
          {
            at: range,
            match: (node) => 'text' in node && typeof node.text === 'string',
            split: true,
          }
        );

        // eslint-disable-next-line no-console
        console.log('[Discussion DEBUG] setNodes completed without error');

        // Verify the mark was actually applied
        const nodesWithMark = Array.from(
          editor.api.nodes({
            at: [],
            match: (node) => {
              if (!('text' in node)) return false;
              return commentKey in node && node[commentKey] === true;
            },
          })
        );

        if (nodesWithMark.length > 0) {
          // eslint-disable-next-line no-console
          console.log(`[Discussion DEBUG] ✅ Mark FOUND in ${nodesWithMark.length} node(s)`);
          nodesWithMark.forEach(([node, path]) => {
            const nodeObj = node as Record<string, unknown>;
            // Log ALL comment marks on this node to verify multiple comments work
            const allCommentMarks = Object.keys(nodeObj).filter(k =>
              k.startsWith('comment_') && !k.includes('draft')
            );
            // eslint-disable-next-line no-console
            console.log(`  - Node at path ${JSON.stringify(path)} has ${allCommentMarks.length} comment mark(s):`, allCommentMarks);
            // eslint-disable-next-line no-console
            console.log(`    Full node:`, node);
          });
        } else {
          // eslint-disable-next-line no-console
          console.log('[Discussion DEBUG] ❌ Mark NOT FOUND in editor after setNodes');
        }

        // Mark as injected
        injectedIds.add(id);

        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log(`[Discussion] Injected comment mark for discussion ${id}`);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Discussion DEBUG] Exception during setNodes:', error);
          console.error(`[Discussion] Failed to inject mark for ${id}:`, error);
        }
      }
    }
  });
}

/**
 * Clean up orphaned comment marks from the editor.
 * These are marks with nanoid format (historical bug) that don't match any Convex discussion ID.
 *
 * @param editor - The Plate.js editor instance
 * @param discussions - Discussions from Convex
 */
function cleanupOrphanedMarks(
  editor: PlateEditor,
  discussions: TDiscussion[]
): void {
  const convexIds = new Set(discussions.map(d => d.id));
  const draftKey = getDraftCommentKey();

  // Find all text nodes with comment marks
  const nodesWithMarks = Array.from(editor.api.nodes({
    at: [],
    match: (node) => {
      if (!('text' in node)) return false;
      // Check if node has any comment_* key (except draft)
      return Object.keys(node).some(k =>
        k.startsWith('comment_') && k !== draftKey
      );
    },
  }));

  const orphanedKeys: string[] = [];

  editor.tf.withMerging(() => {
    for (const [node, path] of nodesWithMarks) {
      const nodeObj = node as Record<string, unknown>;
      const markKeys = Object.keys(nodeObj).filter(k =>
        k.startsWith('comment_') && k !== draftKey
      );

      for (const key of markKeys) {
        const id = key.replace('comment_', '');
        // Check if this ID matches any Convex discussion
        if (!convexIds.has(id)) {
          // This is an orphaned mark (likely nanoid from old code)
          editor.tf.unsetNodes([key], { at: path });
          if (!orphanedKeys.includes(key)) {
            orphanedKeys.push(key);
          }
        }
      }
    }
  });

  if (orphanedKeys.length > 0) {
    // eslint-disable-next-line no-console
    console.log('[Discussion] Cleaned up orphaned marks:', orphanedKeys);
  }
}

/**
 * Hook to sync DiscussionProvider context data to the discussion plugin.
 *
 * This hook bridges the React context (DiscussionProvider) with the Plate.js
 * plugin system. It should be called in a component that is:
 * 1. Inside a DiscussionProvider
 * 2. Has access to a PlateEditor instance
 *
 * Additionally, this hook injects comment marks into the editor for inline
 * comments loaded from Convex. This restores the visual highlighting after
 * page refresh.
 *
 * @param editor - The PlateEditor instance to sync data to (can be null during initialization)
 * @param isEditorReady - For collaborative mode, indicates when Yjs content has synced.
 *                        Pass undefined for standalone mode (treats as ready immediately).
 *
 * @example
 * ```tsx
 * // Collaborative editor
 * function CollaborativeEditorWithDiscussions() {
 *   const { editor, isEditorReady } = useHocuspocusProvider(...);
 *   useDiscussionPluginSync(editor, isEditorReady);
 *   return <PlateContent />;
 * }
 *
 * // Standalone editor
 * function StandaloneEditorWithDiscussions() {
 *   const editor = useEditorRef();
 *   useDiscussionPluginSync(editor); // undefined = ready immediately
 *   return <PlateContent />;
 * }
 * ```
 */
export function useDiscussionPluginSync(
  editor: PlateEditor | null,
  isEditorReady?: boolean
): void {
  const ctx = useOptionalDiscussionContext();

  // Track which discussion IDs have had their marks injected
  // This prevents duplicate mark injection on re-renders
  const injectedIdsRef = useRef<Set<string>>(new Set());

  // Sync context data to plugin options
  useEffect(() => {
    if (editor && ctx) {
      editor.setOption(discussionPlugin, 'currentUserId', ctx.currentUserId);
      editor.setOption(discussionPlugin, 'discussions', ctx.discussions);
      editor.setOption(discussionPlugin, 'users', ctx.users);
    }
  }, [editor, ctx, ctx?.currentUserId, ctx?.discussions, ctx?.users]);

  // Inject comment marks for inline discussions from Convex
  // This runs when discussions are loaded and editor content is ready
  useEffect(() => {
    // For collaborative mode: wait for Yjs content to load (isEditorReady = true)
    // For standalone mode: isEditorReady is undefined, treat as ready immediately
    const editorReady = isEditorReady === undefined ? true : isEditorReady;

    if (!editor || !ctx || ctx.isLoading || !editorReady) {
      if (process.env.NODE_ENV === 'development' && !editorReady && editor) {
        // eslint-disable-next-line no-console
        console.log('[Discussion] Waiting for editor content before injecting marks...');
      }
      return;
    }

    // Check if editor has content (at least one child)
    if (editor.children.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Discussion] Editor has no content, cannot inject marks');
      }
      return;
    }

    // Check if this is just a default empty paragraph (not real content yet)
    // This happens when Yjs fires onSyncChange before real content is populated.
    // Timeline issue:
    // 1. Yjs fires onSyncChange with isSynced=true
    // 2. editor.children is empty -> Plate inserts default paragraph
    // 3. editor.children.length > 0 -> isEditorReady = true
    // 4. injectCommentMarks runs -> marks applied to DEFAULT PARAGRAPH
    // 5. Yjs actually populates real content -> replaces default paragraph
    // 6. MARKS LOST - they were on the temp content
    //
    // Solution: Wait for content that is NOT just a default empty paragraph
    const isDefaultParagraph =
      editor.children.length === 1 &&
      editor.children[0] &&
      'type' in editor.children[0] &&
      editor.children[0].type === 'p' &&
      'children' in editor.children[0] &&
      Array.isArray(editor.children[0].children) &&
      editor.children[0].children.length === 1 &&
      editor.children[0].children[0] &&
      'text' in editor.children[0].children[0] &&
      editor.children[0].children[0].text === '';

    if (isDefaultParagraph) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('[Discussion] Waiting for real content to load (detected default empty paragraph)...');
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[Discussion] Real content detected, proceeding with mark injection...');
    }

    injectCommentMarks(editor, ctx.discussions, injectedIdsRef.current);

    // Clean up orphaned marks from historical nanoid bug
    cleanupOrphanedMarks(editor, ctx.discussions);

    // Force re-render of BlockDiscussion components by updating timestamp
    // This solves the race condition where BlockDiscussion renders before marks exist
    editor.setOption(discussionPlugin, 'marksInjectedAt', Date.now());

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[Discussion] marksInjectedAt updated to trigger re-render');
    }
  }, [editor, ctx, ctx?.discussions, ctx?.isLoading, isEditorReady]);
}

/**
 * Discussion plugin for Plate.js editor.
 *
 * This plugin stores discussion and user data for the comment/discussion UI.
 * It's purely a data plugin - the actual UI rendering is handled by
 * BlockDiscussion component.
 *
 * Data flow:
 * 1. DiscussionProvider fetches data from Convex
 * 2. useDiscussionPluginSync syncs context data to plugin options
 * 3. UI components read data via usePluginOption(discussionPlugin, 'key')
 *
 * For SSR and initial render, the plugin uses empty defaults. Data is
 * populated when DiscussionProvider is available and useDiscussionPluginSync
 * is called.
 */
export const discussionPlugin = createPlatePlugin({
  key: 'discussion',
  options: {
    /** Current user's ID (empty string if not authenticated) */
    currentUserId: '' as string,
    /** All discussions for the document */
    discussions: [] as TDiscussion[],
    /** Record of user ID to user info */
    users: {} as Record<string, PlateUser>,
    /**
     * Timestamp updated after comment marks are injected into the editor.
     * Components can subscribe to this to trigger re-renders after mark injection.
     * This solves the race condition where BlockDiscussion renders before marks exist.
     */
    marksInjectedAt: 0 as number,
  },
})
  .configure({
    render: { aboveNodes: BlockDiscussion },
  })
  .extendSelectors(({ getOption }) => ({
    currentUser: () => getOption('users')[getOption('currentUserId')],
    user: (id: string) => getOption('users')[id],
  }));

export const DiscussionKit = [discussionPlugin];
