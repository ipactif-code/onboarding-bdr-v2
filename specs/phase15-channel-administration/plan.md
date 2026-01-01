# Phase 15 - Channel Administration: Execution Plan

**Feature**: Channel Administration (Role Management, Mute/Ban, Message Moderation, History Export)
**Complexity**: M (Medium)
**Estimated Duration**: 2-3 days
**Tasks**: T165-T173

---

## Executive Summary

This phase implements comprehensive channel administration capabilities including role management, member moderation (mute/ban), message deletion with restore, and history export functionality.

### Schema Analysis

**Existing Schema (channelMembers):**
```typescript
channelMembers: {
  role: "owner" | "admin" | "moderator" | "member" ✅
  isMuted: boolean ✅
  mutedUntil: optional<number> ✅ (timestamp)
  isBanned: boolean ✅
  // Missing: bannedAt timestamp ❌
  // Missing: mutedBy/bannedBy audit fields ❌
}
```

**Existing Schema (messages):**
```typescript
messages: {
  deletedAt: optional<number> ✅
  deletedBy: optional<Id<"users">> ✅
  // All required fields exist ✅
}
```

**Schema Modifications Required:**
- Add `bannedAt: v.optional(v.number())` to channelMembers
- Add `mutedBy: v.optional(v.id("users"))` to channelMembers (audit trail)
- Add `bannedBy: v.optional(v.id("users"))` to channelMembers (audit trail)
- Add index `by_channel_muted` for listing muted members
- Add index `by_channel_banned` for listing banned members

---

## Dependencies & Prerequisites

### Existing Implementations (Verified ✅)
1. ✅ **updateMemberRole** mutation exists in `convex/channels/memberManagement.ts`
   - Enforces owner/admin permissions
   - Validates role transitions
   - Already implemented in T165 scope

2. ✅ **deleteChannelMessage** mutation exists in `convex/messages/channelEditDeleteMutations.ts`
   - Allows sender, channel moderators, and global admins to delete
   - Soft delete with `deletedAt` and `deletedBy` fields
   - Already implements T169 requirements

3. ✅ **getMembers** query exists in `convex/channels/queries.ts`
   - Returns active members only (no leftAt, not banned)
   - Includes user info and role
   - Needs pagination enhancement for T168

4. ✅ Schema fields for mute (`isMuted`, `mutedUntil`) exist
5. ✅ Schema fields for ban (`isBanned`) exist
6. ✅ Schema fields for message deletion (`deletedAt`, `deletedBy`) exist

### Missing Implementations
1. ❌ Mute/unmute mutations
2. ❌ Ban/unban mutations
3. ❌ Restore deleted message mutation
4. ❌ Export channel history action
5. ❌ Pagination for getMembers query
6. ❌ Admin UI components
7. ❌ Schema audit fields (bannedAt, mutedBy, bannedBy)

---

## Permission Matrix (Role-Based Access Control)

| Action | Creator | Owner | Admin | Moderator | Member | Global Admin |
|--------|---------|-------|-------|-----------|--------|--------------|
| **Change roles** | N/A (auto-owner) | ✅ (not creator) | ✅ (not creator/owner) | ❌ | ❌ | ✅ |
| **Mute members** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Unmute members** | ✅ | ✅ | ✅ | ✅ (own mutes) | ❌ | ✅ |
| **Ban members** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Unban members** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Delete any message** | ✅ | ✅ | ✅ | ✅ | ❌ (own only) | ✅ |
| **Restore deleted messages** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Export history** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

### Notes:
- **Creator role doesn't exist in schema** - creator becomes "owner" automatically
- **Moderators can mute** but not ban (mute = temporary, ban = severe)
- **Moderators can unmute** only members they muted (enforced via mutedBy field)
- **Restore messages** requires admin+ (prevent moderator abuse)
- **Global admins** (user.role === "admin") have all permissions across all channels

---

## Task Decomposition

### Phase 1: Schema Enhancement (5 tasks)

| ID | Task | Agent | Depends | Parallel | Size |
|----|------|-------|---------|----------|------|
| T165-1 | Add audit fields to channelMembers schema (bannedAt, mutedBy, bannedBy) in `convex/schema.ts` | schema-architect | - | ✅ | S |
| T165-2 | Add indexes for moderation queries (by_channel_muted, by_channel_banned) in `convex/schema.ts` | schema-architect | T165-1 | ❌ | S |
| T165-3 | Verify existing updateMemberRole mutation (already implemented) | backend-engineer | - | ✅ | XS |
| T165-4 | Update updateMemberRole JSDoc with FR-038 reference | backend-engineer | T165-3 | ❌ | XS |
| T165-5 | Create TypeScript validator for moderation actions in `convex/channels/types.ts` | typescript-expert | T165-1 | ✅ | S |

