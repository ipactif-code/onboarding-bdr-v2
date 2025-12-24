/**
 * Channel module - Re-exports from modular structure.
 *
 * This file maintains backwards compatibility by re-exporting all
 * channel-related functionality from the new modular structure.
 *
 * @see convex/channels/queries.ts - Query functions
 * @see convex/channels/mutations.ts - Channel CRUD mutations
 * @see convex/channels/memberManagement.ts - Member management mutations
 * @see convex/channels/types.ts - Shared type validators
 */

export * from "./channels/index";
