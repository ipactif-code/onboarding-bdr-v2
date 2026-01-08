import { QueryCtx, MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";

// ============================================================================
// TYPES
// ============================================================================

/**
 * KB audit log event types that can be rate limited.
 * Must match the eventType union in schema.ts kbAuditLogs table.
 */
type KBAuditEventType = Doc<"kbAuditLogs">["eventType"];

/**
 * Rate limit configuration for a specific action.
 */
interface RateLimitConfig {
  /** Maximum number of actions allowed in the time window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** The eventType in kbAuditLogs that corresponds to this action */
  eventType: KBAuditEventType;
}

/**
 * Rate limit action keys for Knowledge Base mutations.
 */
export type RateLimitAction =
  | "kb.workspace.create"
  | "kb.folder.create"
  | "kb.document.create"
  | "kb.document.updateContent";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Rate limit configurations by action type.
 * Uses kbAuditLogs eventType values for tracking.
 */
const RATE_LIMITS: Record<RateLimitAction, RateLimitConfig> = {
  "kb.workspace.create": {
    limit: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    eventType: "workspace_created",
  },
  "kb.folder.create": {
    limit: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
    eventType: "folder_created",
  },
  "kb.document.create": {
    limit: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    eventType: "document_created",
  },
  "kb.document.updateContent": {
    limit: 300,
    windowMs: 60 * 60 * 1000, // 1 hour
    eventType: "document_content_updated",
  },
};

// ============================================================================
// RATE LIMIT HELPER
// ============================================================================

/**
 * Check rate limit for a user action.
 * Uses kbAuditLogs to count recent actions by the user.
 *
 * @param ctx - Convex query or mutation context
 * @param userId - The user ID to check rate limit for
 * @param action - The rate limit action key
 * @throws ConvexError if rate limit is exceeded with code, message, and retryAfter
 */
export async function checkRateLimit(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  action: RateLimitAction
): Promise<void> {
  const config = RATE_LIMITS[action];
  if (!config) {
    // No rate limit configured for this action - should not happen with typed action
    return;
  }

  const windowStart = Date.now() - config.windowMs;

  // Count recent actions in kbAuditLogs using the by_actor_event index
  // The index is on [actorId, eventType] which allows efficient filtering
  const recentActions = await ctx.db
    .query("kbAuditLogs")
    .withIndex("by_actor_event", (q) =>
      q.eq("actorId", userId).eq("eventType", config.eventType)
    )
    .filter((q) => q.gte(q.field("timestamp"), windowStart))
    .collect();

  if (recentActions.length >= config.limit) {
    // Calculate retry-after time based on oldest action in window
    const timestamps = recentActions.map((a) => a.timestamp).sort((a, b) => a - b);
    // We know timestamps has at least one element because recentActions.length >= config.limit >= 1
    const oldestInWindow = timestamps[0] as number;
    const retryAfterMs = oldestInWindow + config.windowMs - Date.now();
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);

    throw new ConvexError({
      code: "RATE_LIMIT_EXCEEDED",
      message: `Rate limit exceeded for ${action}. Please try again in ${retryAfterMinutes} minute${retryAfterMinutes !== 1 ? "s" : ""}.`,
      retryAfter: retryAfterSeconds,
    });
  }
}

/**
 * Get remaining rate limit allowance for a user action.
 * Useful for displaying rate limit status to users.
 *
 * @param ctx - Convex query or mutation context
 * @param userId - The user ID to check
 * @param action - The rate limit action key
 * @returns Object with remaining count and reset time
 */
export async function getRateLimitStatus(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  action: RateLimitAction
): Promise<{
  remaining: number;
  limit: number;
  resetAt: number;
}> {
  const config = RATE_LIMITS[action];
  if (!config) {
    return {
      remaining: Infinity,
      limit: Infinity,
      resetAt: 0,
    };
  }

  const windowStart = Date.now() - config.windowMs;

  const recentActions = await ctx.db
    .query("kbAuditLogs")
    .withIndex("by_actor_event", (q) =>
      q.eq("actorId", userId).eq("eventType", config.eventType)
    )
    .filter((q) => q.gte(q.field("timestamp"), windowStart))
    .collect();

  const used = recentActions.length;
  const remaining = Math.max(0, config.limit - used);

  // Calculate when the window resets (when the oldest action expires)
  let resetAt = Date.now() + config.windowMs;
  if (recentActions.length > 0) {
    const oldestTimestamp = Math.min(...recentActions.map((a) => a.timestamp));
    resetAt = oldestTimestamp + config.windowMs;
  }

  return {
    remaining,
    limit: config.limit,
    resetAt,
  };
}
