'use client';

import { getDraftCommentKey } from '@platejs/comment';
import { CommentPlugin } from '@platejs/comment/react';
import { getTransientSuggestionKey } from '@platejs/suggestion';
import { SuggestionPlugin } from '@platejs/suggestion/react';
import {
  MessageSquareTextIcon,
  MessagesSquareIcon,
  PencilLineIcon,
} from 'lucide-react';
import {
  type AnyPluginConfig,
  type NodeEntry,
  type Path,
  PathApi,
  type TCommentText,
  type TElement,
  TextApi,
  type TSuggestionText,
} from 'platejs';
import type { PlateElementProps, RenderNodeWrapper } from 'platejs/react';
import { useEditorPlugin, useEditorRef, usePluginOption } from 'platejs/react';
import React, { useEffect } from 'react';

import { commentPlugin } from '@/components/editor/plugins/comment-kit';
import {
  discussionPlugin,
  type TDiscussion,
} from '@/components/editor/plugins/discussion-kit';
import { useOptionalDiscussionContext } from '@/components/knowledge/discussions';
import { suggestionPlugin } from '@/components/editor/plugins/suggestion-kit';
import { Button } from '@/components/plate-ui/button';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/plate-ui/popover';

import {
  BlockSuggestionCard,
  isResolvedSuggestion,
  useResolveSuggestion,
} from './block-suggestion';
import { Comment, CommentCreateForm } from './comment';

export const BlockDiscussion: RenderNodeWrapper<AnyPluginConfig> = (props) => {
  // Always render in block mode - isOverlapWithEditor is always true now
  const { api, editor, element } = props;

  const blockPath = editor.api.findPath(element);

  // DEBUG: Log rendering
  console.log('[BlockDiscussion] Rendering for element:', element, 'at path:', blockPath);

  // avoid duplicate in table or column
  if (!blockPath || blockPath.length > 1) return;

  const draftCommentNode = api.comment.node({ at: blockPath, isDraft: true });

  const commentNodes = [...api.comment.nodes({ at: blockPath })];

  // DEBUG: Log api.comment.nodes() results
  console.log('[BlockDiscussion] api.comment.nodes() returned:', commentNodes.length, 'nodes');
  console.log('[BlockDiscussion] Comment nodes:', commentNodes);

  // DEBUG: Log all nodes at this path with any comment_* key
  const allNodesAtPath = [...editor.api.nodes({ at: blockPath })];
  const nodesWithCommentKey = allNodesAtPath.filter(([node]) => {
    if (!('text' in node)) return false;
    return Object.keys(node).some(k => k.startsWith('comment_'));
  });
  console.log('[BlockDiscussion] Nodes with comment_* key:', nodesWithCommentKey.length);
  console.log('[BlockDiscussion] Raw nodes:', nodesWithCommentKey);

  const suggestionNodes = [
    ...editor.getApi(SuggestionPlugin).suggestion.nodes({ at: blockPath }),
  ].filter(([node]) => !node[getTransientSuggestionKey()]);

  if (
    commentNodes.length === 0 &&
    suggestionNodes.length === 0 &&
    !draftCommentNode
  ) {
    console.log('[BlockDiscussion] Early return - no comments, suggestions, or drafts');
    return;
  }
  console.log('[BlockDiscussion] Will render - found content');

  const BlockCommentsWrapper = (props: PlateElementProps): React.ReactElement => (
    <BlockCommentsContent
      blockPath={blockPath}
      commentNodes={commentNodes}
      draftCommentNode={draftCommentNode}
      suggestionNodes={suggestionNodes}
      {...props}
    />
  );
  BlockCommentsWrapper.displayName = 'BlockCommentsWrapper';
  return BlockCommentsWrapper;
};

