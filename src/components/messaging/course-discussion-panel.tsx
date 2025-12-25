// Re-export from the refactored module for backward compatibility
// All functionality has been split into smaller files under ./course-discussion/

export {
  CourseDiscussionPanel,
  CourseDiscussionPanelSkeleton,
} from "./course-discussion";

export type {
  CourseDiscussionPanelProps,
  DiscussionMessage,
} from "./course-discussion";
