'use client';

import { getCommentKey, getDraftCommentKey } from '@platejs/comment';
import { CommentPlugin, useCommentId } from '@platejs/comment/react';
import { YjsPlugin } from '@platejs/yjs/react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  format,
} from 'date-fns';
import {
  ArrowUpIcon,
  CheckIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react';
import { NodeApi, type Path, type SlateEditor, nanoid, type Value } from 'platejs';
import {
  type CreatePlateEditorOptions,
  Plate,
  useEditorPlugin,
  useEditorRef,
  usePlateEditor,
  usePluginOption,
} from 'platejs/react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { BasicMarksKit } from '@/components/editor/plugins/basic-marks-kit';
import { commentPlugin } from '@/components/editor/plugins/comment-kit';
import {
  discussionPlugin,
  type TDiscussion,
} from '@/components/editor/plugins/discussion-kit';
import { useOptionalDiscussionContext } from '@/components/knowledge/discussions';

import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Editor, EditorContainer } from './editor';

// ============================================================================
// Yjs Sync Helper
// ============================================================================

/**
 * Interface for accessing the underlying Hocuspocus provider from Plate's wrapper.
 * The HocuspocusProviderWrapper stores the actual provider in the `provider` property.
 */
interface HocuspocusProviderWrapper {
  type: string;
  provider: HocuspocusProvider;
}

/**
 * Wait for Yjs changes to sync to Hocuspocus server.
 * Uses the provider's unsyncedChanges tracking to confirm sync.
 * Falls back to a delay if provider not accessible.
 *
 * @param editor - The Plate.js editor instance with YjsPlugin configured
 * @param timeoutMs - Maximum time to wait for sync (default: 5000ms)
 * @returns Promise that resolves to true if synced, false if timed out or fallback used
 */
