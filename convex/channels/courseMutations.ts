/**
 * Course Channel Internal Mutations - Re-exports
 *
 * These mutations are called internally when courses are published/updated
 * and when users are assigned/unassigned to courses.
 * Split into:
 * - courseChannelCreation.ts - Channel creation
 * - courseEnrollmentSync.ts - Enrollment sync
 * - courseInstructorAdmin.ts - Instructor admin privileges
 */

// Channel creation
export { createCourseChannel } from "./courseChannelCreation";

// Enrollment sync
export { addCourseEnrollee, removeCourseEnrollee } from "./courseEnrollmentSync";

// Instructor admin
export { notifyInstructors, grantCourseInstructorAdmin } from "./courseInstructorAdmin";