### Phase 2: Backend - Moderation Mutations (6 tasks)

| ID | Task | Agent | Depends | Parallel | Size |
|----|------|-------|---------|----------|------|
| T166-1 | Create muteMember mutation in `convex/channels/memberManagement.ts` (FR-038) | backend-engineer | T165-2, T165-5 | ❌ | M |
| T166-2 | Create unmuteMember mutation in `convex/channels/memberManagement.ts` (FR-038) | backend-engineer | T166-1 | ❌ | M |
| T167-1 | Create banMember mutation in `convex/channels/memberManagement.ts` (FR-038) | backend-engineer | T165-2, T165-5 | ✅ | M |
| T167-2 | Create unbanMember mutation in `convex/channels/memberManagement.ts` (FR-038) | backend-engineer | T167-1 | ❌ | M |
| T168-1 | Enhance getMembers query with pagination in `convex/channels/queries.ts` | backend-engineer | - | ✅ | M |
| T168-2 | Create getMembershipDetails query for single member audit in `convex/channels/queries.ts` | backend-engineer | T168-1 | ❌ | S |

### Phase 3: Backend - Message Moderation (4 tasks)

| ID | Task | Agent | Depends | Parallel | Size |
|----|------|-------|---------|----------|------|
| T169-1 | Verify existing deleteChannelMessage mutation (already implemented) | backend-engineer | - | ✅ | XS |
| T169-2 | Update deleteChannelMessage JSDoc with FR-037 reference and admin deletion context | backend-engineer | T169-1 | ❌ | XS |
| T170-1 | Create restoreDeletedMessage mutation in `convex/messages/channelEditDeleteMutations.ts` (admin only) | backend-engineer | T169-2 | ❌ | M |
| T170-2 | Update thread metadata on restore in `convex/messages/threadInternals.ts` | backend-engineer | T170-1 | ❌ | S |

### Phase 4: Backend - History Export (3 tasks)

| ID | Task | Agent | Depends | Parallel | Size |
|----|------|-------|---------|----------|------|
| T171-1 | Create exportChannelHistory action in `convex/channels/actions.ts` (FR-039) | backend-engineer | - | ✅ | L |
| T171-2 | Implement CSV formatter helper in `convex/lib/exportHelpers.ts` | backend-engineer | - | ✅ | S |
| T171-3 | Implement JSON formatter helper in `convex/lib/exportHelpers.ts` | backend-engineer | - | ✅ | S |

### Phase 5: Frontend - Admin UI (6 tasks)

| ID | Task | Agent | Depends | Parallel | Size |
|----|------|-------|---------|----------|------|
| T172-1 | Create ChannelMembersPanel component in `src/components/channels/admin/channel-members-panel.tsx` | frontend-engineer | T168-1 | ❌ | L |
| T172-2 | Create MemberRoleDropdown component in `src/components/channels/admin/member-role-dropdown.tsx` | frontend-engineer | T165-4 | ✅ | M |
| T172-3 | Create MemberModerationActions component in `src/components/channels/admin/member-moderation-actions.tsx` | frontend-engineer | T166-2, T167-2 | ❌ | M |
| T172-4 | Create MessageModerationMenu component in `src/components/channels/admin/message-moderation-menu.tsx` | frontend-engineer | T170-1 | ✅ | M |
| T172-5 | Create DeletedMessageIndicator component in `src/components/messages/deleted-message-indicator.tsx` | frontend-engineer | T169-2 | ✅ | S |
| T172-6 | Integrate admin controls into ChannelView page in `src/app/(dashboard)/messages/channels/[channelId]/page.tsx` | frontend-engineer | T172-1, T172-4 | ❌ | M |

### Phase 6: Frontend - Export UI (2 tasks)

| ID | Task | Agent | Depends | Parallel | Size |
|----|------|-------|---------|----------|------|
| T173-1 | Create ExportHistoryDialog component in `src/components/channels/admin/export-history-dialog.tsx` (FR-039) | frontend-engineer | T171-1 | ❌ | M |
| T173-2 | Add export button to ChannelSettingsMenu in `src/components/channels/channel-settings-menu.tsx` | frontend-engineer | T173-1 | ❌ | S |

