# Phase 15 - Channel Administration: Task Breakdown

**Feature**: Channel Administration (Role Management, Mute/Ban, Message Moderation, History Export)
**Total Tasks**: 35 atomic tasks
**Estimated Duration**: 2-3 days

---

## Phase 1: Schema Enhancement

### T165-1: Add Audit Fields to channelMembers Schema
**Agent**: `schema-architect`
**File**: `convex/schema.ts`
**Size**: S (~30 min)
**Dependencies**: None
**Parallel**: ✅

**Objective**: Add moderation audit trail fields to channelMembers table.

**Changes Required**:
```typescript
channelMembers: defineTable({
  // ... existing fields ...
  isMuted: v.boolean(),
  mutedUntil: v.optional(v.number()),
  isBanned: v.boolean(),
  // ADD THESE FIELDS:
  bannedAt: v.optional(v.number()),      // Timestamp when ban occurred
  mutedBy: v.optional(v.id("users")),    // Who issued the mute
  bannedBy: v.optional(v.id("users")),   // Who issued the ban
  // ... rest of fields ...
})
```

**Acceptance Criteria**:
- [ ] bannedAt field added (optional number)
- [ ] mutedBy field added (optional user ID)
- [ ] bannedBy field added (optional user ID)
- [ ] TypeScript compiles without errors
- [ ] Schema validation passes

---

### T165-2: Add Moderation Indexes to Schema
**Agent**: `schema-architect`
**File**: `convex/schema.ts`
**Size**: S (~20 min)
**Dependencies**: T165-1
**Parallel**: ❌

**Objective**: Add indexes for efficient moderation queries.

**Changes Required**:
```typescript
channelMembers: defineTable({
  // ... fields ...
})
  .index("by_channel", ["channelId"])
  .index("by_user", ["userId"])
  .index("by_channel_user", ["channelId", "userId"])
  .index("by_user_active", ["userId", "leftAt"])
  .index("by_user_favorite", ["userId", "isFavorite"])
  // ADD THESE INDEXES:
  .index("by_channel_muted", ["channelId", "isMuted"])
  .index("by_channel_banned", ["channelId", "isBanned"])
```

**Acceptance Criteria**:
- [ ] by_channel_muted index added
- [ ] by_channel_banned index added
- [ ] Indexes used in moderation queries (verified in later tasks)
- [ ] TypeScript compiles without errors

---

### T165-3: Verify Existing updateMemberRole Mutation
**Agent**: `backend-engineer`
**File**: `convex/channels/memberManagement.ts` (read-only verification)
**Size**: XS (~15 min)
**Dependencies**: None
**Parallel**: ✅

**Objective**: Verify that updateMemberRole mutation already exists and works correctly.

**Verification Checklist**:
- [ ] Mutation exists in `convex/channels/memberManagement.ts` (lines 220-299)
- [ ] Enforces owner/global-admin-only permission
- [ ] Validates role transitions (cannot change owner role)
- [ ] Prevents self-demotion
- [ ] Returns `v.null()`
- [ ] Has JSDoc comment
- [ ] No changes needed - already implemented

**Output**: Written report confirming implementation status.

---

### T165-4: Update updateMemberRole JSDoc
**Agent**: `backend-engineer`
**File**: `convex/channels/memberManagement.ts`
**Size**: XS (~10 min)
**Dependencies**: T165-3
**Parallel**: ❌

**Objective**: Add FR-038 reference to existing updateMemberRole mutation JSDoc.

**Changes Required**:
```typescript
/**
 * Update a member's role in a channel.
 * Only channel owner or global admin can change roles.
 * Cannot change the owner role (must use transferOwnership).
 * Cannot demote self.
 *
 * FR-038: Channel admin role management
 *
 * @param channelId - Target channel
 * @param userId - Member to update
 * @param newRole - New role (admin, moderator, or member)
 */
export const updateMemberRole = mutation({
  // ... existing implementation ...
});
```

**Acceptance Criteria**:
- [ ] JSDoc includes FR-038 reference
- [ ] JSDoc describes permission requirements
- [ ] JSDoc includes @param tags
- [ ] No logic changes to mutation

---

### T165-5: Create Moderation Validators
**Agent**: `typescript-expert`
**File**: `convex/channels/types.ts`
**Size**: S (~30 min)
**Dependencies**: T165-1
**Parallel**: ✅

**Objective**: Create Convex validators for moderation actions.

**Code to Add**:
```typescript
import { v } from "convex/values";

// Mute duration bounds
export const MIN_MUTE_DURATION_MS = 60 * 60 * 1000; // 1 hour
export const MAX_MUTE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Validator for mute member action.
 */
export const muteMemberArgsValidator = v.object({
  channelId: v.id("channels"),
  userId: v.id("users"),
  durationMs: v.number(),
  reason: v.optional(v.string()),
});

/**
 * Validator for ban member action.
 */
export const banMemberArgsValidator = v.object({
  channelId: v.id("channels"),
  userId: v.id("users"),
  reason: v.optional(v.string()),
});

/**
 * Validator for member with moderation status.
 */
export const memberWithModerationValidator = v.object({
  _id: v.id("channelMembers"),
  userId: v.id("users"),
  userName: v.string(),
  userEmail: v.string(),
  userAvatarUrl: v.optional(v.string()),
  userStatus: v.union(
    v.literal("online"),
    v.literal("offline"),
    v.literal("away"),
    v.literal("dnd")
  ),
  role: v.union(
    v.literal("owner"),
    v.literal("admin"),
    v.literal("moderator"),
    v.literal("member")
  ),
  joinedAt: v.number(),
  isMuted: v.boolean(),
  mutedUntil: v.optional(v.number()),
  mutedBy: v.optional(v.id("users")),
  isBanned: v.boolean(),
  bannedAt: v.optional(v.number()),
  bannedBy: v.optional(v.id("users")),
});
```

**Acceptance Criteria**:
- [ ] All validators exported
- [ ] Constants for min/max mute duration defined
- [ ] muteMemberArgsValidator includes duration and reason
- [ ] banMemberArgsValidator includes reason
- [ ] memberWithModerationValidator includes all audit fields
- [ ] TypeScript compiles without errors

---

## Phase 2: Backend - Moderation Mutations

### T166-1: Create muteMember Mutation
**Agent**: `backend-engineer`
**File**: `convex/channels/memberManagement.ts`
**Size**: M (~90 min)
**Dependencies**: T165-2, T165-5
**Parallel**: ❌

**Objective**: Implement mutation to mute a channel member (FR-038).

**Implementation Specification**:
```typescript
import { muteMemberArgsValidator, MIN_MUTE_DURATION_MS, MAX_MUTE_DURATION_MS } from "./types";

/**
 * Mute a member in a channel, preventing them from sending messages.
 * Moderators and above can mute members.
 * Cannot mute owners or global admins.
 * Mute duration: 1 hour - 30 days.
 *
 * FR-038: Channel moderation - mute members
 */
export const muteMember = mutation({
  args: muteMemberArgsValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // 1. Validate duration bounds
    if (args.durationMs < MIN_MUTE_DURATION_MS || args.durationMs > MAX_MUTE_DURATION_MS) {
      throw new Error("Mute duration must be between 1 hour and 30 days");
    }

    // 2. Get channel and verify exists
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // 3. Get caller membership
    const callerMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    // 4. Check permissions (moderator+)
    const hasPermission =
      user.role === "admin" || // Global admin
      (callerMembership &&
        !callerMembership.leftAt &&
        !callerMembership.isBanned &&
        (callerMembership.role === "owner" ||
          callerMembership.role === "admin" ||
          callerMembership.role === "moderator"));

    if (!hasPermission) {
      throw new Error("Forbidden: Moderator role or higher required to mute members");
    }

    // 5. Get target membership
    const targetMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (!targetMembership) {
      throw new Error("User is not a member of this channel");
    }

    // 6. Validate target is not protected
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    // Cannot mute global admins
    if (targetUser.role === "admin") {
      throw new Error("Cannot mute global administrators");
    }

    // Cannot mute channel owner
    if (targetMembership.role === "owner") {
      throw new Error("Cannot mute channel owner");
    }

    // Cannot mute self
    if (args.userId === user._id) {
      throw new Error("Cannot mute yourself");
    }

    // 7. Check if already muted
    if (targetMembership.isMuted && targetMembership.mutedUntil && targetMembership.mutedUntil > Date.now()) {
      throw new Error("User is already muted");
    }

    // 8. Calculate mute expiration
    const now = Date.now();
    const mutedUntil = now + args.durationMs;

    // 9. Apply mute
    await ctx.db.patch(targetMembership._id, {
      isMuted: true,
      mutedUntil,
      mutedBy: user._id,
    });

    return null;
  },
});
```

