# Phase 15: Channel Administration - Implementation Guide

**Status**: Ready for Execution ✅
**Complexity**: Medium
**Duration**: 2-3 days
**Tasks**: T165-T174 (35 atomic tasks)

---

## Quick Links

- **[Execution Plan](./plan.md)** - High-level overview, dependencies, quality gates
- **[Task Breakdown](./tasks.md)** - Detailed specifications for all 35 tasks
- **[Feature Spec](./spec.md)** - Functional requirements (if exists)

---

## What This Phase Delivers

### Core Features
1. **Role Management** (FR-038)
   - Update member roles (admin, moderator, member)
   - Permission-based role changes
   - Audit trail for role changes

2. **Member Moderation** (FR-038)
   - Mute members (1 hour - 30 days)
   - Ban members (permanent until unbanned)
   - Unmute/unban capabilities
   - Audit trail (who muted/banned, when)

3. **Message Moderation** (FR-037)
   - Delete any message (moderator+)
   - Restore deleted messages (admin only)
   - Soft delete preservation
   - Thread metadata updates

4. **History Export** (FR-039)
   - Export channel history (CSV or JSON)
   - Include/exclude deleted messages
   - Rate limiting (5 min cooldown)
   - Max 10k messages per export

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SCHEMA LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  channelMembers (enhanced):                                     │
│    - role: "owner" | "admin" | "moderator" | "member"           │
│    - isMuted, mutedUntil, mutedBy (NEW)                         │
│    - isBanned, bannedAt (NEW), bannedBy (NEW)                   │
│                                                                  │
│  messages (existing):                                           │
│    - deletedAt, deletedBy (already exists)                      │
│    - anonymizedAt (prevents restore)                            │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Mutations (convex/channels/memberManagement.ts):               │
│    ✅ updateMemberRole (already exists)                         │
│    ➕ muteMember, unmuteMember (T166)                           │
│    ➕ banMember, unbanMember (T167)                             │
│                                                                  │
│  Queries (convex/channels/queries.ts):                          │
│    ✅ getMembers (enhance with pagination - T168)               │
│    ➕ getMembershipDetails (T168)                               │
│                                                                  │
│  Message Mutations (convex/messages/channelEditDeleteMutations):│
│    ✅ deleteChannelMessage (already exists)                     │
│    ➕ restoreDeletedMessage (T170)                              │
│                                                                  │
│  Actions (convex/channels/actions.ts - NEW):                    │
│    ➕ exportChannelHistory (T171)                               │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Admin UI Components (src/components/channels/admin/):          │
│    ➕ ChannelMembersPanel (T172-1)                              │
│    ➕ MemberRoleDropdown (T172-2)                               │
│    ➕ MemberModerationActions (T172-3)                          │
│    ➕ MessageModerationMenu (T172-4)                            │
│    ➕ DeletedMessageIndicator (T172-5)                          │
│    ➕ ExportHistoryDialog (T173-1)                              │
│                                                                  │
│  Integration (src/app/(dashboard)/messages/channels/):          │
│    ✏️ [channelId]/page.tsx - Add Members tab + moderation      │
│    ✏️ channel-settings-menu.tsx - Add export button            │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       TESTING LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Unit Tests (convex/):                                          │
│    ➕ channels/memberManagement.test.ts (T174-1)                │
│    ➕ messages/channelEditDeleteMutations.test.ts (T174-2)      │
│    ➕ channels/actions.test.ts (T174-3)                         │
│                                                                  │
│  Component Tests (src/components/channels/admin/__tests__/):    │
│    ➕ All admin component tests (T174-4)                        │
│                                                                  │
│  E2E Tests (tests/e2e/):                                        │
│    ➕ channel-admin.spec.ts (T174-5)                            │
│                                                                  │
│  Security Audit:                                                │
│    ➕ Permission enforcement review (T174-6)                    │
└─────────────────────────────────────────────────────────────────┘
```

**Legend**:
- ✅ Already implemented (verify only)
- ➕ New implementation required
- ✏️ Modify existing file

---

## Execution Phases

### Phase 1: Schema Enhancement (5 tasks, ~2 hours)
**Objective**: Add moderation audit fields to schema

| Task | Agent | File | Est. Time |
|------|-------|------|-----------|
| T165-1 | schema-architect | `convex/schema.ts` | 30 min |
| T165-2 | schema-architect | `convex/schema.ts` | 20 min |
| T165-3 | backend-engineer | Verification only | 15 min |
| T165-4 | backend-engineer | `convex/channels/memberManagement.ts` | 10 min |
| T165-5 | typescript-expert | `convex/channels/types.ts` | 30 min |

**Deliverables**:
- Schema fields: `bannedAt`, `mutedBy`, `bannedBy`
- Indexes: `by_channel_muted`, `by_channel_banned`
- Validators: `muteMemberArgsValidator`, `banMemberArgsValidator`

**Quality Gate**: TypeScript compiles, schema validation passes

---

### Phase 2: Backend - Moderation Mutations (6 tasks, ~6 hours)
**Objective**: Implement mute/ban/member management

| Task | Agent | File | Est. Time |
|------|-------|------|-----------|
| T166-1 | backend-engineer | `convex/channels/memberManagement.ts` | 90 min |
| T166-2 | backend-engineer | `convex/channels/memberManagement.ts` | 60 min |
| T167-1 | backend-engineer | `convex/channels/memberManagement.ts` | 90 min |
| T167-2 | backend-engineer | `convex/channels/memberManagement.ts` | 60 min |
| T168-1 | backend-engineer | `convex/channels/queries.ts` | 75 min |
| T168-2 | backend-engineer | `convex/channels/queries.ts` | 45 min |

**Deliverables**:
- Mutations: `muteMember`, `unmuteMember`, `banMember`, `unbanMember`
- Enhanced query: `getMembers` (with pagination)
- New query: `getMembershipDetails`

**Quality Gate**: All mutations enforce permissions, audit trail populated

---

### Phase 3: Backend - Message Moderation (4 tasks, ~2 hours)
**Objective**: Restore deleted messages, update thread metadata

| Task | Agent | File | Est. Time |
|------|-------|------|-----------|
| T169-1 | backend-engineer | Verification only | 15 min |
| T169-2 | backend-engineer | `convex/messages/channelEditDeleteMutations.ts` | 10 min |
| T170-1 | backend-engineer | `convex/messages/channelEditDeleteMutations.ts` | 75 min |
| T170-2 | backend-engineer | `convex/messages/threadInternals.ts` | 30 min |

**Deliverables**:
- Mutation: `restoreDeletedMessage`
- Updated: `updateThreadMetadata` (handles restore)

**Quality Gate**: Restore mutation enforces admin-only, thread metadata accurate

---

### Phase 4: Backend - History Export (3 tasks, ~3.5 hours)
**Objective**: Export channel history as CSV/JSON

| Task | Agent | File | Est. Time |
|------|-------|------|-----------|
| T171-1 | backend-engineer | `convex/channels/actions.ts` | 120 min |
| T171-2 | backend-engineer | `convex/lib/exportHelpers.ts` | 45 min |
| T171-3 | backend-engineer | `convex/lib/exportHelpers.ts` | 30 min |

**Deliverables**:
- Action: `exportChannelHistory`
- Helpers: `formatAsCSV`, `formatAsJSON`

**Quality Gate**: Rate limiting works, export respects permissions, formats valid

---

### Phase 5: Frontend - Admin UI (6 tasks, ~8 hours)
**Objective**: Build admin UI for member/message management

| Task | Agent | File | Est. Time |
|------|-------|------|-----------|
| T172-1 | frontend-engineer | `src/components/channels/admin/channel-members-panel.tsx` | 120 min |
| T172-2 | frontend-engineer | `src/components/channels/admin/member-role-dropdown.tsx` | 60 min |
| T172-3 | frontend-engineer | `src/components/channels/admin/member-moderation-actions.tsx` | 90 min |
| T172-4 | frontend-engineer | `src/components/channels/admin/message-moderation-menu.tsx` | 60 min |
| T172-5 | frontend-engineer | `src/components/messages/deleted-message-indicator.tsx` | 30 min |
| T172-6 | frontend-engineer | `src/app/(dashboard)/messages/channels/[channelId]/page.tsx` | 75 min |

**Deliverables**:
- Admin panel with member list, role management, moderation actions
- Message moderation menu (delete/restore)
- Integration into channel view

**Quality Gate**: UI visible to authorized users only, optimistic updates, accessible

---

### Phase 6: Frontend - Export UI (2 tasks, ~2 hours)
**Objective**: Add export dialog to channel settings

| Task | Agent | File | Est. Time |
|------|-------|------|-----------|
| T173-1 | frontend-engineer | `src/components/channels/admin/export-history-dialog.tsx` | 75 min |
| T173-2 | frontend-engineer | `src/components/channels/channel-settings-menu.tsx` | 30 min |

**Deliverables**:
- Export dialog with format selection
- Integration into channel settings menu

**Quality Gate**: Export triggers download, rate limiting error shown

---

### Phase 7: Testing & Security (6 tasks, ~9 hours)
**Objective**: Comprehensive testing and security audit

| Task | Agent | File | Est. Time |
|------|-------|------|-----------|
| T174-1 | test-architect | `convex/channels/memberManagement.test.ts` | 90 min |
| T174-2 | test-architect | `convex/messages/channelEditDeleteMutations.test.ts` | 60 min |
| T174-3 | test-architect | `convex/channels/actions.test.ts` | 60 min |
| T174-4 | test-architect | `src/components/channels/admin/__tests__/` | 120 min |
| T174-5 | e2e-specialist | `tests/e2e/channel-admin.spec.ts` | 120 min |
| T174-6 | security-auditor | Security audit report | 90 min |

**Deliverables**:
- Unit tests for all mutations (>80% coverage)
- Component tests for all admin UI
- E2E test for full admin flow
- Security audit report

**Quality Gate**: All tests pass, no security vulnerabilities

---

## Permission Matrix (RBAC)

| Action | Member | Moderator | Admin | Owner | Global Admin |
|--------|--------|-----------|-------|-------|--------------|
| **Change roles** | ❌ | ❌ | ✅ (not owner) | ✅ (not creator) | ✅ |
| **Mute members** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Unmute members** | ❌ | ✅ (own mutes) | ✅ | ✅ | ✅ |
| **Ban members** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Unban members** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Delete any message** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Restore messages** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Export history** | ❌ | ✅ | ✅ | ✅ | ✅ |

**Notes**:
- **Owner** = channel creator (role: "owner")
- **Admin** = channel admin (role: "admin")
- **Moderator** = channel moderator (role: "moderator")
- **Global Admin** = system admin (user.role === "admin")

---

## Critical Dependencies

### External Dependencies
- **Existing Implementations**:
  - `updateMemberRole` mutation (T165-3)
  - `deleteChannelMessage` mutation (T169-1)
  - `getMembers` query (enhance in T168-1)

### Internal Dependencies (Critical Path)
```
T165-1 (schema)
  ↓