### Phase 7: Testing & Quality Assurance (6 tasks)

| ID | Task | Agent | Depends | Parallel | Size |
|----|------|-------|---------|----------|------|
| T174-1 | Unit tests for mute/ban mutations in `convex/channels/memberManagement.test.ts` | test-architect | T166-2, T167-2 | ❌ | M |
| T174-2 | Unit tests for restore message mutation in `convex/messages/channelEditDeleteMutations.test.ts` | test-architect | T170-1 | ✅ | M |
| T174-3 | Unit tests for export action in `convex/channels/actions.test.ts` | test-architect | T171-1 | ✅ | M |
| T174-4 | Component tests for admin UI in `src/components/channels/admin/__tests__/` | test-architect | T172-6 | ❌ | L |
| T174-5 | E2E test for admin moderation flow in `tests/e2e/channel-admin.spec.ts` | e2e-specialist | T172-6, T173-2 | ❌ | L |
| T174-6 | Security audit of permission enforcement in all admin mutations | security-auditor | T174-1, T174-2, T174-3 | ❌ | M |

---

## Critical Path Analysis

```
T165-1 (schema audit fields)
  ↓
T165-2 (schema indexes)
  ↓
T166-1 (muteMember)
  ↓
T166-2 (unmuteMember)
  ↓
T172-3 (MemberModerationActions UI)
  ↓
T172-6 (integrate into ChannelView)
  ↓
T174-5 (E2E test)
  ↓
T174-6 (security audit)
```

**Critical Path Duration**: ~1.5 days
**Total Duration with Parallelization**: ~2-3 days

---

## Parallelization Opportunities

### Wave 1 (After Schema Changes)
- T166-1 (muteMember) + T167-1 (banMember) + T171-1 (exportChannelHistory) [Parallel]
- T171-2 (CSV helper) + T171-3 (JSON helper) [Parallel]

### Wave 2 (After Mutations Complete)
- T172-2 (MemberRoleDropdown) + T172-4 (MessageModerationMenu) + T172-5 (DeletedMessageIndicator) [Parallel]

### Wave 3 (Testing)
- T174-2 (restore tests) + T174-3 (export tests) [Parallel]

---

## Quality Gates

### Per-Task Quality Gates
- [ ] TypeScript compiles without errors (`pnpm typecheck`)
- [ ] ESLint passes without warnings (`pnpm lint`)
- [ ] Unit tests pass with >80% coverage
- [ ] All mutations validate auth with `requireAuth()` first
- [ ] All mutations validate permissions before execution
- [ ] All queries have `returns:` validator defined
- [ ] JSDoc comments include FR references

### Phase-Specific Gates

#### Backend Quality Gates
- [ ] Mute duration validation (1 hour - 30 days)
- [ ] Cannot mute/ban channel owner
- [ ] Cannot mute/ban global admins
- [ ] Audit trail complete (mutedBy, bannedBy fields populated)
- [ ] Soft delete for messages maintained (no hard deletes)
- [ ] Export action includes rate limiting (max 1 export per 5 minutes per user)
- [ ] Export action validates permission before processing
- [ ] Export respects deleted messages (excludes unless admin)

#### Frontend Quality Gates
- [ ] Admin UI only visible to users with permissions
- [ ] Optimistic updates with rollback on error
- [ ] Loading states for all async actions
- [ ] Toast notifications for success/error
- [ ] Confirmation dialogs for destructive actions (ban, delete)
- [ ] Accessibility: keyboard navigation, ARIA labels
- [ ] Responsive: mobile-friendly admin controls

#### Security Quality Gates (T174-6)
- [ ] Permission checks cannot be bypassed (server-side enforcement)
- [ ] No privilege escalation vectors (moderator → admin)
- [ ] No enumeration attacks (cannot list banned users if not admin)
- [ ] Rate limiting on export prevents abuse
- [ ] Audit trail cannot be tampered with
- [ ] RBAC matrix enforced consistently across all endpoints

---

## Risk Assessment & Mitigations

### High Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Permission bypass** | Critical | Low | Comprehensive security audit (T174-6), unit tests for all permission branches |
| **Privilege escalation** | Critical | Low | Validate caller role in every mutation, test non-admin users attempting admin actions |
| **Export abuse** | Medium | Medium | Rate limiting (5 min cooldown), max 10k messages per export, require admin role |
| **Audit trail gaps** | Medium | Medium | Enforce mutedBy/bannedBy fields required when action taken, add validation tests |