**Acceptance Criteria**:
- [ ] Mutation enforces moderator+ permission
- [ ] Validates duration bounds (1 hour - 30 days)
- [ ] Cannot mute owner or global admins
- [ ] Cannot mute self
- [ ] Populates mutedBy audit field
- [ ] Sets mutedUntil timestamp
- [ ] Throws error if already muted
- [ ] JSDoc includes FR-038 reference
- [ ] Unit tests pass (created in T174-1)

---

### T166-2: Create unmuteMember Mutation
**Agent**: `backend-engineer`
**File**: `convex/channels/memberManagement.ts`
**Size**: M (~60 min)
**Dependencies**: T166-1
**Parallel**: ❌

**Objective**: Implement mutation to unmute a channel member (FR-038).

**Implementation Specification**:
```typescript
/**
 * Unmute a member in a channel, restoring their ability to send messages.
 * Moderators can unmute members they muted.
 * Admins and owners can unmute anyone.
 *
 * FR-038: Channel moderation - unmute members
 */
export const unmuteMember = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // 1. Get channel
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // 2. Get caller membership
    const callerMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    // 3. Get target membership
    const targetMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (!targetMembership) {
      throw new Error("User is not a member of this channel");
    }

    if (!targetMembership.isMuted) {
      throw new Error("User is not muted");
    }

    // 4. Check permissions
    // - Global admin: always allowed
    // - Owner/admin: always allowed
    // - Moderator: only if they issued the mute
    const isGlobalAdmin = user.role === "admin";
    const isOwnerOrAdmin =
      callerMembership &&
      !callerMembership.leftAt &&
      (callerMembership.role === "owner" || callerMembership.role === "admin");
    const isModeratorWhoMuted =
      callerMembership &&
      !callerMembership.leftAt &&
      callerMembership.role === "moderator" &&
      targetMembership.mutedBy?.toString() === user._id.toString();

    if (!isGlobalAdmin && !isOwnerOrAdmin && !isModeratorWhoMuted) {
      throw new Error(
        "Forbidden: Only the moderator who issued the mute, or channel admins, can unmute"
      );
    }

    // 5. Remove mute
    await ctx.db.patch(targetMembership._id, {
      isMuted: false,
      mutedUntil: undefined,
      // Keep mutedBy for audit trail
    });

    return null;
  },
});
```

**Acceptance Criteria**:
- [ ] Moderators can only unmute members they muted
- [ ] Admins/owners can unmute anyone
- [ ] Global admins can unmute anyone
- [ ] Throws error if user not muted
- [ ] Clears isMuted and mutedUntil
- [ ] Preserves mutedBy for audit trail
- [ ] JSDoc includes FR-038 reference
- [ ] Unit tests pass (created in T174-1)

---

### T167-1: Create banMember Mutation
**Agent**: `backend-engineer`
**File**: `convex/channels/memberManagement.ts`
**Size**: M (~90 min)
**Dependencies**: T165-2, T165-5
**Parallel**: ✅ (parallel with T166-1)

**Objective**: Implement mutation to ban a channel member (FR-038).

**Implementation Specification**:
```typescript
import { banMemberArgsValidator } from "./types";

/**
 * Ban a member from a channel, preventing all access.
 * Admins and above can ban members.
 * Cannot ban owners or global admins.
 * Banned users cannot rejoin without being unbanned first.
 *
 * FR-038: Channel moderation - ban members
 */
export const banMember = mutation({
  args: banMemberArgsValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // 1. Get channel
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // 2. Get caller membership
    const callerMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    // 3. Check permissions (admin+, moderators cannot ban)
    const hasPermission =
      user.role === "admin" || // Global admin
      (callerMembership &&
        !callerMembership.leftAt &&
        !callerMembership.isBanned &&
        (callerMembership.role === "owner" || callerMembership.role === "admin"));

    if (!hasPermission) {
      throw new Error("Forbidden: Channel admin role or higher required to ban members");
    }

    // 4. Get target membership
    const targetMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (!targetMembership) {
      throw new Error("User is not a member of this channel");
    }

    // 5. Validate target is not protected
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    // Cannot ban global admins
    if (targetUser.role === "admin") {
      throw new Error("Cannot ban global administrators");
    }

    // Cannot ban channel owner
    if (targetMembership.role === "owner") {
      throw new Error("Cannot ban channel owner");
    }

    // Cannot ban self
    if (args.userId === user._id) {
      throw new Error("Cannot ban yourself");
    }

    // Non-owner channel admins cannot ban other admins
    if (
      targetMembership.role === "admin" &&
      callerMembership?.role !== "owner" &&
      user.role !== "admin"
    ) {
      throw new Error("Only channel owner or global admin can ban other channel admins");
    }

    // 6. Check if already banned
    if (targetMembership.isBanned) {
      throw new Error("User is already banned from this channel");
    }

    // 7. Apply ban
    const now = Date.now();
    await ctx.db.patch(targetMembership._id, {
      isBanned: true,
      bannedAt: now,
      bannedBy: user._id,
    });

    // 8. Update member count (banned users don't count as active members)
    await ctx.db.patch(args.channelId, {
      memberCount: Math.max(0, channel.memberCount - 1),
    });

    return null;
  },
});
```

**Acceptance Criteria**:
- [ ] Mutation enforces admin+ permission (moderators cannot ban)
- [ ] Cannot ban owner or global admins
- [ ] Cannot ban self
- [ ] Cannot ban other admins unless caller is owner/global admin
- [ ] Populates bannedAt and bannedBy audit fields
- [ ] Updates channel memberCount
- [ ] Throws error if already banned
- [ ] JSDoc includes FR-038 reference
- [ ] Unit tests pass (created in T174-1)

---

### T167-2: Create unbanMember Mutation
**Agent**: `backend-engineer`
**File**: `convex/channels/memberManagement.ts`
**Size**: M (~60 min)
**Dependencies**: T167-1
**Parallel**: ❌

**Objective**: Implement mutation to unban a channel member (FR-038).

**Implementation Specification**:
```typescript
/**
 * Unban a member from a channel, restoring their access.
 * Admins and above can unban members.
 *
 * FR-038: Channel moderation - unban members
 */
export const unbanMember = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // 1. Get channel
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // 2. Get caller membership
    const callerMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    // 3. Check permissions (admin+)
    const hasPermission =
      user.role === "admin" || // Global admin
      (callerMembership &&
        !callerMembership.leftAt &&
        !callerMembership.isBanned &&
        (callerMembership.role === "owner" || callerMembership.role === "admin"));

    if (!hasPermission) {
      throw new Error("Forbidden: Channel admin role or higher required to unban members");
    }

    // 4. Get target membership
    const targetMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (!targetMembership) {
      throw new Error("User is not a member of this channel");
    }

    if (!targetMembership.isBanned) {
      throw new Error("User is not banned from this channel");
    }

    // 5. Remove ban
    await ctx.db.patch(targetMembership._id, {
      isBanned: false,
      // Keep bannedAt and bannedBy for audit trail
    });

    // 6. Update member count (user is now active again)
    await ctx.db.patch(args.channelId, {
      memberCount: channel.memberCount + 1,
    });

    return null;
  },
});
```

**Acceptance Criteria**:
- [ ] Mutation enforces admin+ permission
- [ ] Throws error if user not banned
- [ ] Clears isBanned flag
- [ ] Preserves bannedAt and bannedBy for audit trail
- [ ] Updates channel memberCount
- [ ] JSDoc includes FR-038 reference
- [ ] Unit tests pass (created in T174-1)

---

### T168-1: Enhance getMembers Query with Pagination
**Agent**: `backend-engineer`
**File**: `convex/channels/queries.ts`
**Size**: M (~75 min)
**Dependencies**: None
**Parallel**: ✅ (parallel with T166-1, T167-1)

**Objective**: Add pagination support to existing getMembers query.