T165-2 (indexes)
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

---

## Parallelization Strategy

### Wave 1: After Schema (T165-2 complete)
Run in parallel:
- T166-1 (muteMember)
- T167-1 (banMember)
- T168-1 (getMembers pagination)
- T171-1 (exportChannelHistory)
- T171-2 (CSV helper)
- T171-3 (JSON helper)

### Wave 2: After Mutations (T166-2, T167-2 complete)
Run in parallel:
- T172-2 (MemberRoleDropdown)
- T172-4 (MessageModerationMenu)
- T172-5 (DeletedMessageIndicator)

### Wave 3: Testing (After all features complete)
Run in parallel:
- T174-2 (restore message tests)
- T174-3 (export tests)

---

## Risk Mitigation

### High Risks
| Risk | Mitigation |
|------|------------|
| **Permission bypass** | T174-6 security audit, comprehensive unit tests |
| **Privilege escalation** | Test non-admin attempting admin actions |
| **Export abuse** | Rate limiting (5 min), max 10k messages |
| **Audit trail gaps** | Enforce mutedBy/bannedBy required fields |

### Medium Risks
| Risk | Mitigation |
|------|------------|
| **Restore message abuse** | Admin-only restore, confirmation dialogs |
| **Moderator confusion** | Clear UI indicators, permission matrix docs |
| **Pagination performance** | Use indexed queries, limit page size |