### Medium Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Restore message abuse** | Medium | Low | Admin-only restore, log all restore actions, UI confirmation dialog |
| **Moderator permission confusion** | Low | Medium | Clear UI indicators, JSDoc documentation, permission matrix in CLAUDE.md |
| **Pagination performance** | Low | Medium | Use indexed queries, limit page size to 50, add loading states |

---

## Acceptance Criteria

### T165-T168: Role & Member Management
- [ ] Admins can update member roles (admin, moderator, member)
- [ ] Admins can view paginated member list with role/status
- [ ] Role changes reflected immediately in UI
- [ ] Cannot change owner role without transfer ownership
- [ ] Global admins can manage any channel

### T166-T167: Mute & Ban
- [ ] Admins/moderators can mute members (1 hour - 30 days)
- [ ] Admins can ban members (permanent until unbanned)
- [ ] Muted members cannot send messages (UI disabled, mutation blocked)
- [ ] Banned members cannot access channel (redirect with error)
- [ ] Unmute/unban actions restore full access
- [ ] Audit trail captures who muted/banned and when

### T169-T170: Message Moderation
- [ ] Moderators can delete any message in their channel
- [ ] Deleted messages show "[deleted]" with option to restore (admin only)
- [ ] Admins can restore deleted messages
- [ ] Thread metadata updated correctly on delete/restore
- [ ] User's own messages deletable without moderator role

### T171-T173: History Export
- [ ] Admins/moderators can export channel history (CSV or JSON)
- [ ] Export includes message content, sender, timestamp, reactions
- [ ] Export excludes deleted messages for non-admins
- [ ] Export limited to 10,000 messages per request
- [ ] Rate limiting prevents abuse (1 export per 5 minutes)
- [ ] Export downloads as file (not displayed in browser)

---

## File Manifest

### New Files Created
```
convex/channels/actions.ts                               # T171-1
convex/lib/exportHelpers.ts                              # T171-2, T171-3
src/components/channels/admin/channel-members-panel.tsx  # T172-1
src/components/channels/admin/member-role-dropdown.tsx   # T172-2
src/components/channels/admin/member-moderation-actions.tsx # T172-3
src/components/channels/admin/message-moderation-menu.tsx # T172-4
src/components/messages/deleted-message-indicator.tsx    # T172-5
src/components/channels/admin/export-history-dialog.tsx  # T173-1
convex/channels/memberManagement.test.ts                 # T174-1
convex/messages/channelEditDeleteMutations.test.ts       # T174-2
convex/channels/actions.test.ts                          # T174-3
src/components/channels/admin/__tests__/                 # T174-4
tests/e2e/channel-admin.spec.ts                          # T174-5
```

### Modified Files
```
convex/schema.ts                                         # T165-1, T165-2
convex/channels/types.ts                                 # T165-5
convex/channels/memberManagement.ts                      # T165-4, T166-1, T166-2, T167-1, T167-2
convex/channels/queries.ts                               # T168-1, T168-2
convex/messages/channelEditDeleteMutations.ts            # T169-2, T170-1
convex/messages/threadInternals.ts                       # T170-2
src/app/(dashboard)/messages/channels/[channelId]/page.tsx # T172-6
src/components/channels/channel-settings-menu.tsx       # T173-2
```

---

## Context7 Libraries Required (Pre-Validated by Orchestrator)

| Technology | Library ID | Reputation | Suggested Topics |
|------------|-----------|------------|------------------|
| Convex | /get-convex/convex | ✅ High | schema, mutations, actions, auth |
| React | /facebook/react | ✅ High | hooks, useState, useOptimistic |
| Next.js | /vercel/next.js | ✅ High | app router, server actions |
| TypeScript | /microsoft/typescript | ✅ High | validators, type guards, utility types |
| shadcn/ui | /shadcn-ui/ui | ✅ High | Dialog, DropdownMenu, Button, toast |
| Zod | /colinhacks/zod | ✅ High | object schemas, validation, refine |

---

## Skills Required (Agents Must Consult)

| Domain | Skill Path | Required For |
|--------|------------|--------------|
| **Convex** | `.claude/skills/convex/SKILL.md` | All backend tasks (T165-T171) |
| **Security** | `.claude/skills/security/SKILL.md` | Permission enforcement, audit (T165-T171, T174-6) |
| **React/Next.js** | `.claude/skills/react-nextjs/SKILL.md` | All frontend tasks (T172-T173) |
| **UI Components** | `.claude/skills/ui-components/SKILL.md` | Admin UI components (T172-T173) |
| **TypeScript** | `.claude/skills/typescript/SKILL.md` | Validators, type guards (T165-5) |
| **Testing** | `.claude/skills/testing/SKILL.md` | All test tasks (T174) |