**Changes Required**:
```typescript
import { paginationOptsValidator } from "convex/server";

/**
 * Get all active members of a channel with user information.
 * Returns members sorted by role (owner first) then by name.
 * Supports pagination for channels with many members.
 *
 * Access Control:
 * - User must have access to the channel (via canAccessChannel)
 * - Throws error if user doesn't have access
 *
 * Returns:
 * - Active members only (no leftAt, not banned)
 * - Includes user information (name, email, avatar, status)
 * - Sorted by role hierarchy (owner > admin > moderator > member)
 * - Paginated results (max 50 per page)
 */
export const getMembers = query({
  args: {
    channelId: v.id("channels"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(memberInfoValidator),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check if user can access the channel
    const hasAccess = await canAccessChannel(ctx, args.channelId, user._id);
    if (!hasAccess) {
      throw new Error("Forbidden: You do not have access to this channel");
    }

    // Get paginated members
    const result = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .paginate(args.paginationOpts);

    // Filter to active members only (no leftAt, not banned)
    const activeMembers = result.page.filter(
      (m) => m.leftAt === undefined && !m.isBanned
    );

    // Fetch user info for each member
    const membersWithUserInfo = await Promise.all(
      activeMembers.map(async (membership) => {
        const memberUser = await ctx.db.get(membership.userId);
        if (!memberUser) {
          return null;
        }
        return {
          _id: membership._id,
          userId: membership.userId,
          userName: memberUser.name,
          userEmail: memberUser.email,
          userAvatarUrl: memberUser.avatarUrl,
          userStatus: memberUser.status,
          role: membership.role,
          joinedAt: membership.joinedAt,
        };
      })
    );

    // Filter out any null results (deleted users)
    const validMembers = membersWithUserInfo.filter(
      (m): m is NonNullable<typeof m> => m !== null
    );

    // Sort by role hierarchy (owner first), then by name
    type ChannelRole = "owner" | "admin" | "moderator" | "member";
    const roleOrder: Record<ChannelRole, number> = {
      owner: 0,
      admin: 1,
      moderator: 2,
      member: 3,
    };

    validMembers.sort((a, b) => {
      const aOrder = isChannelRole(a.role) ? roleOrder[a.role] : roleOrder.member;
      const bOrder = isChannelRole(b.role) ? roleOrder[b.role] : roleOrder.member;
      const roleCompare = aOrder - bOrder;
      if (roleCompare !== 0) {
        return roleCompare;
      }
      return a.userName.localeCompare(b.userName);
    });

    return {
      page: validMembers,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
```

**Acceptance Criteria**:
- [ ] Query accepts paginationOpts argument
- [ ] Returns paginated result with continueCursor
- [ ] Filters active members only (no leftAt, not banned)
- [ ] Sorted by role hierarchy, then name
- [ ] Max 50 members per page (default pagination size)
- [ ] Backwards compatible (can be used without pagination in frontend)
- [ ] JSDoc updated with pagination details
- [ ] TypeScript compiles without errors

---

### T168-2: Create getMembershipDetails Query
**Agent**: `backend-engineer`
**File**: `convex/channels/queries.ts`
**Size**: S (~45 min)
**Dependencies**: T168-1
**Parallel**: ❌

**Objective**: Create query to get detailed moderation info for a single member.

**Implementation Specification**:
```typescript
import { memberWithModerationValidator } from "./types";

/**
 * Get detailed membership information for a single member.
 * Includes moderation status (mute, ban) and audit trail.
 * Only accessible by channel moderators and above.
 *
 * Used for: Admin UI, audit logs, member detail views
 */
export const getMembershipDetails = query({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  returns: v.union(memberWithModerationValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // 1. Check if caller has moderator+ access
    const callerMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    const hasPermission =
      user.role === "admin" || // Global admin
      (callerMembership &&
        !callerMembership.leftAt &&
        !callerMembership.isBanned &&
        (callerMembership.role === "owner" ||
          callerMembership.role === "admin" ||
          callerMembership.role === "moderator"));

    if (!hasPermission) {
      throw new Error("Forbidden: Moderator role or higher required");
    }

    // 2. Get target membership
    const targetMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (!targetMembership) {
      return null;
    }

    // 3. Get user info
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      return null;
    }

    // 4. Return full details with moderation status
    return {
      _id: targetMembership._id,
      userId: targetMembership.userId,
      userName: targetUser.name,
      userEmail: targetUser.email,
      userAvatarUrl: targetUser.avatarUrl,
      userStatus: targetUser.status,
      role: targetMembership.role,
      joinedAt: targetMembership.joinedAt,
      isMuted: targetMembership.isMuted,
      mutedUntil: targetMembership.mutedUntil,
      mutedBy: targetMembership.mutedBy,
      isBanned: targetMembership.isBanned,
      bannedAt: targetMembership.bannedAt,
      bannedBy: targetMembership.bannedBy,
    };
  },
});
```

**Acceptance Criteria**:
- [ ] Query enforces moderator+ permission
- [ ] Returns null if membership not found
- [ ] Includes all moderation fields (mute, ban, audit trail)
- [ ] Returns user info merged with membership
- [ ] JSDoc describes use cases
- [ ] TypeScript compiles without errors

---

## Phase 3: Backend - Message Moderation

### T169-1: Verify Existing deleteChannelMessage Mutation
**Agent**: `backend-engineer`
**File**: `convex/messages/channelEditDeleteMutations.ts` (read-only verification)
**Size**: XS (~15 min)
**Dependencies**: None
**Parallel**: ✅

**Objective**: Verify that deleteChannelMessage mutation already exists and works correctly.

**Verification Checklist**:
- [ ] Mutation exists in `convex/messages/channelEditDeleteMutations.ts` (lines 81-140)
- [ ] Allows sender, channel moderators, and global admins to delete
- [ ] Soft delete with deletedAt and deletedBy fields
- [ ] Updates thread metadata if message is a reply
- [ ] No changes needed - already implements T169 requirements

**Output**: Written report confirming implementation status.

---

### T169-2: Update deleteChannelMessage JSDoc
**Agent**: `backend-engineer`
**File**: `convex/messages/channelEditDeleteMutations.ts`
**Size**: XS (~10 min)
**Dependencies**: T169-1
**Parallel**: ❌

**Objective**: Add FR-037 reference and admin context to existing JSDoc.

**Changes Required**:
```typescript
/**
 * Delete a channel message.
 * Sender can delete their own messages.
 * Channel admins/mods and global admins can delete any message.
 *
 * FR-037: Message moderation - admin message deletion
 *
 * Permissions:
 * - Sender: Can delete own messages
 * - Moderator+: Can delete any message in channel
 * - Global Admin: Can delete any message
 *
 * Soft delete: Sets deletedAt and deletedBy, preserves content for audit
 */
export const deleteChannelMessage = mutation({
  // ... existing implementation ...
});
```

**Acceptance Criteria**:
- [ ] JSDoc includes FR-037 reference
- [ ] JSDoc documents permission levels
- [ ] JSDoc clarifies soft delete behavior
- [ ] No logic changes to mutation

---

### T170-1: Create restoreDeletedMessage Mutation
**Agent**: `backend-engineer`
**File**: `convex/messages/channelEditDeleteMutations.ts`
**Size**: M (~75 min)
**Dependencies**: T169-2
**Parallel**: ❌

**Objective**: Implement mutation to restore soft-deleted messages (admin only).

**Implementation Specification**:
```typescript
/**
 * Restore a deleted channel message.
 * Only channel admins/owners and global admins can restore messages.
 * Cannot restore messages deleted by user account deletion (anonymized).
 *
 * FR-037: Message moderation - restore deleted messages
 *
 * Permissions: Admin+ only (moderators cannot restore)
 */
export const restoreDeletedMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // 1. Get message
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // 2. Check if message is deleted
    if (!message.deletedAt) {
      throw new Error("Message is not deleted");
    }

    // 3. Check if message was anonymized (cannot restore)
    if (message.anonymizedAt) {
      throw new Error("Cannot restore anonymized message (user account deleted)");
    }

    // 4. Check permissions (admin+ only, moderators cannot restore)
    if (!message.channelId) {
      throw new Error("Can only restore channel messages");
    }

    const callerMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", message.channelId!).eq("userId", user._id)
      )
      .unique();

    const hasPermission =
      user.role === "admin" || // Global admin
      (callerMembership &&
        !callerMembership.leftAt &&
        !callerMembership.isBanned &&
        (callerMembership.role === "owner" || callerMembership.role === "admin"));

    if (!hasPermission) {
      throw new Error("Forbidden: Channel admin role or higher required to restore messages");
    }

    // 5. Restore message
    await ctx.db.patch(args.messageId, {
      deletedAt: undefined,
      deletedBy: undefined,
    });

    // 6. Update thread metadata if this was a reply
    if (message.parentId) {
      await ctx.runMutation(
        internal.messages.threadInternals.updateThreadMetadata,
        { parentId: message.parentId }
      );
    }

    return null;
  },
});
```

