/**
 * Praiz Pipeline - Validation Workflow Contract
 *
 * Types and interfaces for the human validation workflow.
 * Manages the approval/rejection process for extracted objections.
 *
 * @module contracts/validation
 */

import type { ObjectionEntry, RaccResponse, ValidationStatus } from "./objection-library";

// ============================================================================
// Constants
// ============================================================================

export const VALIDATION_ACTIONS = [
  "approve",
  "reject",
  "edit",
  "archive",
  "restore",
] as const;

export const ALLOWED_VALIDATOR_ROLES = ["admin", "sales_enablement_manager"] as const;

// ============================================================================
// Types
// ============================================================================

export type ValidationAction = (typeof VALIDATION_ACTIONS)[number];
export type ValidatorRole = (typeof ALLOWED_VALIDATOR_ROLES)[number];

// ============================================================================
// Validation Queue Types
// ============================================================================

/** Item in the validation queue */
export interface ValidationQueueItem {
  /** Objection entry data */
  objection: ObjectionEntry;
  /** Position in queue (by extractedAt) */
  position: number;
  /** Time in queue (milliseconds) */
  timeInQueue: number;
  /** Confidence category */
  confidenceCategory: "high" | "medium" | "low";
  /** Whether RACC response needs completion */
  needsRaccCompletion: boolean;
}

/** Validation queue filters */
export interface ValidationQueueFilters {
  /** Filter by confidence category */
  confidenceCategory?: "high" | "medium" | "low";
  /** Filter by RACC completion status */
  needsRaccCompletion?: boolean;
  /** Filter by language */
  language?: string;
  /** Filter by module */
  dilitrustModule?: string;
  /** Filter by category */
  category?: string;
}

/** Validation queue sort options */
export interface ValidationQueueSort {
  field: "extractedAt" | "extractionConfidence" | "timeInQueue";
  direction: "asc" | "desc";
}

/** Complete queue query */
export interface ValidationQueueQuery {
  filters?: ValidationQueueFilters;
  sort?: ValidationQueueSort;
  limit?: number;
  cursor?: string;
}

/** Queue statistics */
export interface ValidationQueueStats {
  /** Total pending validations */
  totalPending: number;
  /** Pending with high confidence (flagged for optional review) */
  highConfidencePending: number;
  /** Pending with medium confidence (requires validation) */
  mediumConfidencePending: number;
  /** Pending needing RACC completion */
  needingRaccCompletion: number;
  /** Average time in queue (milliseconds) */
  avgTimeInQueue: number;
  /** Oldest item age (milliseconds) */
  oldestItemAge: number;
}

// ============================================================================
// Validation Action Types
// ============================================================================

/** Input for approval action */
export interface ApproveInput {
  objectionId: string;
  /** Optional note from validator */
  note?: string;
}

/** Input for rejection action */
export interface RejectInput {
  objectionId: string;
  /** Required reason for rejection */
  reason: string;
}

/** Input for edit action */
export interface EditInput {
  objectionId: string;
  /** Updated verbatim text */
  verbatim?: string;
  /** Updated variants */
  verbatimVariants?: string[];
  /** Updated category */
  category?: string;
  /** Updated persona types */
  personaTypes?: string[];
  /** Updated scenario types */
  scenarioTypes?: string[];
  /** Updated or completed RACC response */
  raccResponse?: RaccResponse;
}

/** Input for archive action */
export interface ArchiveInput {
  objectionId: string;
  /** Reason for archiving (e.g., "stale", "duplicate", "incorrect") */
  reason: string;
}

/** Input for restore action */
export interface RestoreInput {
  objectionId: string;
}

// ============================================================================
// Audit Trail Types
// ============================================================================

/** Validation action record */
export interface ValidationActionRecord {
  /** Convex document ID */
  _id: string;
  /** Objection ID that was acted upon */
  objectionId: string;
  /** User who performed the action */
  userId: string;
  /** Action type */
  action: ValidationAction;
  /** Previous state snapshot (for edits) */
  previousState?: Partial<ObjectionEntry>;
  /** New state snapshot (for edits) */
  newState?: Partial<ObjectionEntry>;
  /** Fields that were edited */
  editedFields?: string[];
  /** Rejection reason (for rejections) */
  rejectionReason?: string;
  /** Action timestamp */
  timestamp: number;
}

/** Validation history for an objection */
export interface ValidationHistory {
  objectionId: string;
  actions: ValidationActionRecord[];
  totalActions: number;
  lastActionAt?: number;
  lastActionBy?: string;
}

// ============================================================================
// Validator Types
// ============================================================================

/** Validator user info */
export interface Validator {
  /** User ID */
  userId: string;
  /** User name */
  name: string;
  /** User role */
  role: ValidatorRole;
  /** Avatar URL */
  avatarUrl?: string;
}

/** Validator statistics */
export interface ValidatorStats {
  /** Validator info */
  validator: Validator;
  /** Total validations performed */
  totalValidations: number;
  /** Approvals count */
  approvals: number;
  /** Rejections count */
  rejections: number;
  /** Edits count */
  edits: number;
  /** Average time to validate (milliseconds) */
  avgValidationTime: number;
  /** Validations in last 24 hours */
  last24Hours: number;
  /** Validations in last 7 days */
  last7Days: number;
}

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Determine confidence category
 */
export function getConfidenceCategory(
  confidence: number
): "high" | "medium" | "low" {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.7) return "medium";
  return "low";
}

/**
 * Calculate time in queue
 */
export function calculateTimeInQueue(extractedAt: number): number {
  return Date.now() - extractedAt;
}

/**
 * Check if user can validate
 */