---

## Implementation Notes

### Mute Duration Validation
```typescript
// T166-1: muteMember
const MIN_MUTE_DURATION = 60 * 60 * 1000; // 1 hour
const MAX_MUTE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

if (durationMs < MIN_MUTE_DURATION || durationMs > MAX_MUTE_DURATION) {
  throw new Error("Mute duration must be between 1 hour and 30 days");
}
```

### Export Rate Limiting
```typescript
// T171-1: exportChannelHistory
const EXPORT_COOLDOWN = 5 * 60 * 1000; // 5 minutes
const lastExport = await getLastExportTimestamp(ctx, user._id, channelId);
if (Date.now() - lastExport < EXPORT_COOLDOWN) {
  throw new Error("Please wait 5 minutes between exports");
}
```

### Permission Helper Pattern
```typescript
// Reusable in all admin mutations
async function requireChannelPermission(
  ctx: MutationCtx,
  channelId: Id<"channels">,
  userId: Id<"users">,
  minRole: "moderator" | "admin" | "owner"
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (user?.role === "admin") return; // Global admin bypass

  const membership = await getMembership(ctx, channelId, userId);
  if (!membership || membership.leftAt || membership.isBanned) {
    throw new Error("Access denied");
  }

  const roleHierarchy = { member: 0, moderator: 1, admin: 2, owner: 3 };
  if (roleHierarchy[membership.role] < roleHierarchy[minRole]) {
    throw new Error(`Requires ${minRole} role or higher`);
  }
}
```

---

## Testing Strategy

### Unit Tests (T174-1, T174-2, T174-3)
- Test all permission branches (member, moderator, admin, owner, global admin)
- Test boundary conditions (mute duration min/max, export limit)
- Test error cases (already muted, not a member, banned user)
- Test audit trail population (mutedBy, bannedBy fields)

### Component Tests (T174-4)
- Test admin controls only visible to authorized users
- Test optimistic updates and rollback
- Test confirmation dialogs prevent accidental actions
- Test loading states during async operations

### E2E Tests (T174-5)
```typescript
test('admin can mute and unmute member', async ({ page }) => {
  // Setup: Create channel, add member
  // Login as admin
  // Navigate to channel members panel
  // Click mute button on target member
  // Verify mute dialog appears
  // Select duration (1 day)
  // Confirm mute
  // Verify member shows "Muted until [date]"
  // Verify member cannot send message
  // Click unmute button
  // Verify member can send message again
});
```

### Security Audit (T174-6)
- Attempt privilege escalation (moderator trying to ban)
- Attempt self-promotion (member changing own role)
- Attempt unauthorized export (non-member exporting channel)
- Verify rate limiting prevents export spam
- Verify audit trail immutability

---

## Completion Checklist

### Backend Complete
- [ ] Schema changes deployed and migrated
- [ ] All mutations implement permission checks
- [ ] All mutations populate audit trail fields
- [ ] Export action respects rate limits
- [ ] All queries use indexed lookups
- [ ] Unit tests pass with >80% coverage

### Frontend Complete
- [ ] Admin UI integrated into ChannelView
- [ ] Permission-based visibility working
- [ ] All actions show confirmation dialogs
- [ ] Toast notifications for all outcomes
- [ ] Responsive design on mobile
- [ ] Accessibility compliance (WCAG 2.1 AA)

### Testing Complete
- [ ] All unit tests passing
- [ ] All component tests passing
- [ ] E2E test covering full admin flow
- [ ] Security audit completed with no findings
- [ ] Performance tested (pagination, export)

### Documentation Complete
- [ ] JSDoc comments with FR references
- [ ] Permission matrix documented in code
- [ ] README updated with admin features
- [ ] Migration guide for schema changes

---

## Next Steps After Completion

1. **User Training**: Create admin guide with screenshots
2. **Monitoring**: Add analytics for admin actions (who muted/banned whom)
3. **Future Enhancements**:
   - Scheduled unmute (auto-expire mutes)
   - Bulk moderation actions (mute multiple users)
   - Moderation audit log (searchable history)
   - Custom ban reasons (require reason field)
   - Appeal workflow (banned users can request unban)

---

**Plan Generated**: 2026-01-01
**Plan Version**: 1.0
**Ready for Execution**: Yes ✅