async function waitForYjsSync(
  editor: SlateEditor,
  timeoutMs = 5000
): Promise<boolean> {
  try {
    // Access Hocuspocus provider via YjsPlugin options
    const yjsOptions = editor.getOptions(YjsPlugin);

    // _providers is an array of provider wrappers
    // Find the Hocuspocus provider wrapper
    // We need to cast to unknown first because UnifiedProvider doesn't expose the underlying provider
    const providers = yjsOptions._providers;
    const wrapper = providers?.find((p) => p.type === 'hocuspocus');

    if (!wrapper) {
      // Provider not available - fallback to delay
      console.log('[Comment] Hocuspocus provider not found, using fallback delay');
      await new Promise(resolve => setTimeout(resolve, 500));
      return false;
    }

    // The wrapper has a `provider` property that contains the actual HocuspocusProvider
    // This is not exposed in the UnifiedProvider interface but exists at runtime
    const hocuspocusProvider = (wrapper as unknown as HocuspocusProviderWrapper).provider;

    if (!hocuspocusProvider) {
      console.log('[Comment] Hocuspocus provider instance not found, using fallback delay');
      await new Promise(resolve => setTimeout(resolve, 500));
      return false;
    }

    // Check if already synced (no pending changes)
    if (!hocuspocusProvider.hasUnsyncedChanges) {
      console.log('[Comment] No unsynced changes, already synced!');
      return true;
    }

    console.log('[Comment] Waiting for Yjs sync, unsynced changes:', hocuspocusProvider.unsyncedChanges);

    // Wait for sync via event listener
    return new Promise<boolean>((resolve) => {
      let timeoutId: NodeJS.Timeout | undefined;
      let resolved = false;

      const handleUnsyncedChanges = ({ number }: { number: number }): void => {
        console.log('[Comment] unsyncedChanges event fired, count:', number);

        if (number === 0 && !resolved) {
          resolved = true;
          cleanup();
          console.log('[Comment] Sync confirmed!');
          resolve(true);
        }
      };

      const cleanup = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        // Remove event listener
        hocuspocusProvider.off('unsyncedChanges', handleUnsyncedChanges);
      };

      // Set up timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          console.warn('[Comment] Sync timeout after', timeoutMs, 'ms');
          resolve(false);
        }
      }, timeoutMs);

      // Listen for unsyncedChanges event
      hocuspocusProvider.on('unsyncedChanges', handleUnsyncedChanges);

      // Double-check current state (race condition protection)
      // The changes might have synced between our initial check and adding the listener
      if (!hocuspocusProvider.hasUnsyncedChanges && !resolved) {
        resolved = true;
        cleanup();
        console.log('[Comment] Sync already complete (race condition handled)');
        resolve(true);
      }
    });
  } catch (error) {
    // Any error accessing provider - fallback to delay
    console.warn('[Comment] Error accessing Yjs provider, using fallback delay:', error);
    await new Promise(resolve => setTimeout(resolve, 500));
    return false;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate the character offset from the beginning of the document to a given path.
 * This is used to get selectionStart for inline comments.
 *
 * @param editor - The Plate.js editor instance
 * @param targetPath - The path to calculate offset for
 * @returns The character offset from document start
 */
function getCharacterOffsetFromPath(editor: SlateEditor, targetPath: Path): number {
  let offset = 0;

  // Iterate through all text nodes before the target path
  const textNodes = editor.api.nodes({
    at: [],
    match: (node) => 'text' in node && typeof node.text === 'string',
  });

  for (const [node, path] of textNodes) {
    // Check if this path is before the target path
    // Compare paths element by element
    let isBefore = false;
    let isEqual = true;

    for (let i = 0; i < Math.max(path.length, targetPath.length); i++) {
      const pathPart = path[i] ?? 0;
      const targetPart = targetPath[i] ?? 0;

      if (pathPart < targetPart) {
        isBefore = true;
        isEqual = false;
        break;
      } else if (pathPart > targetPart) {
        isEqual = false;
        break;
      }
    }

    if (isBefore) {
      // Add the text length of nodes before the target
      const textNode = node as { text: string };
      offset += textNode.text.length;
    } else if (isEqual) {
      // We've reached the target path, stop here
      break;
    }
  }

  return offset;
}

export type TComment = {
  id: string;
  contentRich: Value;
  createdAt: Date;
  discussionId: string;
  isEdited: boolean;
  userId: string;
};

export function Comment(props: {
  comment: TComment;
  discussionLength: number;
  editingId: string | null;
  index: number;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  documentContent?: string;
  showDocumentContent?: boolean;
  onEditorClick?: () => void;
}): React.ReactElement {
  const {
    comment,
    discussionLength,
    documentContent,
    editingId,
    index,
    setEditingId,
    showDocumentContent = false,
    onEditorClick,
  } = props;

  const editor = useEditorRef();

  // Get discussion context for Convex mutations (optional - allows graceful fallback)
  const ctx = useOptionalDiscussionContext();

  const discussions = usePluginOption(discussionPlugin, 'discussions');
  const userInfo = usePluginOption(discussionPlugin, 'user', comment.userId);
  const currentUserId = usePluginOption(discussionPlugin, 'currentUserId');

  // Local state update for resolving discussions (optimistic UI)
  const resolveDiscussionLocal = (id: string): void => {
    const updatedDiscussions = discussions.map((discussion) => {
      if (discussion.id === id) {
        return { ...discussion, isResolved: true };
      }

      return discussion;
    });
    editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);
  };

  // Local state update for removing discussions (optimistic UI)
  const removeDiscussionLocal = (id: string): void => {
    const updatedDiscussions = discussions.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (discussion: any) => discussion.id !== id
    );
    editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);
  };

  // Local state update for editing comments (optimistic UI)
  const updateCommentLocal = (input: {
    id: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contentRich: any;
    discussionId: string;
    isEdited: boolean;
  }): void => {
    const updatedDiscussions = discussions.map((discussion) => {
      if (discussion.id === input.discussionId) {
        const updatedComments = discussion.comments.map((c) => {
          if (c.id === input.id) {
            return {
              ...c,
              contentRich: input.contentRich,
              isEdited: true,
              updatedAt: new Date(),
            };
          }

          return c;
        });

        return { ...discussion, comments: updatedComments };
      }

      return discussion;
    });
    editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);
  };

  const { tf } = useEditorPlugin(CommentPlugin);

  const isMyComment = currentUserId === comment.userId;

  const initialValue = comment.contentRich;

  const commentEditor = useCommentEditor(
    {
      id: comment.id,
      value: initialValue,
    },
    [initialValue]
  );

  const onCancel = (): void => {
    setEditingId(null);
    commentEditor?.tf.replaceNodes(initialValue, {
      at: [],
      children: true,
    });
  };

  const onSave = async (): Promise<void> => {
    if (!commentEditor) return;

    const newContent = commentEditor.children;

    // Optimistic UI update (local state)
    updateCommentLocal({
      id: comment.id,
      contentRich: newContent,
      discussionId: comment.discussionId,
      isEdited: true,
    });
    setEditingId(null);

    // Persist to Convex if context is available
    if (ctx) {
      try {
        await ctx.editComment(comment.id, newContent);
      } catch {
        // Revert optimistic update on error
        updateCommentLocal({
          id: comment.id,
          contentRich: initialValue,
          discussionId: comment.discussionId,
          isEdited: comment.isEdited,
        });
        toast.error('Failed to save comment. Please try again.');
      }
    }
  };

  const onResolveComment = async (): Promise<void> => {
    // Optimistic UI update (local state)
    resolveDiscussionLocal(comment.discussionId);
    tf.comment.unsetMark({ id: comment.discussionId });

    // Persist to Convex if context is available
    if (ctx) {
      try {
        await ctx.resolveDiscussion(comment.discussionId);
      } catch {
        // Note: Reverting resolve is complex since the mark is already unset
        // In practice, the Convex subscription will sync the correct state
        toast.error('Failed to resolve discussion. Please try again.');
      }
    }
  };

  const isFirst = index === 0;
  const isLast = index === discussionLength - 1;
  const isEditing = editingId && editingId === comment.id;

  const [hovering, setHovering] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="relative flex items-center">
        {userInfo && (
          <Avatar className="size-6">
            <AvatarImage alt={userInfo.name} src={userInfo.avatarUrl} />
            <AvatarFallback>{userInfo.name?.[0]}</AvatarFallback>
          </Avatar>
        )}
        <h4 className="mx-2 font-semibold text-sm leading-none">
          {userInfo?.name}
        </h4>

        <div className="text-muted-foreground/80 text-xs leading-none">
          <span className="mr-1">
            {formatCommentDate(new Date(comment.createdAt))}
          </span>
          {comment.isEdited && <span>(edited)</span>}
        </div>

        {isMyComment && (hovering || dropdownOpen) && (
          <div className="absolute top-0 right-0 flex space-x-1">
            {index === 0 && (
              <Button
                className="h-6 p-1 text-muted-foreground"
                onClick={onResolveComment}
                type="button"
                variant="ghost"
              >
                <CheckIcon className="size-4" />
              </Button>
            )}

            <CommentMoreDropdown
              comment={comment}
              dropdownOpen={dropdownOpen}
              onCloseAutoFocus={() => {
                setTimeout(() => {
                  commentEditor?.tf.focus({ edge: 'endEditor' });
                }, 0);
              }}
              onRemoveComment={async () => {
                if (discussionLength === 1) {
                  tf.comment.unsetMark({ id: comment.discussionId });
                  // Local state update
                  removeDiscussionLocal(comment.discussionId);
                  // Note: Discussion removal in Convex is handled by deleteComment
                  // when it's the last comment - the backend handles this automatically
                }
              }}
              setDropdownOpen={setDropdownOpen}
              setEditingId={setEditingId}
            />
          </div>
        )}
      </div>

      {isFirst && showDocumentContent && (
        <div className="relative mt-1 flex pl-[32px] text-sm text-subtle-foreground">
          {discussionLength > 1 && (
            <div className="absolute top-[5px] left-3 h-full w-0.5 shrink-0 bg-muted" />
          )}
          <div className="my-px w-0.5 shrink-0 bg-highlight" />
          {documentContent && <div className="ml-2">{documentContent}</div>}
        </div>
      )}

      <div className="relative my-1 pl-[26px]">
        {!isLast && (
          <div className="absolute top-0 left-3 h-full w-0.5 shrink-0 bg-muted" />
        )}
        <Plate editor={commentEditor} readOnly={!isEditing}>
          <EditorContainer variant="comment">
            <Editor
              className="w-auto grow"
              onClick={() => onEditorClick?.()}
              variant="comment"
            />

            {isEditing && (
              <div className="ml-auto flex shrink-0 gap-1">
                <Button
                  className="size-[28px]"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    void onCancel();
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-[50%] bg-primary/40">
                    <XIcon className="!size-3 stroke-[3px] text-background" />
                  </div>
                </Button>

                <Button
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    void onSave();
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-[50%] bg-brand">
                    <CheckIcon className="!size-3 stroke-[3px] text-background" />
                  </div>
                </Button>
              </div>
            )}
          </EditorContainer>
        </Plate>
      </div>
    </div>
  );
}