**Acceptance Criteria**:
- [ ] Mutation enforces admin+ permission (moderators cannot restore)
- [ ] Cannot restore anonymized messages
- [ ] Clears deletedAt and deletedBy fields
- [ ] Updates thread metadata on restore (T170-2)
- [ ] Throws error if message not deleted
- [ ] JSDoc includes FR-037 reference
- [ ] Unit tests pass (created in T174-2)

---

### T170-2: Update Thread Metadata on Restore
**Agent**: `backend-engineer`
**File**: `convex/messages/threadInternals.ts`
**Size**: S (~30 min)
**Dependencies**: T170-1
**Parallel**: ❌

**Objective**: Ensure thread reply count updates when message restored.

**Changes Required**:
Verify that existing `updateThreadMetadata` internal mutation recounts replies correctly, excluding deleted messages. If it doesn't handle restore case:

```typescript
/**
 * Update thread metadata (reply count, last reply timestamp).
 * Recounts non-deleted replies to ensure accuracy.
 * Called after message deletion or restoration.
 */
export const updateThreadMetadata = internalMutation({
  args: {
    parentId: v.id("messages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentId);
    if (!parent) {
      return null;
    }

    // Get all non-deleted replies
    const replies = await ctx.db
      .query("messages")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();

    const activeReplies = replies.filter((r) => !r.deletedAt);
    const replyCount = activeReplies.length;

    // Find most recent active reply
    const sortedReplies = activeReplies.sort((a, b) => b.createdAt - a.createdAt);
    const lastReply = sortedReplies[0];

    await ctx.db.patch(args.parentId, {
      threadReplyCount: replyCount,
      threadLastReplyAt: lastReply?.createdAt,
    });

    return null;
  },
});
```

**Acceptance Criteria**:
- [ ] Recounts active (non-deleted) replies
- [ ] Updates threadReplyCount correctly
- [ ] Updates threadLastReplyAt to most recent active reply
- [ ] Handles case where all replies deleted (count = 0)
- [ ] Works for both deletion and restoration
- [ ] TypeScript compiles without errors

---

## Phase 4: Backend - History Export

### T171-1: Create exportChannelHistory Action
**Agent**: `backend-engineer`
**File**: `convex/channels/actions.ts` (new file)
**Size**: L (~120 min)
**Dependencies**: None
**Parallel**: ✅

**Objective**: Implement action to export channel message history (FR-039).

**Implementation Specification**:
```typescript
import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { formatAsCSV, formatAsJSON } from "../lib/exportHelpers";

const MAX_EXPORT_MESSAGES = 10000;
const EXPORT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Export channel message history as CSV or JSON file.
 * Rate limited: 1 export per 5 minutes per user.
 * Max 10,000 messages per export.
 * Admins see deleted messages, moderators/members do not.
 *
 * FR-039: Channel history export
 *
 * Permissions: Moderator+ (owner, admin, moderator, global admin)
 *
 * @param channelId - Channel to export
 * @param format - Export format (csv or json)
 * @param includeDeleted - Include deleted messages (admin only)
 * @returns Download URL for exported file
 */
export const exportChannelHistory = action({
  args: {
    channelId: v.id("channels"),
    format: v.union(v.literal("csv"), v.literal("json")),
    includeDeleted: v.optional(v.boolean()),
  },
  returns: v.object({
    downloadUrl: v.string(),
    fileName: v.string(),
    messageCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // 1. Get current user (from Convex context)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // 2. Query for user in database
    const user = await ctx.runQuery(api.users.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }

    // 3. Check rate limiting
    const lastExport = await ctx.runQuery(api.channels.getLastExportTimestamp, {
      userId: user._id,
      channelId: args.channelId,
    });

    if (lastExport && Date.now() - lastExport < EXPORT_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((EXPORT_COOLDOWN_MS - (Date.now() - lastExport)) / 1000);
      throw new Error(`Please wait ${remainingSeconds} seconds before exporting again`);
    }

    // 4. Check permissions (moderator+)
    const membership = await ctx.runQuery(api.channels.getMembershipDetails, {
      channelId: args.channelId,
      userId: user._id,
    });

    const hasPermission =
      user.role === "admin" || // Global admin
      (membership &&
        !membership.isBanned &&
        (membership.role === "owner" ||
          membership.role === "admin" ||
          membership.role === "moderator"));

    if (!hasPermission) {
      throw new Error("Forbidden: Moderator role or higher required to export channel history");
    }

    // 5. Check if includeDeleted is allowed (admin+ only)
    const canIncludeDeleted =
      user.role === "admin" ||
      (membership && (membership.role === "owner" || membership.role === "admin"));

    const includeDeleted = args.includeDeleted && canIncludeDeleted;

    // 6. Fetch messages (max 10k)
    const messages = await ctx.runQuery(api.messages.getChannelMessagesForExport, {
      channelId: args.channelId,
      includeDeleted,
      limit: MAX_EXPORT_MESSAGES,
    });

    // 7. Format export
    let content: string;
    let mimeType: string;
    let fileExtension: string;

    if (args.format === "csv") {
      content = formatAsCSV(messages);
      mimeType = "text/csv";
      fileExtension = "csv";
    } else {
      content = formatAsJSON(messages);
      mimeType = "application/json";
      fileExtension = "json";
    }

    // 8. Generate file
    const blob = new Blob([content], { type: mimeType });
    const channel = await ctx.runQuery(api.channels.get, { channelId: args.channelId });
    const fileName = `${channel?.name.replace(/[^a-z0-9]/gi, '-')}-export-${Date.now()}.${fileExtension}`;

    // 9. Create download URL (using browser download, not Convex storage)
    const downloadUrl = URL.createObjectURL(blob);

    // 10. Record export timestamp
    await ctx.runMutation(api.channels.recordExportTimestamp, {
      userId: user._id,
      channelId: args.channelId,
    });

    return {
      downloadUrl,
      fileName,
      messageCount: messages.length,
    };
  },
});
```

**Acceptance Criteria**:
- [ ] Action enforces moderator+ permission
- [ ] Rate limiting prevents abuse (5 min cooldown)
- [ ] Max 10k messages per export enforced
- [ ] includeDeleted only works for admins
- [ ] Supports CSV and JSON formats
- [ ] Returns download URL and metadata
- [ ] Records export timestamp for rate limiting
- [ ] JSDoc includes FR-039 reference
- [ ] Unit tests pass (created in T174-3)

---

### T171-2: Implement CSV Formatter Helper
**Agent**: `backend-engineer`
**File**: `convex/lib/exportHelpers.ts` (new file)
**Size**: S (~45 min)
**Dependencies**: None
**Parallel**: ✅ (parallel with T171-1, T171-3)

**Objective**: Create helper function to format messages as CSV.

**Implementation Specification**:
```typescript
import type { Doc } from "../_generated/dataModel";

/**
 * Format channel messages as CSV for export.
 * Includes: timestamp, sender, content, reactions, edit status
 */
export function formatAsCSV(messages: Array<Doc<"messages"> & { senderName: string }>): string {
  // CSV header
  const header = [
    "Timestamp",
    "Date",
    "Sender",
    "Content",
    "Type",
    "Edited",
    "Deleted",
    "Reactions",
    "Reply To"
  ].join(",");

  // CSV rows
  const rows = messages.map((msg) => {
    const timestamp = new Date(msg.createdAt).toISOString();
    const date = new Date(msg.createdAt).toLocaleDateString();
    const sender = escapeCsvField(msg.senderName);
    const content = escapeCsvField(msg.content);
    const type = msg.contentType || "text";
    const edited = msg.isEdited ? "Yes" : "No";
    const deleted = msg.deletedAt ? "Yes" : "No";
    const reactions = msg.reactionCount || 0;
    const replyTo = msg.parentId ? "Thread Reply" : "";

    return [timestamp, date, sender, content, type, edited, deleted, reactions, replyTo].join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * Escape CSV field (handle quotes, commas, newlines)
 */
function escapeCsvField(field: string): string {
  if (!field) return "";

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }

  return field;
}
```