---

## Success Criteria

### Functional
- [ ] Admins can update member roles without errors
- [ ] Moderators can mute members with duration selection
- [ ] Admins can ban members with confirmation
- [ ] Moderators can delete any message
- [ ] Admins can restore deleted messages
- [ ] Moderators can export channel history (CSV/JSON)
- [ ] Rate limiting prevents export spam
- [ ] All actions show toast notifications

### Technical
- [ ] TypeScript compiles without errors
- [ ] ESLint passes without warnings
- [ ] All unit tests pass (>80% coverage)
- [ ] Component tests pass
- [ ] E2E test passes reliably
- [ ] Security audit shows no critical vulnerabilities
- [ ] Performance acceptable (pagination <2s, export <5s)

### User Experience
- [ ] Admin controls only visible to authorized users
- [ ] Optimistic updates with rollback on error
- [ ] Loading states for all async actions
- [ ] Confirmation dialogs for destructive actions
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Responsive (mobile-friendly)

---

## Rollback Plan

If critical issues found during T174-6 security audit:

1. **Identify issue severity** (Critical / High / Medium)
2. **If Critical**:
   - STOP deployment
   - Revert schema changes (if possible)
   - Disable admin UI feature flags
   - Fix vulnerability
   - Re-run T174-6 audit
3. **If High/Medium**:
   - Document issue
   - Create follow-up task
   - Deploy with warning
   - Fix in next sprint

---

## Post-Deployment Checklist

- [ ] Schema migration successful (no data loss)
- [ ] All indexes created successfully
- [ ] Admin UI accessible to owners/admins
- [ ] Non-admins cannot see admin controls
- [ ] Mute/ban actions work in production
- [ ] Export generates valid CSV/JSON files
- [ ] Rate limiting prevents abuse
- [ ] Audit trail captured correctly
- [ ] Monitoring dashboards updated
- [ ] User documentation updated

---

## Next Steps (Future Enhancements)

1. **Scheduled unmute** - Auto-expire mutes at specified time
2. **Bulk moderation** - Mute/ban multiple users at once
3. **Moderation audit log** - Searchable history of all actions
4. **Custom ban reasons** - Require reason field for bans
5. **Appeal workflow** - Banned users can request unban
6. **Auto-moderation** - AI-powered spam detection
7. **Warning system** - Warnings before ban (3-strike policy)

---

**Plan Created**: 2026-01-01
**Plan Version**: 1.0
**Orchestrator**: Ready to begin execution ✅