export function canValidate(userRole: string): boolean {
  return ALLOWED_VALIDATOR_ROLES.includes(userRole as ValidatorRole);
}

/**
 * Create validation queue item from objection
 */
export function toQueueItem(
  objection: ObjectionEntry,
  position: number
): ValidationQueueItem {
  return {
    objection,
    position,
    timeInQueue: calculateTimeInQueue(objection.extractedAt),
    confidenceCategory: getConfidenceCategory(objection.extractionConfidence),
    needsRaccCompletion: !objection.raccResponse ||
      !objection.raccResponse.reframe ||
      !objection.raccResponse.address ||
      !objection.raccResponse.confirm ||
      !objection.raccResponse.close,
  };
}

/**
 * Sort queue items
 */
export function sortQueueItems(
  items: ValidationQueueItem[],
  sort: ValidationQueueSort
): ValidationQueueItem[] {
  return [...items].sort((a, b) => {
    let comparison: number;

    switch (sort.field) {
      case "extractedAt":
        comparison = a.objection.extractedAt - b.objection.extractedAt;
        break;
      case "extractionConfidence":
        comparison = a.objection.extractionConfidence - b.objection.extractionConfidence;
        break;
      case "timeInQueue":
        comparison = a.timeInQueue - b.timeInQueue;
        break;
      default:
        comparison = 0;
    }

    return sort.direction === "asc" ? comparison : -comparison;
  });
}

/**
 * Filter queue items
 */
export function filterQueueItems(
  items: ValidationQueueItem[],
  filters: ValidationQueueFilters
): ValidationQueueItem[] {
  return items.filter((item) => {
    if (filters.confidenceCategory &&
        item.confidenceCategory !== filters.confidenceCategory) {
      return false;
    }
    if (filters.needsRaccCompletion !== undefined &&
        item.needsRaccCompletion !== filters.needsRaccCompletion) {
      return false;
    }
    if (filters.language &&
        item.objection.language !== filters.language) {
      return false;
    }
    if (filters.dilitrustModule &&
        item.objection.dilitrustModule !== filters.dilitrustModule) {
      return false;
    }
    if (filters.category &&
        item.objection.category !== filters.category) {
      return false;
    }
    return true;
  });
}

/**
 * Calculate queue statistics
 */
export function calculateQueueStats(
  items: ValidationQueueItem[]
): ValidationQueueStats {
  const totalPending = items.length;
  const highConfidencePending = items.filter(
    (i) => i.confidenceCategory === "high"
  ).length;
  const mediumConfidencePending = items.filter(
    (i) => i.confidenceCategory === "medium"
  ).length;
  const needingRaccCompletion = items.filter(
    (i) => i.needsRaccCompletion
  ).length;

  const times = items.map((i) => i.timeInQueue);
  const avgTimeInQueue = times.length > 0
    ? times.reduce((a, b) => a + b, 0) / times.length
    : 0;
  const oldestItemAge = times.length > 0 ? Math.max(...times) : 0;

  return {
    totalPending,
    highConfidencePending,
    mediumConfidencePending,
    needingRaccCompletion,
    avgTimeInQueue,
    oldestItemAge,
  };
}

/**
 * Validate edit input
 */
export function validateEditInput(input: EditInput): string[] {
  const errors: string[] = [];

  // At least one field must be edited
  const hasEdits =
    input.verbatim !== undefined ||
    input.verbatimVariants !== undefined ||
    input.category !== undefined ||
    input.personaTypes !== undefined ||
    input.scenarioTypes !== undefined ||
    input.raccResponse !== undefined;

  if (!hasEdits) {
    errors.push("At least one field must be edited");
  }

  // RACC response must be complete if provided
  if (input.raccResponse) {
    if (!input.raccResponse.reframe) {
      errors.push("RACC reframe is required");
    }
    if (!input.raccResponse.address) {
      errors.push("RACC address is required");
    }
    if (!input.raccResponse.confirm) {
      errors.push("RACC confirm is required");
    }
    if (!input.raccResponse.close) {
      errors.push("RACC close is required");
    }
  }

  return errors;
}

/**
 * Create action record
 */
export function createActionRecord(
  objectionId: string,
  userId: string,
  action: ValidationAction,
  details?: {
    previousState?: Partial<ObjectionEntry>;
    newState?: Partial<ObjectionEntry>;
    editedFields?: string[];
    rejectionReason?: string;
  }
): Omit<ValidationActionRecord, "_id"> {
  return {
    objectionId,
    userId,
    action,
    previousState: details?.previousState,
    newState: details?.newState,
    editedFields: details?.editedFields,
    rejectionReason: details?.rejectionReason,
    timestamp: Date.now(),
  };
}

/**
 * Get status after action
 */
export function getStatusAfterAction(
  currentStatus: ValidationStatus,
  action: ValidationAction
): ValidationStatus {
  switch (action) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "archive":
      return "archived";
    case "restore":
      return "pending"; // Restored items go back to pending
    case "edit":
      return currentStatus; // Edit doesn't change status
  }
}

/**
 * Format validation action for display
 */
export function formatActionForDisplay(
  record: ValidationActionRecord,
  validatorName: string
): string {
  const date = new Date(record.timestamp).toLocaleDateString();

  switch (record.action) {
    case "approve":
      return `${validatorName} approved on ${date}`;
    case "reject":
      return `${validatorName} rejected on ${date}: ${record.rejectionReason}`;
    case "edit":
      const fields = record.editedFields?.join(", ") || "unknown fields";
      return `${validatorName} edited ${fields} on ${date}`;
    case "archive":
      return `${validatorName} archived on ${date}`;
    case "restore":
      return `${validatorName} restored on ${date}`;
  }
}