**Acceptance Criteria**:
- [ ] Exports CSV with proper headers
- [ ] Escapes special characters (quotes, commas, newlines)
- [ ] Includes all relevant fields (timestamp, sender, content, reactions, etc.)
- [ ] Handles deleted messages (shows "Yes" in Deleted column)
- [ ] Handles thread replies (indicates parent message)
- [ ] TypeScript compiles without errors
- [ ] Unit tests verify CSV parsing

---

### T171-3: Implement JSON Formatter Helper
**Agent**: `backend-engineer`
**File**: `convex/lib/exportHelpers.ts`
**Size**: S (~30 min)
**Dependencies**: None
**Parallel**: ✅ (parallel with T171-1, T171-2)

**Objective**: Create helper function to format messages as JSON.

**Implementation Specification**:
```typescript
/**
 * Format channel messages as JSON for export.
 * Preserves full message structure for programmatic access.
 */
export function formatAsJSON(messages: Array<Doc<"messages"> & { senderName: string }>): string {
  const exportData = {
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map((msg) => ({
      id: msg._id,
      timestamp: msg.createdAt,
      date: new Date(msg.createdAt).toISOString(),
      sender: {
        id: msg.senderId,
        name: msg.senderName,
      },
      content: msg.content,
      contentType: msg.contentType || "text",
      isEdited: msg.isEdited || false,
      editHistory: msg.editHistory || [],
      isDeleted: !!msg.deletedAt,
      deletedAt: msg.deletedAt,
      deletedBy: msg.deletedBy,
      reactionCount: msg.reactionCount || 0,
      isThreadReply: !!msg.parentId,
      parentId: msg.parentId,
      threadReplyCount: msg.threadReplyCount || 0,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}
```

**Acceptance Criteria**:
- [ ] Exports valid JSON with metadata
- [ ] Includes exportedAt timestamp
- [ ] Includes messageCount
- [ ] Preserves full message structure
- [ ] Handles optional fields gracefully
- [ ] Pretty-printed JSON (2-space indent)
- [ ] TypeScript compiles without errors
- [ ] Unit tests verify JSON parsing

---

## Phase 5: Frontend - Admin UI

### T172-1: Create ChannelMembersPanel Component
**Agent**: `frontend-engineer`
**File**: `src/components/channels/admin/channel-members-panel.tsx`
**Size**: L (~120 min)
**Dependencies**: T168-1
**Parallel**: ❌

**Objective**: Create admin UI for viewing and managing channel members.

**Component Specification**:
```typescript
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MemberRoleDropdown } from "./member-role-dropdown";
import { MemberModerationActions } from "./member-moderation-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface ChannelMembersPanelProps {
  channelId: Id<"channels">;
}

export function ChannelMembersPanel({ channelId }: ChannelMembersPanelProps) {
  const [paginationOpts, setPaginationOpts] = useState({ numItems: 50, cursor: null });

  const membersResult = useQuery(api.channels.getMembers, {
    channelId,
    paginationOpts,
  });

  if (!membersResult) {
    return <ChannelMembersPanelSkeleton />;
  }

  const { page: members, continueCursor, isDone } = membersResult;

  const loadMore = () => {
    if (!isDone && continueCursor) {
      setPaginationOpts({ numItems: 50, cursor: continueCursor });
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">
          Channel Members ({members.length})
        </h2>
      </div>

      {/* Member list */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {members.map((member) => (
            <div
              key={member._id}
              className="flex items-center justify-between p-4 hover:bg-muted/50"
            >
              {/* User info */}
              <div className="flex items-center gap-3 flex-1">
                <Avatar>
                  <AvatarImage src={member.userAvatarUrl} />
                  <AvatarFallback>
                    {member.userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{member.userName}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {member.userEmail}
                  </p>
                </div>
                <Badge variant={getRoleBadgeVariant(member.role)}>
                  {member.role}
                </Badge>
              </div>

              {/* Admin controls */}
              <div className="flex items-center gap-2 ml-4">
                <MemberRoleDropdown
                  channelId={channelId}
                  userId={member.userId}
                  currentRole={member.role}
                />
                <MemberModerationActions
                  channelId={channelId}
                  userId={member.userId}
                  userName={member.userName}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Load more button */}
        {!isDone && (
          <div className="p-4 text-center">
            <button
              onClick={loadMore}
              className="text-sm text-primary hover:underline"
            >
              Load more members
            </button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case "owner":
      return "destructive";
    case "admin":
      return "default";
    case "moderator":
      return "secondary";
    default:
      return "outline";
  }
}

function ChannelMembersPanelSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="divide-y">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Displays paginated member list
- [ ] Shows avatar, name, email, role for each member
- [ ] Integrates MemberRoleDropdown and MemberModerationActions
- [ ] Load more button for pagination
- [ ] Skeleton loading state
- [ ] Responsive design (mobile-friendly)
- [ ] Accessible (keyboard navigation, ARIA labels)
- [ ] Only visible to users with channel access

---

### T172-2: Create MemberRoleDropdown Component
**Agent**: `frontend-engineer`
**File**: `src/components/channels/admin/member-role-dropdown.tsx`
**Size**: M (~60 min)
**Dependencies**: T165-4
**Parallel**: ✅ (parallel with T166-2, T167-2)

**Objective**: Create dropdown for changing member roles.

**Component Specification**:
```typescript
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ChannelRole = "owner" | "admin" | "moderator" | "member";

interface MemberRoleDropdownProps {
  channelId: Id<"channels">;
  userId: Id<"users">;
  currentRole: ChannelRole;
}

const EDITABLE_ROLES: Array<{ value: ChannelRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "moderator", label: "Moderator" },
  { value: "member", label: "Member" },
];

