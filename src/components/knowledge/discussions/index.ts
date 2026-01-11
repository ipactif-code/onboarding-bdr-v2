// Knowledge Base Discussions Components
// Central export for discussion-related components and hooks
// Bridges Convex data with Plate.js discussion plugin

// DiscussionProvider - Context provider for Plate.js discussions
export {
  DiscussionProvider,
  useDiscussionContext,
  useOptionalDiscussionContext,
} from "./discussion-provider";

export type {
  DiscussionContextValue,
  DiscussionProviderProps,
  UsersRecord,
} from "./discussion-provider";