const BlockCommentsContent = ({
  blockPath,
  children,
  commentNodes,
  draftCommentNode,
  suggestionNodes,
}: PlateElementProps & {
  blockPath: Path;
  commentNodes: NodeEntry<TCommentText>[];
  draftCommentNode: NodeEntry<TCommentText> | undefined;
  suggestionNodes: NodeEntry<TElement | TSuggestionText>[];
}): React.ReactElement => {
  const editor = useEditorRef();

  console.log('[BlockCommentsContent] START - Input:', {
    blockPath,
    commentNodesCount: commentNodes.length,
    hasDraft: !!draftCommentNode,
    suggestionNodesCount: suggestionNodes.length,
  });

  const resolvedSuggestion = useResolveSuggestion(suggestionNodes, blockPath);

  const resolvedDiscussions = useResolvedDiscussion(commentNodes, blockPath);
  console.log('[BlockCommentsContent] After useResolvedDiscussion:', {
    resolvedDiscussionsCount: resolvedDiscussions.length,
    resolvedDiscussions,
  });

  const suggestionsCount = resolvedSuggestion.length;
  const discussionsCount = resolvedDiscussions.length;
  const totalCount = suggestionsCount + discussionsCount;

  console.log('[BlockCommentsContent] Counts:', {
    suggestionsCount,
    discussionsCount,
    totalCount,
    hasDraft: !!draftCommentNode,
  });

  const activeSuggestionId = usePluginOption(suggestionPlugin, 'activeId');
  const activeSuggestion =
    activeSuggestionId &&
    resolvedSuggestion.find((s) => s.suggestionId === activeSuggestionId);

  const commentingBlock = usePluginOption(commentPlugin, 'commentingBlock');
  const activeCommentId = usePluginOption(commentPlugin, 'activeId');
  const isSubmitting = usePluginOption(commentPlugin, 'isSubmitting');
  const isCommenting = activeCommentId === getDraftCommentKey();
  const activeDiscussion =
    activeCommentId &&
    resolvedDiscussions.find((d) => d.id === activeCommentId);

  const noneActive = !activeSuggestion && !activeDiscussion;

  const sortedMergedData = [...resolvedDiscussions, ...resolvedSuggestion].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const selected =
    resolvedDiscussions.some((d) => d.id === activeCommentId) ||
    resolvedSuggestion.some((s) => s.suggestionId === activeSuggestionId);

  const [_open, setOpen] = React.useState(selected);

  // in some cases, we may comment the multiple blocks
  const commentingCurrent =
    !!commentingBlock && PathApi.equals(blockPath, commentingBlock);

  const open =
    _open ||
    selected ||
    (isCommenting && !!draftCommentNode && commentingCurrent);

  const anchorElement = React.useMemo(() => {
    let activeNode: NodeEntry | undefined;

    if (activeSuggestion) {
      activeNode = suggestionNodes.find(
        ([node]) =>
          TextApi.isText(node) &&
          editor.getApi(SuggestionPlugin).suggestion.nodeId(node) ===
            activeSuggestion.suggestionId
      );
    }
    if (activeCommentId) {
      if (activeCommentId === getDraftCommentKey()) {
        activeNode = draftCommentNode;
      } else {
        activeNode = commentNodes.find(
          ([node]) =>
            editor.getApi(CommentPlugin).comment.nodeId(node) ===
            activeCommentId
        );
      }
    }
    if (!activeNode) return null;

    return editor.api.toDOMNode(activeNode[0])!;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    activeSuggestion,
    activeCommentId,
    editor.api,
    suggestionNodes,
    draftCommentNode,
    commentNodes,
  ]);

  if (suggestionsCount + resolvedDiscussions.length === 0 && !draftCommentNode) {
    console.log('[BlockCommentsContent] EARLY RETURN - No content to show');
    return <div className="w-full">{children}</div>;
  }

  console.log('[BlockCommentsContent] Will render Popover with totalCount:', totalCount);

  return (
    <div className="flex w-full justify-between">
      <Popover
        onOpenChange={(_open_) => {
          if (!_open_ && isCommenting && draftCommentNode) {
            // Only remove draft marks if NOT currently submitting
            // This prevents premature removal during async Convex calls
            if (!isSubmitting) {
              editor.tf.unsetNodes(getDraftCommentKey(), {
                at: [],
                mode: 'lowest',
                match: (n) => n[getDraftCommentKey()],
              });
            }
          }

          setOpen(_open_);
        }}
        open={open}
      >
        <div className="w-full">{children}</div>
        {anchorElement && (
          <PopoverAnchor
            asChild
            className="w-full"
            virtualRef={{ current: anchorElement }}
          />
        )}

        <PopoverContent
          align="center"
          className="max-h-[min(50dvh,calc(-24px+var(--radix-popper-available-height)))] w-[380px] min-w-[130px] max-w-[calc(100vw-24px)] overflow-y-auto p-0 data-[state=closed]:opacity-0"
          onCloseAutoFocus={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          side="bottom"
        >
          {isCommenting ? (
            <CommentCreateForm className="p-4" focusOnMount />
          ) : noneActive ? (
            sortedMergedData.map((item, index) =>
              isResolvedSuggestion(item) ? (
                <BlockSuggestionCard
                  idx={index}
                  isLast={index === sortedMergedData.length - 1}
                  key={item.suggestionId}
                  suggestion={item}
                />
              ) : (
                <BlockComment
                  discussion={item}
                  isLast={index === sortedMergedData.length - 1}
                  key={item.id}
                />
              )
            )
          ) : (
            <>
              {activeSuggestion && (
                <BlockSuggestionCard
                  idx={0}
                  isLast={true}
                  key={activeSuggestion.suggestionId}
                  suggestion={activeSuggestion}
                />
              )}

              {activeDiscussion && (
                <BlockComment discussion={activeDiscussion} isLast={true} />
              )}
            </>
          )}
        </PopoverContent>

        {totalCount > 0 && (() => {
          console.log('[BlockCommentsContent] Rendering trigger button with totalCount:', totalCount);
          return (
          <div className="relative left-0 size-0 select-none">
            <PopoverTrigger asChild>
              <Button
                className="mt-1 ml-1 flex h-6 gap-1 px-1.5 py-0 text-muted-foreground/80 hover:text-muted-foreground/80 data-[active=true]:bg-muted"
                contentEditable={false}
                data-active={open}
                variant="ghost"
              >
                {suggestionsCount > 0 && discussionsCount === 0 && (
                  <PencilLineIcon className="size-4 shrink-0" />
                )}

                {suggestionsCount === 0 && discussionsCount > 0 && (
                  <MessageSquareTextIcon className="size-4 shrink-0" />
                )}

                {suggestionsCount > 0 && discussionsCount > 0 && (
                  <MessagesSquareIcon className="size-4 shrink-0" />
                )}

                <span className="font-semibold text-xs">{totalCount}</span>
              </Button>
            </PopoverTrigger>
          </div>
          );
        })()}
      </Popover>
    </div>
  );
};

function BlockComment({
  discussion,
  isLast,
}: {
  discussion: TDiscussion;
  isLast: boolean;
}): React.ReactElement {
  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <React.Fragment key={discussion.id}>
      <div className="p-4">
        {discussion.comments.map((comment, index) => (
          <Comment
            comment={comment}
            discussionLength={discussion.comments.length}
            documentContent={discussion?.documentContent}
            editingId={editingId}
            index={index}
            key={comment.id ?? index}
            setEditingId={setEditingId}
            showDocumentContent
          />
        ))}
        <CommentCreateForm discussionId={discussion.id} />
      </div>

      {!isLast && <div className="h-px w-full bg-muted" />}
    </React.Fragment>
  );
}