export function MemberRoleDropdown({
  channelId,
  userId,
  currentRole,
}: MemberRoleDropdownProps) {
  const { toast } = useToast();
  const [isChanging, setIsChanging] = useState(false);
  const updateMemberRole = useMutation(api.channels.updateMemberRole);

  // Owner role cannot be changed via this dropdown
  if (currentRole === "owner") {
    return (
      <Button variant="ghost" size="sm" disabled>
        Owner
      </Button>
    );
  }

  const handleRoleChange = async (newRole: "admin" | "moderator" | "member") => {
    if (newRole === currentRole) return;

    setIsChanging(true);
    try {
      await updateMemberRole({
        channelId,
        userId,
        newRole,
      });
      toast({
        title: "Role updated",
        description: `Member role changed to ${newRole}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to update role",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isChanging}>
          {currentRole}
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {EDITABLE_ROLES.map((role) => (
          <DropdownMenuItem
            key={role.value}
            onClick={() => handleRoleChange(role.value)}
            disabled={role.value === currentRole}
          >
            {role.label}
            {role.value === currentRole && (
              <span className="ml-auto text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Acceptance Criteria**:
- [ ] Dropdown shows admin, moderator, member options
- [ ] Current role indicated with checkmark
- [ ] Disabled for owner role
- [ ] Optimistic UI update with rollback on error
- [ ] Toast notifications for success/error
- [ ] Loading state during mutation
- [ ] Accessible (keyboard navigation)

---

### T172-3: Create MemberModerationActions Component
**Agent**: `frontend-engineer`
**File**: `src/components/channels/admin/member-moderation-actions.tsx`
**Size**: M (~90 min)
**Dependencies**: T166-2, T167-2
**Parallel**: ❌

**Objective**: Create component with mute/ban actions for members.

**Component Specification**:
```typescript
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MoreVertical, UserX, Mic, MicOff, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MemberModerationActionsProps {
  channelId: Id<"channels">;
  userId: Id<"users">;
  userName: string;
}

const MUTE_DURATIONS = [
  { label: "1 hour", value: 60 * 60 * 1000 },
  { label: "6 hours", value: 6 * 60 * 60 * 1000 },
  { label: "24 hours", value: 24 * 60 * 60 * 1000 },
  { label: "7 days", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "30 days", value: 30 * 24 * 60 * 60 * 1000 },
];

export function MemberModerationActions({
  channelId,
  userId,
  userName,
}: MemberModerationActionsProps) {
  const { toast } = useToast();
  const [muteDialogOpen, setMuteDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(MUTE_DURATIONS[2].value);

  const muteMember = useMutation(api.channels.muteMember);
  const unmuteMember = useMutation(api.channels.unmuteMember);
  const banMember = useMutation(api.channels.banMember);
  const unbanMember = useMutation(api.channels.unbanMember);

  const handleMute = async () => {
    try {
      await muteMember({
        channelId,
        userId,
        durationMs: selectedDuration,
      });
      toast({
        title: "Member muted",
        description: `${userName} has been muted`,
      });
      setMuteDialogOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to mute member",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleUnmute = async () => {
    try {
      await unmuteMember({ channelId, userId });
      toast({
        title: "Member unmuted",
        description: `${userName} has been unmuted`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to unmute member",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleBan = async () => {
    try {
      await banMember({ channelId, userId });
      toast({
        title: "Member banned",
        description: `${userName} has been banned from this channel`,
      });
      setBanDialogOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to ban member",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleUnban = async () => {
    try {
      await unbanMember({ channelId, userId });
      toast({
        title: "Member unbanned",
        description: `${userName} has been unbanned`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to unban member",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Moderation actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setMuteDialogOpen(true)}>
            <MicOff className="mr-2 h-4 w-4" />
            Mute member
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleUnmute}>
            <Mic className="mr-2 h-4 w-4" />
            Unmute member
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setBanDialogOpen(true)}
            className="text-destructive"
          >
            <UserX className="mr-2 h-4 w-4" />
            Ban member
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleUnban}>
            <Shield className="mr-2 h-4 w-4" />
            Unban member
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mute duration dialog */}
      <Dialog open={muteDialogOpen} onOpenChange={setMuteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mute {userName}</DialogTitle>
            <DialogDescription>
              Select how long to mute this member from sending messages.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={selectedDuration.toString()}
            onValueChange={(v) => setSelectedDuration(Number(v))}
          >
            {MUTE_DURATIONS.map((duration) => (
              <div key={duration.value} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={duration.value.toString()}
                  id={duration.value.toString()}
                />
                <Label htmlFor={duration.value.toString()}>{duration.label}</Label>
              </div>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMuteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMute}>Mute member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban confirmation dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban {userName}?</DialogTitle>
            <DialogDescription>
              This member will be removed from the channel and cannot rejoin until
              unbanned. This action can be reversed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBan}>
              Ban member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Acceptance Criteria**:
- [ ] Dropdown with mute/unmute/ban/unban actions
- [ ] Mute dialog with duration selector (1h - 30d)
- [ ] Ban confirmation dialog (destructive action)
- [ ] Toast notifications for all actions
- [ ] Optimistic updates where appropriate
- [ ] Accessible (keyboard navigation, focus management)
- [ ] Error handling with rollback

---

### T172-4: Create MessageModerationMenu Component
**Agent**: `frontend-engineer`
**File**: `src/components/channels/admin/message-moderation-menu.tsx`
**Size**: M (~60 min)
**Dependencies**: T170-1
**Parallel**: ✅ (parallel with T172-2, T172-5)

**Objective**: Create menu for moderators to delete/restore messages.

**Component Specification**:
```typescript
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { MoreVertical, Trash2, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MessageModerationMenuProps {
  messageId: Id<"messages">;
  isDeleted: boolean;
  canRestore: boolean; // Only admins can restore
}

export function MessageModerationMenu({
  messageId,
  isDeleted,
  canRestore,
}: MessageModerationMenuProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteMessage = useMutation(api.messages.deleteChannelMessage);
  const restoreMessage = useMutation(api.messages.restoreDeletedMessage);

  const handleDelete = async () => {
    try {
      await deleteMessage({ messageId });
      toast({
        title: "Message deleted",
        description: "The message has been deleted",
      });
      setDeleteDialogOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to delete message",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleRestore = async () => {
    try {
      await restoreMessage({ messageId });
      toast({
        title: "Message restored",
        description: "The message has been restored",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to restore message",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Message moderation</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isDeleted ? (
            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete message
            </DropdownMenuItem>
          ) : (
            canRestore && (
              <DropdownMenuItem onClick={handleRestore}>
                <Undo2 className="mr-2 h-4 w-4" />
                Restore message
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              The message will be hidden and marked as deleted. Admins can restore
              it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

**Acceptance Criteria**:
- [ ] Shows "Delete message" for active messages
- [ ] Shows "Restore message" for deleted messages (admin only)
- [ ] Confirmation dialog for delete action
- [ ] Toast notifications for success/error
- [ ] Optimistic UI update
- [ ] Accessible (keyboard navigation)

---

### T172-5: Create DeletedMessageIndicator Component
**Agent**: `frontend-engineer`
**File**: `src/components/messages/deleted-message-indicator.tsx`
**Size**: S (~30 min)
**Dependencies**: T169-2
**Parallel**: ✅ (parallel with T172-2, T172-4)

**Objective**: Create component to show deleted message placeholder.

**Component Specification**:
```typescript
import { MessageSquareOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeletedMessageIndicatorProps {
  className?: string;
  showRestoreHint?: boolean;
}

export function DeletedMessageIndicator({
  className,
  showRestoreHint = false,
}: DeletedMessageIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground italic",
        className
      )}
    >
      <MessageSquareOff className="h-4 w-4 shrink-0" />
      <span>This message was deleted</span>
      {showRestoreHint && (
        <span className="text-xs">(Admins can restore)</span>
      )}
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Shows icon and "This message was deleted" text
- [ ] Optional hint for admins about restore capability
- [ ] Styled with muted colors
- [ ] Responsive design
- [ ] Accessible (semantic HTML)

---

### T172-6: Integrate Admin Controls into ChannelView
**Agent**: `frontend-engineer`
**File**: `src/app/(dashboard)/messages/channels/[channelId]/page.tsx`
**Size**: M (~75 min)
**Dependencies**: T172-1, T172-4
**Parallel**: ❌

**Objective**: Add admin controls to channel view page.

**Changes Required**:
```typescript
// Add imports
import { ChannelMembersPanel } from "@/components/channels/admin/channel-members-panel";
import { MessageModerationMenu } from "@/components/channels/admin/message-moderation-menu";
import { DeletedMessageIndicator } from "@/components/messages/deleted-message-indicator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Add state for showing members panel
const [showMembersPanel, setShowMembersPanel] = useState(false);

// Check if user is moderator+
const channel = useQuery(api.channels.get, { channelId });
const isModerator =
  channel?.membership?.role === "owner" ||
  channel?.membership?.role === "admin" ||
  channel?.membership?.role === "moderator";

// Add tabs for Messages / Members (for moderators)
{isModerator ? (
  <Tabs defaultValue="messages" className="flex-1">
    <TabsList>
      <TabsTrigger value="messages">Messages</TabsTrigger>
      <TabsTrigger value="members">Members</TabsTrigger>
    </TabsList>
    <TabsContent value="messages" className="flex-1">
      {/* Existing message list */}
    </TabsContent>
    <TabsContent value="members" className="flex-1">
      <ChannelMembersPanel channelId={channelId} />
    </TabsContent>
  </Tabs>
) : (
  {/* Existing message list for non-moderators */}
)}

// In message list, add moderation menu
{messages.map((msg) => (
  <div key={msg._id} className="relative group">
    {msg.deletedAt ? (
      <DeletedMessageIndicator
        showRestoreHint={isModerator}
      />
    ) : (
      <>
        {/* Existing message content */}
      </>
    )}

    {/* Moderation menu (visible on hover for moderators) */}
    {isModerator && (
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100">
        <MessageModerationMenu
          messageId={msg._id}
          isDeleted={!!msg.deletedAt}
          canRestore={
            channel?.membership?.role === "owner" ||
            channel?.membership?.role === "admin"
          }
        />
      </div>
    )}
  </div>
))}
```

**Acceptance Criteria**:
- [ ] Tabs for Messages / Members (moderators only)
- [ ] ChannelMembersPanel shown in Members tab
- [ ] MessageModerationMenu shown on message hover (moderators only)
- [ ] DeletedMessageIndicator for deleted messages
- [ ] Non-moderators see no admin controls
- [ ] Responsive design (tabs collapse to dropdown on mobile)
- [ ] Accessible (keyboard tab navigation)

---

## Phase 6: Frontend - Export UI

### T173-1: Create ExportHistoryDialog Component
**Agent**: `frontend-engineer`
**File**: `src/components/channels/admin/export-history-dialog.tsx`
**Size**: M (~75 min)
**Dependencies**: T171-1
**Parallel**: ❌

**Objective**: Create dialog for exporting channel history (FR-039).

**Component Specification**:
```typescript
"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportHistoryDialogProps {
  channelId: Id<"channels">;
  channelName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canIncludeDeleted: boolean; // Only admins
}

type ExportFormat = "csv" | "json";

export function ExportHistoryDialog({
  channelId,
  channelName,
  open,
  onOpenChange,
  canIncludeDeleted,
}: ExportHistoryDialogProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportHistory = useAction(api.channels.exportChannelHistory);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportHistory({
        channelId,
        format,
        includeDeleted: canIncludeDeleted && includeDeleted,
      });

      // Trigger browser download
      const link = document.createElement("a");
      link.href = result.downloadUrl;
      link.download = result.fileName;
      link.click();

      toast({
        title: "Export complete",
        description: `Downloaded ${result.messageCount} messages as ${format.toUpperCase()}`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Channel History</DialogTitle>
          <DialogDescription>
            Export messages from #{channelName}. Limited to 10,000 messages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format selection */}
          <div className="space-y-2">
            <Label>Export format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="font-normal">
                  CSV (spreadsheet compatible)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="font-normal">
                  JSON (programmatic access)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Include deleted option (admin only) */}
          {canIncludeDeleted && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeDeleted"
                checked={includeDeleted}
                onCheckedChange={(checked) => setIncludeDeleted(checked === true)}
              />
              <Label htmlFor="includeDeleted" className="font-normal">
                Include deleted messages
              </Label>
            </div>
          )}

          {/* Info */}
          <p className="text-sm text-muted-foreground">
            Rate limit: 1 export per 5 minutes
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Acceptance Criteria**:
- [ ] Radio group for CSV/JSON format selection
- [ ] Checkbox for including deleted messages (admin only)
- [ ] Triggers browser download on success
- [ ] Shows loading state during export
- [ ] Toast notifications for success/error
- [ ] Disabled state during export (prevents double-click)
- [ ] Accessible (keyboard navigation, labels)

---

### T173-2: Add Export Button to ChannelSettingsMenu
**Agent**: `frontend-engineer`
**File**: `src/components/channels/channel-settings-menu.tsx`
**Size**: S (~30 min)
**Dependencies**: T173-1
**Parallel**: ❌

**Objective**: Add export option to channel settings menu.

**Changes Required**:
```typescript
// Add imports
import { useState } from "react";
import { ExportHistoryDialog } from "./admin/export-history-dialog";
import { Download } from "lucide-react";

// Add state
const [exportDialogOpen, setExportDialogOpen] = useState(false);

// Check if user is moderator+
const isModerator =
  channel.membership?.role === "owner" ||
  channel.membership?.role === "admin" ||
  channel.membership?.role === "moderator";

const canIncludeDeleted =
  channel.membership?.role === "owner" ||
  channel.membership?.role === "admin";

// Add menu item (for moderators only)
{isModerator && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
      <Download className="mr-2 h-4 w-4" />
      Export history
    </DropdownMenuItem>
  </>
)}

// Add dialog component
<ExportHistoryDialog
  channelId={channel._id}
  channelName={channel.name}
  open={exportDialogOpen}
  onOpenChange={setExportDialogOpen}
  canIncludeDeleted={canIncludeDeleted}
/>
```

**Acceptance Criteria**:
- [ ] Export menu item visible to moderators only
- [ ] Opens ExportHistoryDialog on click
- [ ] Passes correct permissions (canIncludeDeleted)
- [ ] Separator before export option
- [ ] Icon consistent with other menu items
- [ ] Accessible (keyboard navigation)

---

## Phase 7: Testing & Quality Assurance

### T174-1: Unit Tests for Mute/Ban Mutations
**Agent**: `test-architect`
**File**: `convex/channels/memberManagement.test.ts` (new file)
**Size**: M (~90 min)
**Dependencies**: T166-2, T167-2
**Parallel**: ❌

**Objective**: Create comprehensive unit tests for moderation mutations.

**Test Cases to Implement**:
```typescript
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

describe("muteMember mutation", () => {
  test("moderator can mute regular member", async () => {
    const t = convexTest(schema);
    // Setup: Create channel, moderator, and member
    // Execute: muteMember
    // Assert: isMuted = true, mutedUntil set, mutedBy populated
  });

  test("cannot mute channel owner", async () => {
    // Assert: Throws error
  });

  test("cannot mute global admin", async () => {
    // Assert: Throws error
  });

  test("validates duration bounds", async () => {
    // Assert: Throws error for < 1 hour or > 30 days
  });

  test("cannot mute already muted member", async () => {
    // Assert: Throws error
  });
});

describe("unmuteMember mutation", () => {
  test("moderator can unmute member they muted", async () => {
    // Assert: isMuted = false, mutedUntil cleared
  });

  test("moderator cannot unmute member muted by different moderator", async () => {
    // Assert: Throws error
  });

  test("admin can unmute any member", async () => {
    // Assert: Success
  });
});

describe("banMember mutation", () => {
  test("admin can ban regular member", async () => {
    // Assert: isBanned = true, bannedAt set, bannedBy populated, memberCount decremented
  });

  test("moderator cannot ban (requires admin)", async () => {
    // Assert: Throws error
  });

  test("cannot ban channel owner", async () => {
    // Assert: Throws error
  });

  test("cannot ban other admins unless caller is owner", async () => {
    // Assert: Throws error
  });
});

describe("unbanMember mutation", () => {
  test("admin can unban member", async () => {
    // Assert: isBanned = false, memberCount incremented
  });

  test("preserves audit trail (bannedAt, bannedBy)", async () => {
    // Assert: Fields remain after unban
  });
});
```

**Acceptance Criteria**:
- [ ] All permission branches tested
- [ ] Boundary conditions tested (duration limits)
- [ ] Error cases tested (already muted, not a member, etc.)
- [ ] Audit trail verified (mutedBy, bannedBy fields)
- [ ] Member count updates verified
- [ ] Tests pass with >80% coverage
- [ ] Uses convex-test library

---

### T174-2: Unit Tests for Restore Message Mutation
**Agent**: `test-architect`
**File**: `convex/messages/channelEditDeleteMutations.test.ts` (new file)
**Size**: M (~60 min)
**Dependencies**: T170-1
**Parallel**: ✅ (parallel with T174-1)

**Objective**: Create unit tests for restoreDeletedMessage mutation.

**Test Cases to Implement**:
```typescript
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

describe("restoreDeletedMessage mutation", () => {
  test("admin can restore deleted message", async () => {
    const t = convexTest(schema);
    // Setup: Create message, delete it
    // Execute: restoreDeletedMessage
    // Assert: deletedAt and deletedBy cleared
  });

  test("moderator cannot restore (admin only)", async () => {
    // Assert: Throws error
  });

  test("cannot restore anonymized message", async () => {
    // Assert: Throws error
  });

  test("cannot restore non-deleted message", async () => {
    // Assert: Throws error
  });

  test("updates thread metadata on restore", async () => {
    // Setup: Create thread with reply, delete reply
    // Execute: Restore reply
    // Assert: threadReplyCount incremented
  });
});
```

**Acceptance Criteria**:
- [ ] Permission enforcement tested (admin only)
- [ ] Anonymization check tested
- [ ] Thread metadata update verified
- [ ] Error cases covered
- [ ] Tests pass with >80% coverage

---

### T174-3: Unit Tests for Export Action
**Agent**: `test-architect`
**File**: `convex/channels/actions.test.ts` (new file)
**Size**: M (~60 min)
**Dependencies**: T171-1
**Parallel**: ✅ (parallel with T174-1, T174-2)

**Objective**: Create unit tests for exportChannelHistory action.

**Test Cases to Implement**:
```typescript
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

describe("exportChannelHistory action", () => {
  test("moderator can export channel history", async () => {
    const t = convexTest(schema);
    // Setup: Create channel with messages
    // Execute: exportChannelHistory (csv)
    // Assert: Returns downloadUrl, fileName, messageCount
  });

  test("enforces rate limiting (5 min cooldown)", async () => {
    // Execute: Export twice in quick succession
    // Assert: Second export throws error with cooldown message
  });

  test("respects max message limit (10k)", async () => {
    // Setup: Create channel with 15k messages
    // Execute: Export
    // Assert: Returns exactly 10k messages
  });

  test("includeDeleted only works for admins", async () => {
    // Setup: Moderator tries to export with includeDeleted: true
    // Assert: Deleted messages excluded (option ignored)
  });

  test("CSV format generates valid CSV", async () => {
    // Execute: Export as CSV
    // Assert: CSV parseable, headers correct
  });

  test("JSON format generates valid JSON", async () => {
    // Execute: Export as JSON
    // Assert: JSON parseable, structure correct
  });
});
```

**Acceptance Criteria**:
- [ ] Permission enforcement tested
- [ ] Rate limiting tested
- [ ] Max message limit tested
- [ ] includeDeleted permission tested
- [ ] CSV/JSON format validation
- [ ] Tests pass with >80% coverage

---

### T174-4: Component Tests for Admin UI
**Agent**: `test-architect`
**File**: `src/components/channels/admin/__tests__/` (new directory)
**Size**: L (~120 min)
**Dependencies**: T172-6
**Parallel**: ❌

**Objective**: Create component tests for all admin UI components.

**Test Files to Create**:
```
src/components/channels/admin/__tests__/
├── channel-members-panel.test.tsx
├── member-role-dropdown.test.tsx
├── member-moderation-actions.test.tsx
├── message-moderation-menu.test.tsx
└── export-history-dialog.test.tsx
```

**Test Cases (Example for ChannelMembersPanel)**:
```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChannelMembersPanel } from "../channel-members-panel";
import { ConvexProviderWithClerk } from "@/components/providers/convex-clerk-provider";

describe("ChannelMembersPanel", () => {
  test("renders member list", async () => {
    render(
      <ConvexProviderWithClerk>
        <ChannelMembersPanel channelId="123" />
      </ConvexProviderWithClerk>
    );

    await waitFor(() => {
      expect(screen.getByText(/channel members/i)).toBeInTheDocument();
    });
  });

  test("shows pagination controls when more members available", async () => {
    // Mock: Return isDone: false
    // Assert: "Load more" button visible
  });

  test("displays role badges correctly", async () => {
    // Assert: Owner badge is red, admin blue, etc.
  });
});
```

**Acceptance Criteria**:
- [ ] All admin components have tests
- [ ] User interactions tested (click, select, etc.)
- [ ] Loading states tested
- [ ] Error states tested
- [ ] Optimistic updates tested
- [ ] Accessibility attributes verified
- [ ] Tests pass with >80% coverage

---

### T174-5: E2E Test for Admin Moderation Flow
**Agent**: `e2e-specialist`
**File**: `tests/e2e/channel-admin.spec.ts`
**Size**: L (~120 min)
**Dependencies**: T172-6, T173-2
**Parallel**: ❌

**Objective**: Create end-to-end test covering full admin moderation workflow.

**Test Implementation**:
```typescript
import { test, expect } from "@playwright/test";

test.describe("Channel Administration", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    // Navigate to channel
  });

  test("admin can mute and unmute member", async ({ page }) => {
    // Click Members tab
    await page.click('text="Members"');

    // Find target member
    const memberRow = page.locator('text="Test User"').locator("..");

    // Click moderation menu
    await memberRow.locator('button[aria-label="Moderation actions"]').click();

    // Click "Mute member"
    await page.click('text="Mute member"');

    // Select duration (24 hours)
    await page.click('label:has-text("24 hours")');

    // Confirm mute
    await page.click('button:has-text("Mute member")');

    // Verify toast notification
    await expect(page.locator('text="Member muted"')).toBeVisible();

    // Verify member list updates (shows muted status)
    await expect(memberRow.locator('text="Muted"')).toBeVisible();

    // Unmute member
    await memberRow.locator('button[aria-label="Moderation actions"]').click();
    await page.click('text="Unmute member"');

    // Verify toast
    await expect(page.locator('text="Member unmuted"')).toBeVisible();

    // Verify muted status removed
    await expect(memberRow.locator('text="Muted"')).not.toBeVisible();
  });

  test("admin can ban member", async ({ page }) => {
    // Similar flow for ban
    // Assert: Member removed from list after ban
  });

  test("admin can delete and restore message", async ({ page }) => {
    // Click Messages tab
    // Hover over message
    // Click moderation menu
    // Click "Delete message"
    // Confirm deletion
    // Verify message shows "[deleted]"
    // Click "Restore message"
    // Verify message content restored
  });

  test("admin can export channel history", async ({ page }) => {
    // Click channel settings menu
    // Click "Export history"
    // Select CSV format
    // Check "Include deleted messages"
    // Click Export
    // Verify download starts
  });

  test("moderator cannot restore messages", async ({ page }) => {
    // Login as moderator
    // Delete message (allowed)
    // Verify "Restore message" option not visible
  });

  test("rate limiting prevents export spam", async ({ page }) => {
    // Export once (success)
    // Export again immediately (error)
    // Verify error message shows cooldown time
  });
});
```

**Acceptance Criteria**:
- [ ] Full mute/unmute flow tested
- [ ] Full ban/unban flow tested
- [ ] Message delete/restore tested
- [ ] Export functionality tested
- [ ] Permission enforcement verified (moderator vs admin)
- [ ] Rate limiting verified
- [ ] All tests pass reliably (no flakiness)

---

### T174-6: Security Audit of Permission Enforcement
**Agent**: `security-auditor`
**File**: N/A (manual review with written report)
**Size**: M (~90 min)
**Dependencies**: T174-1, T174-2, T174-3
**Parallel**: ❌

**Objective**: Conduct comprehensive security audit of admin feature permissions.

**Audit Checklist**:

**Permission Enforcement**:
- [ ] All mutations call `requireAuth()` as first line
- [ ] Permission checks occur before any database operations
- [ ] No way to bypass permission checks (verified in code)
- [ ] Global admin bypass works consistently
- [ ] Owner role has highest privileges (verified)

**Privilege Escalation**:
- [ ] Moderator cannot promote self to admin (tested)
- [ ] Member cannot mute/ban others (tested)
- [ ] Cannot change owner role without transfer (verified)
- [ ] Cannot ban users with higher role (verified)

**Data Leakage**:
- [ ] Cannot enumerate banned users unless moderator+ (verified)
- [ ] Export respects deleted message permissions (tested)
- [ ] Audit trail fields not exposed to unauthorized users (verified)

**RBAC Matrix Compliance**:
- [ ] All actions match documented permission matrix
- [ ] No inconsistencies between backend and frontend checks
- [ ] UI correctly hides unauthorized actions

**Audit Trail Integrity**:
- [ ] mutedBy/bannedBy always populated when action taken (tested)
- [ ] Audit fields cannot be tampered with (immutable after creation)
- [ ] Timestamps accurate (verified)

**Rate Limiting**:
- [ ] Export cooldown cannot be bypassed (tested)
- [ ] Rate limit tracked per user, not globally (verified)
- [ ] Cooldown time accurate (5 minutes enforced)

**Output**: Security audit report with findings and recommendations.

**Acceptance Criteria**:
- [ ] All checklist items verified
- [ ] No critical vulnerabilities found
- [ ] Any medium/low findings documented with mitigations
- [ ] Report includes code references for each check
- [ ] Sign-off from security-auditor

---

## Summary

**Total Tasks**: 35 atomic tasks
**Critical Path**: T165-1 → T165-2 → T166-1 → T166-2 → T172-3 → T172-6 → T174-5 → T174-6
**Estimated Duration**: 2-3 days with parallelization
**Quality Gates**: 35 checkpoints across all tasks

**Key Deliverables**:
1. Enhanced schema with moderation audit fields
2. 4 new mutations (mute, unmute, ban, unban)
3. 1 new mutation (restore deleted message)
4. 1 new action (export channel history)
5. 2 new helper functions (CSV/JSON formatters)
6. 6 new admin UI components
7. Comprehensive test suite (unit, component, E2E)
8. Security audit report

**Risk Mitigation**:
- Security audit at end of phase
- Comprehensive test coverage
- Permission matrix enforced consistently
- Rate limiting prevents abuse
- Audit trail immutability

---

**Plan Generated**: 2026-01-01
**Plan Version**: 1.0
**Ready for Execution**: Yes ✅