function CommentMoreDropdown(props: {
  comment: TComment;
  dropdownOpen: boolean;
  setDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  onCloseAutoFocus?: () => void;
  onRemoveComment?: () => void;
}): React.ReactElement {
  const {
    comment,
    dropdownOpen,
    setDropdownOpen,
    setEditingId,
    onCloseAutoFocus,
    onRemoveComment,
  } = props;

  // Get discussion context for Convex mutations (optional - allows graceful fallback)
  const ctx = useOptionalDiscussionContext();

  const discussions = usePluginOption(discussionPlugin, 'discussions');
  const editor = useEditorRef();

  const selectedEditCommentRef = React.useRef<boolean>(false);

  // Local state update for deleting comments (optimistic UI)
  const deleteCommentLocal = React.useCallback((): void => {
    // Find and update the discussion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedDiscussions = discussions.map((discussion: any) => {
      if (discussion.id !== comment.discussionId) {
        return discussion;
      }

      const commentIndex = discussion.comments.findIndex(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c.id === comment.id
      );

      if (commentIndex === -1) {
        return discussion;
      }

      return {
        ...discussion,
        comments: [
          ...discussion.comments.slice(0, commentIndex),
          ...discussion.comments.slice(commentIndex + 1),
        ],
      };
    });

    // Update local state
    editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);
    onRemoveComment?.();
  }, [comment.discussionId, comment.id, discussions, editor, onRemoveComment]);

  const onDeleteComment = React.useCallback(async (): Promise<void> => {
    if (!comment.id) {
      toast.error('You are operating too quickly, please try again later.');
      return;
    }

    // Optimistic UI update (local state)
    deleteCommentLocal();

    // Persist to Convex if context is available
    if (ctx) {
      try {
        await ctx.deleteComment(comment.id);
      } catch {
        // Note: Reverting delete is complex since local state is already updated
        // In practice, the Convex subscription will sync the correct state
        toast.error('Failed to delete comment. Please try again.');
      }
    }
  }, [comment.id, ctx, deleteCommentLocal]);

  const onEditComment = React.useCallback((): void => {
    selectedEditCommentRef.current = true;

    if (!comment.id) {
      toast.error('You are operating too quickly, please try again later.');
      return;
    }

    setEditingId(comment.id);
  }, [comment.id, setEditingId]);

  return (
    <DropdownMenu
      modal={false}
      onOpenChange={setDropdownOpen}
      open={dropdownOpen}
    >
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button className={cn('h-6 p-1 text-muted-foreground')} variant="ghost">
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-48"
        onCloseAutoFocus={(e) => {
          if (selectedEditCommentRef.current) {
            onCloseAutoFocus?.();
            selectedEditCommentRef.current = false;
          }

          return e.preventDefault();
        }}
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onEditComment}>
            <PencilIcon className="size-4" />
            Edit comment
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDeleteComment}>
            <TrashIcon className="size-4" />
            Delete comment
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const useCommentEditor = (
  options: Omit<CreatePlateEditorOptions, 'plugins'> = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: any[] = []
): ReturnType<typeof usePlateEditor> => {
  const commentEditor = usePlateEditor(
    {
      id: 'comment',
      plugins: BasicMarksKit,
      value: [],
      ...options,
    },
    deps
  );

  return commentEditor;
};