/**
 * Hook to resolve discussion data from context or plugin options.
 * Prefers context data (real-time Convex) over plugin options (for backward compatibility).
 */
const useResolvedDiscussion = (
  commentNodes: NodeEntry<TCommentText>[],
  blockPath: Path
): TDiscussion[] => {
  const { api, getOption, setOption } = useEditorPlugin(commentPlugin);

  // Get discussions from context (real-time Convex data) or fall back to plugin options
  const ctx = useOptionalDiscussionContext();
  const pluginDiscussions = usePluginOption(discussionPlugin, 'discussions');

  // Subscribe to marksInjectedAt to trigger re-render after mark injection
  // This solves the race condition where BlockDiscussion renders before marks exist
  const marksInjectedAt = usePluginOption(discussionPlugin, 'marksInjectedAt');

  // Prefer context discussions (real-time) over plugin options
  const discussions = ctx?.discussions ?? pluginDiscussions;

  console.log('[useResolvedDiscussion] Input:', {
    commentNodesCount: commentNodes.length,
    blockPath,
    hasContext: !!ctx,
    discussionsCount: discussions.length,
    discussions,
    marksInjectedAt,
  });

  // Track comment nodes by their IDs for marks that exist in editor
  useEffect(() => {
    commentNodes.forEach(([node]) => {
      const id = api.comment.nodeId(node);
      const map = getOption('uniquePathMap');

      if (!id) return;

      const previousPath = map.get(id);

      // If there are no comment nodes in the corresponding path in the map, then update it.
      if (PathApi.isPath(previousPath)) {
        const nodes = api.comment.node({ id, at: previousPath });

        if (!nodes) {
          setOption('uniquePathMap', new Map(map).set(id, blockPath));

          return;
        }

        return;
      }

      setOption('uniquePathMap', new Map(map).set(id, blockPath));
    });
  }, [api, blockPath, commentNodes, getOption, setOption]);

  // Build set of discussion IDs that have marks in the editor
  const commentsWithMarks = new Set(
    commentNodes.map(([node]) => api.comment.nodeId(node)).filter(Boolean)
  );

  console.log('[useResolvedDiscussion] commentsWithMarks:', {
    count: commentsWithMarks.size,
    ids: [...commentsWithMarks],
  });

  // Enhanced logging to analyze ID formats
  console.log('[useResolvedDiscussion] commentsWithMarks DETAILED:', {
    count: commentsWithMarks.size,
    idAnalysis: [...commentsWithMarks].filter((id): id is string => id !== undefined).map(id => ({
      id,
      length: id.length,
      isNanoidFormat: id.length === 21 && /^[A-Za-z0-9_-]+$/.test(id) && !id.startsWith('q'),
      isConvexFormat: id.startsWith('q') || id.startsWith('k') || id.startsWith('j'),
    })),
    discussionIdAnalysis: discussions.map((d: TDiscussion) => ({
      id: d.id,
      length: d.id.length,
      isNanoidFormat: d.id.length === 21 && /^[A-Za-z0-9_-]+$/.test(d.id) && !d.id.startsWith('q'),
      isConvexFormat: d.id.startsWith('q') || d.id.startsWith('k') || d.id.startsWith('j'),
    })),
  });

  // NOTE: Removed fallback useEffect that was causing race condition
  // The mark injection (injectCommentMarks) handles positioning correctly
  // Fallback logic was pre-populating uniquePathMap with wrong values before marks were injected

  const filteredDiscussions = discussions
    .map((d: TDiscussion) => ({
      ...d,
      createdAt: new Date(d.createdAt),
    }))
    .filter((item: TDiscussion) => {
      const commentsPathMap = getOption('uniquePathMap');
      const firstBlockPath = commentsPathMap.get(item.id);
      const hasMarkInEditor = commentsWithMarks.has(item.id);
      const hasCommentNode = api.comment.has({ id: item.id });

      console.log('[useResolvedDiscussion] Filtering discussion:', {
        discussionId: item.id,
        isResolved: item.isResolved,
        hasMarkInEditor,
        firstBlockPath,
        currentBlockPath: blockPath,
        pathsEqual: firstBlockPath ? PathApi.equals(firstBlockPath, blockPath) : false,
        hasCommentNode,
      });

      // Skip resolved discussions
      if (item.isResolved) {
        console.log('[useResolvedDiscussion] ❌ Filtered out - resolved');
        return false;
      }

      // If discussion has an editor mark at this block, show it
      // hasMarkInEditor = true means api.comment.nodes({ at: blockPath }) found this ID
      // So we KNOW the mark is on this block - no need to check uniquePathMap
      if (hasMarkInEditor) {
        console.log('[useResolvedDiscussion] ✅ PASSED - mark found at this blockPath');
        return true;
      }

      // For discussions without path mapping, wait for mark injection
      // Don't display at block 0 - marks will be injected and path map will update
      if (!firstBlockPath) {
        console.log('[useResolvedDiscussion] ❌ Filtered out - no mark and no firstBlockPath');
        return false;
      }

      // Show if this block matches the assigned path
      const result = PathApi.equals(firstBlockPath, blockPath);
      console.log('[useResolvedDiscussion]', result ? '✅ PASSED' : '❌ Filtered out - wrong path');
      return result;
    });

  console.log('[useResolvedDiscussion] Final result:', {
    filteredCount: filteredDiscussions.length,
    filteredDiscussions,
  });

  return filteredDiscussions;
};
