// Knowledge Base hooks
// Central export for Knowledge Base document management hooks

export { useAutoSave } from "./use-auto-save";
export type { UseAutoSaveOptions, UseAutoSaveReturn } from "./use-auto-save";

export { useDocument } from "./use-document";
export type {
  UseDocumentOptions,
  UseDocumentReturn,
  DocumentMetadata,
  DocumentContent,
} from "./use-document";

export { useRecordAccess } from "./use-record-access";
export type { UseRecordAccessOptions } from "./use-record-access";

export { useCollaboration } from "./use-collaboration";
export type {
  UseCollaborationOptions,
  UseCollaborationReturn,
  CollaborationConfig,
  ConnectionStatus,
} from "./use-collaboration";

// Collaboration configuration hook (extracted from editor)
export { useCollaborationConfig } from "./use-collaboration-config";
export type {
  UseCollaborationConfigOptions,
  UseCollaborationConfigReturn,
  CollaborationConfigData,
  CollaborationConnectionStatus,
  CollaborationState,
} from "./use-collaboration-config";

// Editor save hook (extracted from editor)
export { useEditorSave, extractTextFromSlate, countWords } from "./use-editor-save";
export type {
  UseEditorSaveOptions,
  UseEditorSaveReturn,
  SaveStatus,
} from "./use-editor-save";
export {
  SAVE_STATUS_DISPLAY_MS,
  COLLAB_SAVE_DEBOUNCE_MS,
  COLLAB_SAVE_MAX_WAIT_MS,
  STANDALONE_SAVE_DEBOUNCE_MS,
  STANDALONE_SAVE_MAX_WAIT_MS,
} from "./use-editor-save";

// Hocuspocus provider hook (extracted from editor)
export { useHocuspocusProvider } from "./use-hocuspocus-provider";
export type {
  UseHocuspocusProviderOptions,
  UseHocuspocusProviderReturn,
  HocuspocusConnectionStatus,
} from "./use-hocuspocus-provider";
export {
  TOKEN_REFRESH_INTERVAL_MS,
  CONNECTION_TIMEOUT_MS,
} from "./use-hocuspocus-provider";

// Comments hook (for document commenting system)
export { useComments, useCommentReplies, useCommentDetail } from "./use-comments";
export type {
  UseCommentsOptions,
  UseCommentsReturn,
  CommentListItem,
  CommentDetail,
  CommentReply,
  CommentAuthor,
  ReactionGroup,
  CommentMention,
  UnreadMention,
  CreateCommentArgs,
} from "./use-comments";

// Current user hook (for Plate.js collaboration)
export { useCurrentUser } from "./use-current-user";
export type { PlateUser, UseCurrentUserReturn } from "./use-current-user";

// KB Discussions hook (transforms Convex comments to Plate.js TDiscussion format)
export {
  useKBDiscussions,
  useTransformToDiscussion,
  normalizeContent,
  transformToTComment,
  transformToDiscussion,
} from "./use-kb-discussions";
export type {
  TComment,
  TDiscussion,
  UseKBDiscussionsOptions,
  UseKBDiscussionsReturn,
} from "./use-kb-discussions";

// Search hook (for Knowledge Base document search)
export { useSearch } from "./use-search";
export type {
  SearchMode,
  SearchFilters,
  SearchResult,
  QuickSearchResult,
  SearchSuggestion,
  RecentSearch,
  SearchResponse,
  UseSearchOptions,
  UseSearchReturn,
} from "./use-search";
