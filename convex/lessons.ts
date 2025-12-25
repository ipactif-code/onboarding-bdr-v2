/**
 * Lesson module - barrel export for backwards compatibility.
 *
 * This file re-exports all lesson-related functions from the modular structure:
 * - queries.ts: get, listByCourse, listBySection
 * - mutations.ts: create, update, updateContent, remove, reorder, setEmbed
 * - quizMutations.ts: updateQuizConfig, addQuestion, updateQuestion, removeQuestion, reorderQuestions
 * - helpers.ts: checkLessonAccess, detectEmbedProvider (internal use only)
 */

// Queries
export { get, listByCourse, listBySection } from "./lessons/queries";

// General mutations
export {
  create,
  update,
  updateContent,
  remove,
  reorder,
  setEmbed,
} from "./lessons/mutations";

// Quiz mutations
export {
  updateQuizConfig,
  addQuestion,
  updateQuestion,
  removeQuestion,
  reorderQuestions,
} from "./lessons/quizMutations";
