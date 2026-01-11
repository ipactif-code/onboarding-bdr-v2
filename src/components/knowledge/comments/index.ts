// Knowledge Base Comments Components
// Central export for comment-related UI components

// CommentThread - Display a comment with replies, reactions, and actions
export { CommentThread, CommentThreadSkeleton } from "./comment-thread";

// InlineComment - Marker for inline comments in editor
export { InlineComment, InlineCommentHighlight } from "./inline-comment";
export type {
  InlineCommentProps,
  InlineCommentHighlightProps,
} from "./inline-comment";

// CommentInput - Input with @mention autocomplete
export { CommentInput, CommentInputSkeleton } from "./comment-input";
export type { CommentInputProps } from "./comment-input";

// CommentSidebar - Panel showing all comments for a document
export {
  CommentSidebar,
  CommentSidebarSkeleton,
  CommentSidebarToggle,
} from "./comment-sidebar";
export type {
  CommentSidebarProps,
  CommentSidebarToggleProps,
} from "./comment-sidebar";