export function CommentCreateForm({
  autoFocus = false,
  className,
  discussionId: discussionIdProp,
  focusOnMount = false,
}: {
  autoFocus?: boolean;
  className?: string;
  discussionId?: string;
  focusOnMount?: boolean;
}): React.ReactElement {
  const discussions = usePluginOption(discussionPlugin, 'discussions');

  const editor = useEditorRef();
  const commentId = useCommentId();
  const discussionId = discussionIdProp ?? commentId;

  // Get discussion context for Convex mutations (optional - allows graceful fallback)
  const ctx = useOptionalDiscussionContext();

  const userInfo = usePluginOption(discussionPlugin, 'currentUser');
  const [commentValue, setCommentValue] = React.useState<Value | undefined>();
  const commentContent = useMemo(
    () =>
      commentValue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? NodeApi.string({ children: commentValue as any, type: 'p' })
        : '',
    [commentValue]
  );
  const commentEditor = useCommentEditor();

  useEffect(() => {
    if (commentEditor && focusOnMount) {
      commentEditor.tf.focus();
    }
  }, [commentEditor, focusOnMount]);

  const onAddComment = React.useCallback(async (): Promise<void> => {
    if (!commentValue || !commentEditor) return;

    commentEditor.tf.reset();

    if (discussionId) {
      // Get existing discussion
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const discussion = discussions.find((d: any) => d.id === discussionId);

      if (!discussion) {
        // Create new discussion (page-level comment)
        const newDiscussion: TDiscussion = {
          id: discussionId,
          comments: [
            {
              id: nanoid(),
              contentRich: commentValue,
              createdAt: new Date(),
              discussionId,
              isEdited: false,
              userId: editor.getOption(discussionPlugin, 'currentUserId'),
            },
          ],
          createdAt: new Date(),
          isResolved: false,
          userId: editor.getOption(discussionPlugin, 'currentUserId'),
        };

        // Optimistic UI update
        editor.setOption(discussionPlugin, 'discussions', [
          ...discussions,
          newDiscussion,
        ]);

        // Persist to Convex
        if (ctx) {
          try {
            await ctx.createComment({
              type: 'page',
              content: commentValue,
            });
          } catch {
            toast.error('Failed to save comment. Please try again.');
          }
        }

        return;
      }

      // Create reply comment
      const comment: TComment = {
        id: nanoid(),
        contentRich: commentValue,
        createdAt: new Date(),
        discussionId,
        isEdited: false,
        userId: editor.getOption(discussionPlugin, 'currentUserId'),
      };

      // Add reply to discussion comments
      const updatedDiscussion = {
        ...discussion,
        comments: [...discussion.comments, comment],
      };

      // Filter out old discussion and add updated one
      const updatedDiscussions = discussions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((d: any) => d.id !== discussionId)
        .concat(updatedDiscussion);

      // Optimistic UI update
      editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);

      // Persist reply to Convex
      if (ctx) {
        try {
          await ctx.createComment({
            type: 'inline',
            content: commentValue,
            parentId: discussionId,
          });
        } catch {
          toast.error('Failed to save reply. Please try again.');
        }
      }

      return;
    }

    // Handle inline comment (text selection)
    const commentsNodeEntry = editor
      .getApi(CommentPlugin)
      .comment.nodes({ at: [], isDraft: true });

    if (commentsNodeEntry.length === 0) return;

    const documentContent = commentsNodeEntry
      .map(([node]) => node.text)
      .join('');

    // Calculate selection positions for the inline comment
    // Get the path of the first selected node to calculate the start offset
    const firstPath = commentsNodeEntry[0]?.[1];
    const selectionStart = firstPath
      ? getCharacterOffsetFromPath(editor, firstPath)
      : 0;
    const selectionEnd = selectionStart + documentContent.length;

    // Store paths of draft nodes BEFORE any changes
    // This is critical because Convex call is async and paths may change
    const draftNodePaths = commentsNodeEntry.map(([, path]) => [...path]);

    // FIX: Don't apply nanoid mark - wait for Convex ID
    // The problem: nanoid marks sync to Yjs immediately, but Convex uses different IDs.
    // On refresh, Yjs has nanoid marks but Convex has real IDs -> mismatch.
    //
    // NEW FLOW:
    // 1. Keep draft mark visible for optimistic UI (don't remove it yet)
    // 2. Call Convex to get the real ID
    // 3. Only then replace draft mark with Convex ID mark
    // 4. This ensures only Convex IDs are synced to Yjs

    // Create placeholder discussion with temp ID for UI feedback
    // This will be updated with the real Convex ID after the API call
    const tempId = `temp_${nanoid()}`;
    const newDiscussion: TDiscussion = {
      id: tempId,
      comments: [
        {
          id: nanoid(),
          contentRich: commentValue,
          createdAt: new Date(),
          discussionId: tempId,
          isEdited: false,
          userId: editor.getOption(discussionPlugin, 'currentUserId'),
        },
      ],
      createdAt: new Date(),
      documentContent,
      isResolved: false,
      userId: editor.getOption(discussionPlugin, 'currentUserId'),
    };

    // Optimistic UI update - add temp discussion for immediate feedback
    editor.setOption(discussionPlugin, 'discussions', [
      ...discussions,
      newDiscussion,
    ]);

    // Persist inline comment to Convex BEFORE applying marks
    if (ctx) {
      // Set flag to prevent premature draft mark removal by BlockDiscussion
      editor.setOption(commentPlugin, 'isSubmitting', true);
      try {
        const convexId = await ctx.createComment({
          type: 'inline',
          content: commentValue,
          selectedText: documentContent,
          selectionStart,
          selectionEnd,
        });

        // NOW apply the mark with the real Convex ID using retry mechanism
        // This is the only mark that will be synced to Yjs
        const applyMarkWithRetry = async (convexIdToApply: string, maxRetries = 3): Promise<boolean> => {
          const markKey = getCommentKey(convexIdToApply);

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            // Find ALL draft nodes currently in editor (not using stored paths)
            // This handles the case where paths shifted during async Convex call
            const draftNodes = Array.from(editor.api.nodes({
              at: [],
              match: (node) =>
                typeof node === 'object' &&
                node !== null &&
                'text' in node &&
                getDraftCommentKey() in node &&
                (node as Record<string, unknown>)[getDraftCommentKey()] === true,
            }));

            if (draftNodes.length > 0) {
              editor.tf.withMerging(() => {
                for (const [node, path] of draftNodes) {
                  editor.tf.unsetNodes([getDraftCommentKey()], { at: path });

                  // FIX: Preserve existing comment marks when adding new ones
                  // This allows multiple comments on the same text selection
                  // Without this, setNodes might overwrite existing marks in edge cases
                  const existingMarks: Record<string, boolean> = {};
                  const nodeObj = node as Record<string, unknown>;
                  Object.keys(nodeObj).forEach(key => {
                    // Preserve all existing comment_* marks except the draft key
                    if (key.startsWith('comment_') && key !== getDraftCommentKey()) {
                      existingMarks[key] = true;
                    }
                  });

                  // Log for debugging multiple comments on same text
                  if (Object.keys(existingMarks).length > 0) {
                    console.log('[Comment] Preserving existing marks:', Object.keys(existingMarks));
                  }

                  // IMPORTANT: Apply ALL marks - existing ones + new ones
                  // 1. Existing marks - preserve any comment_* marks already on the node
                  // 2. Base mark (comment: true) - for api.comment.nodes() detection
                  // 3. ID mark ([markKey]: true) - for identifying this discussion
                  editor.tf.setNodes({
                    ...existingMarks,  // Preserve existing comment marks
                    [markKey]: true,   // Add new ID mark
                    comment: true,     // Ensure base mark exists
                  }, { at: path, split: true });
                }
              });

              // Verify mark was applied and log ALL marks on the node
              const verifyNodes = Array.from(editor.api.nodes({
                at: [],
                match: (node) =>
                  typeof node === 'object' &&
                  node !== null &&
                  'text' in node &&
                  markKey in node &&
                  (node as Record<string, unknown>)[markKey] === true,
              }));

              if (verifyNodes.length > 0) {
                // Log all comment marks on the node to verify multiple comments work
                for (const [node, path] of verifyNodes) {
                  const nodeObj = node as Record<string, unknown>;
                  const allCommentMarks = Object.keys(nodeObj).filter(k =>
                    k.startsWith('comment_') && !k.includes('draft')
                  );
                  console.log(`[Comment] Node at ${JSON.stringify(path)} has marks:`, allCommentMarks);
                  console.log('[Comment] Full node:', nodeObj);
                }

                // Wait for Yjs to sync the mark to Hocuspocus server
                // Uses event-driven sync confirmation instead of arbitrary delay
                console.log('[Comment] Mark applied successfully, waiting for Yjs sync...');
                const synced = await waitForYjsSync(editor);
                if (synced) {
                  console.log('[Comment] Yjs sync confirmed!');
                } else {
                  console.warn('[Comment] Yjs sync may be incomplete, mark saved locally');
                }
                return true; // Success - mark is applied, sync was attempted
              }
            }

            // Wait and retry with exponential backoff
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
            }
          }

          return false; // Failed after retries
        };

        // Call the retry mechanism
        const markApplied = await applyMarkWithRetry(convexId);
        if (!markApplied) {
          // Mark application failed, but comment is saved in Convex
          // It will be visible after refresh via injectCommentMarks
          console.warn('[Comment] Mark not applied, will be visible after refresh');
        }

        // Update local discussions state with correct Convex ID
        const currentDiscussions = editor.getOption(
          discussionPlugin,
          'discussions'
        );
        const updatedDiscussions = currentDiscussions.map((d: TDiscussion) =>
          d.id === tempId ? { ...d, id: convexId, comments: d.comments.map(c => ({ ...c, discussionId: convexId })) } : d
        );
        editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);
      } catch {
        toast.error('Failed to save comment. Please try again.');

        // Rollback: remove draft marks since Convex save failed
        const draftNodes = Array.from(
          editor.api.nodes({
            at: [],
            match: (node) =>
              typeof node === 'object' &&
              node !== null &&
              getDraftCommentKey() in node &&
              node[getDraftCommentKey()] === true,
          })
        );
        for (const [, path] of draftNodes) {
          try {
            editor.tf.unsetNodes([getDraftCommentKey()], { at: path });
          } catch {
            // Node may no longer exist - skip silently
          }
        }

        // Remove temp discussion from local state
        const currentDiscussions = editor.getOption(
          discussionPlugin,
          'discussions'
        );
        const filteredDiscussions = currentDiscussions.filter(
          (d: TDiscussion) => d.id !== tempId
        );
        editor.setOption(discussionPlugin, 'discussions', filteredDiscussions);
      } finally {
        // Always reset the isSubmitting flag
        editor.setOption(commentPlugin, 'isSubmitting', false);
      }
    } else {
      // No Convex context - just remove draft marks without persisting
      // This case shouldn't normally happen in production
      for (const path of draftNodePaths) {
        try {
          editor.tf.unsetNodes([getDraftCommentKey()], { at: path });
        } catch {
          // Skip invalid paths
        }
      }
      // Remove temp discussion
      const currentDiscussions = editor.getOption(
        discussionPlugin,
        'discussions'
      );
      const filteredDiscussions = currentDiscussions.filter(
        (d: TDiscussion) => d.id !== tempId
      );
      editor.setOption(discussionPlugin, 'discussions', filteredDiscussions);
    }
  }, [commentValue, commentEditor, discussionId, editor, discussions, ctx]);

  return (
    <div className={cn('flex w-full', className)}>
      <div className="mt-1 mr-1 shrink-0">
        <Avatar className="size-5">
          <AvatarImage alt={userInfo?.name} src={userInfo?.avatarUrl} />
          <AvatarFallback>{userInfo?.name?.[0]}</AvatarFallback>
        </Avatar>
      </div>

      <div className="relative flex grow gap-2">
        <Plate
          editor={commentEditor}
          onChange={({ value }) => {
            setCommentValue(value);
          }}
        >
          <EditorContainer variant="comment">
            <Editor
              autoComplete="off"
              autoFocus={autoFocus}
              className="min-h-[25px] grow pt-0.5 pr-8"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void onAddComment();
                }
              }}
              placeholder="Reply..."
              variant="comment"
            />

            <Button
              className="absolute right-0 bottom-0 ml-auto shrink-0"
              disabled={commentContent.trim().length === 0}
              onClick={(e) => {
                e.stopPropagation();
                void onAddComment();
              }}
              size="icon"
              variant="ghost"
            >
              <div className="flex size-6 items-center justify-center rounded-full">
                <ArrowUpIcon />
              </div>
            </Button>
          </EditorContainer>
        </Plate>
      </div>
    </div>
  );
}

export const formatCommentDate = (date: Date): string => {
  const now = new Date();
  const diffMinutes = differenceInMinutes(now, date);
  const diffHours = differenceInHours(now, date);
  const diffDays = differenceInDays(now, date);

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }
  if (diffHours < 24) {
    return `${diffHours}h`;
  }
  if (diffDays < 2) {
    return `${diffDays}d`;
  }

  return format(date, 'MM/dd/yyyy');
};
