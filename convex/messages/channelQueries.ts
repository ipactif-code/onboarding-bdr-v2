/**
 * Channel Message Queries - Re-exports
 *
 * Split into:
 * - channelMessageQueries.ts - Core channel message queries
 * - lessonDiscussionQueries.ts - Lesson-specific discussion queries
 */

// Core channel message queries
export { listByChannel, getChannelMessage } from "./channelMessageQueries";

// Lesson discussion queries
export { getLessonDiscussion } from "./lessonDiscussionQueries";
