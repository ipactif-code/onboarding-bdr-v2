/**
 * Channel Message Queries - Re-exports
 *
 * Split into:
 * - channelMessageQueries.ts - Core channel message queries (listByChannel, getChannelMessage)
 * - channelThreadQueries.ts - Thread queries (getThread, listThreadsWithActivity)
 * - lessonDiscussionQueries.ts - Lesson-specific discussion queries
 */

// Core channel message queries
export { listByChannel, getChannelMessage } from "./channelMessageQueries";

// Thread queries
export { getThread, listThreadsWithActivity } from "./channelThreadQueries";

// Lesson discussion queries
export { getLessonDiscussion } from "./lessonDiscussionQueries";
