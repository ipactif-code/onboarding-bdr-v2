# Implementation Plan: Enable Pins and Threads in Direct Messages

**Feature**: DM Pins & Threads
**Complexity**: M (Medium)
**Estimated Duration**: 6-8 hours
**Created**: 2025-12-30

---

## Executive Summary

Enable two existing channel features (Pins and Threads) in the Direct Messages context.

**Pins Status**: 🔴 Blocked - Schema requires `channelId`, no `conversationId` support
**Threads Status**: 🟡 Partially Ready - Schema supports DM threads, frontend not wired

---

## Prerequisites

- [x] Convex backend running
- [x] Clerk authentication configured
- [x] Messages table supports both channelId and conversationId
- [ ] Pins table schema updated for DM support
- [ ] Thread UI components exist and are reusable

---

## Phase 1: Schema & Backend Foundation

### Task T001: Update pins schema for DM support
**Agent**: `schema-architect`
**File**: `convex/schema.ts`
**Depends**: -
**Parallel**: ❌
**Estimate**: 1 hour

**Changes**:
1. Make `pins.channelId` optional: `v.optional(v.id("channels"))`
2. Add `pins.conversationId` optional: `v.optional(v.id("conversations"))`
3. Add indexes:
   - `.index("by_conversation", ["conversationId"])`
   - `.index("by_conversation_time", ["conversationId", "pinnedAt"])`

**Acceptance Criteria**:
- Schema compiles without errors
- Existing channel pins data remains valid
- Either `channelId` OR `conversationId` must be set (validation in mutations)

**Risks**:
- Migration: Existing pins have non-nullable `channelId`
- Mitigation: Make field optional in schema, add runtime validation in mutations

---

### Task T002: Create DM pin mutations
**Agent**: `backend-engineer`
**File**: `convex/pins.ts` (or new `convex/pins/dmPins.ts`)
**Depends**: T001
**Parallel**: ❌
**Estimate**: 2 hours

**Changes**:
1. Create `pinDMMessage` mutation:
   ```typescript
   args: { conversationId: v.id("conversations"), messageId: v.id("messages") }
   ```
   - Verify conversation exists
   - Verify message belongs to conversation
   - Verify user is participant (via `conversations.participants`)
   - Check if already pinned (return existing pin ID)
   - Insert pin with `conversationId`

2. Update `unpinMessage` mutation (or create `unpinDMMessage`):
   - Support pins with `conversationId`
   - Authorization: Any conversation participant can unpin

3. Create `listByConversation` query:
   ```typescript
   args: { conversationId: v.id("conversations") }
   ```
   - Use `by_conversation_time` index
   - Return enriched pins (message + sender + pinnedByUser)

**Acceptance Criteria**:
- Mutations have `returns:` validators
- `requireAuth()` called first line
- Conversation membership validated
- No admin check (DMs have no admin concept)
- JSDoc comments on exports

---

### Task T003: Verify DM thread backend support
**Agent**: `backend-engineer`
**File**: `convex/messages/send.ts` (or relevant message mutations)
**Depends**: -
**Parallel**: ✅ (can run parallel with T001/T002)
**Estimate**: 30 minutes

**Investigation**:
1. Verify `send` mutation accepts `parentId` for DM messages
2. Verify `updateThreadMetadata` is called for DM threads
3. Confirm thread queries work with `conversationId` context

**Acceptance Criteria**:
- Document findings in task notes
- If gaps found: Create follow-up tasks
- If working: Confirm no backend changes needed

---

## Phase 2: Frontend - Pins Integration

### Task T004: Wire up DM pins in dm-message-list
**Agent**: `frontend-engineer`
**File**: `src/app/(dashboard)/messages/dm/[conversationId]/components/dm-message-list.tsx`
**Depends**: T002
**Parallel**: ❌
**Estimate**: 1 hour

**Changes**:
1. Add props:
   ```typescript
   conversationId: string
   onPin?: (messageId: Id<"messages">) => void
   onUnpin?: (pinId: Id<"pins">) => void
   ```

2. Pass `conversationId` to `MessageActionButtons` (if it supports pins)
3. Wire up `onPin`/`onUnpin` handlers from parent

**Acceptance Criteria**:
- TypeScript compiles
- Props typed correctly
- No runtime errors

---

### Task T005: Add pinned messages panel to dm-view
**Agent**: `frontend-engineer`
**File**: `src/app/(dashboard)/messages/dm/[conversationId]/dm-view.tsx`
**Depends**: T002, T004
**Parallel**: ❌
**Estimate**: 2 hours

**Changes**:
1. Import/create `PinnedMessagesSheet` component (check if exists in channel view)
2. Add Convex query:
   ```typescript
   const pinnedMessages = useQuery(api.pins.listByConversation, {
     conversationId: parsedConversationId
   });
   ```

3. Add mutations:
   ```typescript
   const pinMutation = useMutation(api.pins.pinDMMessage);
   const unpinMutation = useMutation(api.pins.unpinMessage);
   ```

4. Add pinned messages UI to header:
   - Badge showing pin count (if > 0)
   - Button/icon to open pinned messages sheet

5. Wire up handlers:
   ```typescript
   const handlePin = async (messageId: Id<"messages">) => {
     await pinMutation({ conversationId: parsedConversationId, messageId });
   };
   ```

**Acceptance Criteria**:
- Pinned messages sheet opens on click
- Shows all pinned messages for conversation
- Pin/unpin actions work
- Real-time updates via Convex subscription
- Loading states with Skeleton
- Error handling with toast

---

## Phase 3: Frontend - Threads Integration

### Task T006: Enable thread UI in dm-message-list
**Agent**: `frontend-engineer`
**File**: `src/app/(dashboard)/messages/dm/[conversationId]/components/dm-message-list.tsx`
**Depends**: T003
**Parallel**: ✅ (can run parallel with T005)
**Estimate**: 30 minutes

**Changes**:
1. Add props:
   ```typescript
   onReply?: (message: Message) => void
   showThreadButton?: boolean
   ```

2. Set `showThreadButton={true}` when rendering messages
3. Wire up `onReply` handler from parent

**Acceptance Criteria**:
- Thread button visible on DM messages
- Clicking opens thread (handled by parent)

---

### Task T007: Add thread panel to dm-view
**Agent**: `frontend-engineer`
**File**: `src/app/(dashboard)/messages/dm/[conversationId]/dm-view.tsx`
**Depends**: T006
**Parallel**: ❌
**Estimate**: 2 hours

**Changes**:
1. Import `ThreadPanel` component (check if exists in channel view)
2. Add thread state:
   ```typescript
   const [threadMessage, setThreadMessage] = useState<Message | null>(null);
   ```

3. Add thread query:
   ```typescript
   const threadReplies = useQuery(
     api.messages.listThreadReplies,
     threadMessage ? { parentId: threadMessage._id } : "skip"
   );
   ```

4. Add reply mutation (should already exist):
   ```typescript
   const sendReplyMutation = useMutation(api.messages.send);
   ```

5. Wire up handlers:
   ```typescript
   const handleReply = (message: Message) => {
     setThreadMessage(message);
   };

   const handleSendReply = async (content: string) => {
     if (!threadMessage) return;
     await sendReplyMutation({
       conversationId: parsedConversationId,
       content,
       parentId: threadMessage._id
     });
   };
   ```

6. Render `ThreadPanel` component

**Acceptance Criteria**:
- Thread panel opens when reply clicked
- Shows parent message + replies
- Can send replies
- Thread metadata updates (reply count)
- Real-time updates
- Can close thread panel

---

## Phase 4: Component Verification & Updates

### Task T008: Verify/update MessageActionButtons for DM context
**Agent**: `frontend-engineer`
**File**: `src/components/messaging/message-action-buttons.tsx`
**Depends**: T004
**Parallel**: ❌
**Estimate**: 1 hour

**Investigation & Changes**:
1. Check if component supports `conversationId` prop
2. Check if pin/unpin actions work with `conversationId`
3. Update component if needed to support both contexts:
   - Channel context: uses `channelId`
   - DM context: uses `conversationId`

**Acceptance Criteria**:
- Component supports both channel and DM contexts
- Pin button shows correct state for DM messages
- TypeScript types updated

---

## Phase 5: Testing & Quality Assurance

### Task T009: Unit tests for DM pin mutations
**Agent**: `test-architect`
**File**: `tests/unit/pins/dmPins.test.ts`
**Depends**: T002
**Parallel**: ✅ (can run parallel with T005-T008)
**Estimate**: 1.5 hours

**Test Cases**:
1. `pinDMMessage`:
   - ✅ Pins message successfully
   - ✅ Returns existing pin ID if already pinned
   - ❌ Rejects if conversation not found
   - ❌ Rejects if message not in conversation
   - ❌ Rejects if user not a participant
   - ❌ Rejects if not authenticated

2. `unpinMessage` (DM context):
   - ✅ Unpins successfully
   - ❌ Rejects if pin not found
   - ❌ Rejects if user not a participant

3. `listByConversation`:
   - ✅ Returns all pins for conversation
   - ✅ Sorted by pinnedAt descending
   - ✅ Enriched with message + user data
   - ✅ Empty array if no pins

**Acceptance Criteria**:
- All tests pass
- Coverage > 80% for pin mutations
- Uses `convex-test` for backend tests

---

### Task T010: E2E tests for DM pins & threads
**Agent**: `e2e-specialist`
**File**: `tests/e2e/dm-pins-threads.spec.ts`
**Depends**: T005, T007
**Parallel**: ❌
**Estimate**: 2 hours

**Test Scenarios**:
1. **Pin Flow**:
   - Navigate to DM conversation
   - Hover over message, click pin
   - Verify pin badge appears
   - Open pinned messages sheet
   - Verify message appears in sheet
   - Unpin message
   - Verify badge disappears

2. **Thread Flow**:
   - Navigate to DM conversation
   - Click reply on message
   - Verify thread panel opens
   - Send reply
   - Verify reply appears in thread
   - Verify thread count updates on parent message
   - Close thread panel

**Acceptance Criteria**:
- All E2E scenarios pass
- Tests use Playwright best practices
- Proper wait conditions (no arbitrary timeouts)

---

### Task T011: Code review - Pins & Threads
**Agent**: `code-reviewer`
**Depends**: T002, T005, T007, T008
**Parallel**: ❌
**Estimate**: 1 hour

**Review Checklist**:
- [ ] Schema changes backward-compatible
- [ ] Mutations have `requireAuth()` first line
- [ ] Mutations have `returns:` validators
- [ ] Indexes used (no `.filter()` on large collections)
- [ ] Error handling complete (toast for user-facing errors)
- [ ] Loading states implemented (Skeleton)
- [ ] TypeScript strict mode compliance (no `any`)
- [ ] JSDoc comments on exports
- [ ] UI matches channel patterns (consistency)

---

### Task T012: Security audit - DM pins authorization
**Agent**: `security-auditor`
**Depends**: T002
**Parallel**: ✅ (can run parallel with T011)
**Estimate**: 30 minutes

**Security Checks**:
- [ ] Conversation membership validated before pin/unpin
- [ ] No privilege escalation (any participant can pin)
- [ ] Message ownership verified (message belongs to conversation)
- [ ] Deleted messages cannot be pinned
- [ ] Input validation complete (Zod validators)

---

## Quality Gates

- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] ESLint passes: `pnpm lint`
- [ ] Unit tests pass: `pnpm test`
- [ ] E2E tests pass: `pnpm test:e2e`
- [ ] Pin/unpin works in DMs
- [ ] Pinned messages panel visible in DM view
- [ ] Thread reply button visible in DMs
- [ ] Thread panel opens on reply
- [ ] Backend validates conversation membership
- [ ] UI consistent with channel patterns

---

## Critical Path

```
T001 (schema) → T002 (backend pins) → T004 (message-list pins) → T005 (dm-view pins) → T011 (review)
                                                                                      ↓
T003 (verify threads) → T006 (message-list threads) → T007 (dm-view threads) --------┘
```

**Parallel Opportunities**:
- T003 can run parallel with T001/T002
- T006 can run parallel with T005
- T009 can run parallel with T005-T008
- T012 can run parallel with T011

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pins schema migration breaks existing data | High | Make `channelId` optional but validate in mutations that exactly one of `channelId`/`conversationId` is set |
| Permission model confusion (DM vs Channel) | Medium | Clear documentation: DMs have no admin, any participant can pin |
| UI inconsistency with channels | Low | Reuse `PinnedMessagesSheet` and `ThreadPanel` components from channel implementation |
| Thread backend not DM-ready | Medium | T003 verifies this early; create follow-up tasks if gaps found |

---

## Rollback Plan

If issues arise in production:

1. **Pins**: Schema change is additive (optional fields), can be rolled back by reverting mutations
2. **Threads**: Frontend-only changes, can disable UI without backend rollback
3. **Full Rollback**: Revert to previous git commit, schema migration is backward-compatible

---

## Success Metrics

- [ ] Users can pin messages in DMs
- [ ] Users can view pinned messages in DM panel
- [ ] Users can reply to messages in threads (DM context)
- [ ] Thread metadata updates correctly for DM threads
- [ ] No performance regression (query times < 100ms)
- [ ] No errors in production logs

---

## Next Steps After Completion

1. User documentation: Update help docs with DM pins/threads features
2. Changelog entry: Add to release notes
3. Analytics: Track pin/thread usage in DMs vs channels
4. Consider: Mobile app parity (if applicable)

---

## Agent Assignments Summary

| Agent | Task Count | Total Estimate |
|-------|------------|----------------|
| schema-architect | 1 | 1h |
| backend-engineer | 2 | 2.5h |
| frontend-engineer | 5 | 6.5h |
| test-architect | 1 | 1.5h |
| e2e-specialist | 1 | 2h |
| code-reviewer | 1 | 1h |
| security-auditor | 1 | 0.5h |

**Total**: 12 tasks, ~15 hours estimated (with parallelization: ~10 hours wall-clock time)

---

## Skills Required

- `.claude/skills/convex/` - Schema patterns, mutation patterns, auth patterns
- `.claude/skills/react-nextjs/` - Component composition, hooks, real-time data
- `.claude/skills/ui-components/` - shadcn/ui patterns, Sheet component
- `.claude/skills/security/` - Auth validation, RBAC patterns
- `.claude/skills/testing/` - Convex-test, Playwright patterns
- `.claude/skills/typescript/` - Type inference, utility types

---

## Context7 Documentation Required

| Technology | Library ID | Topics |
|------------|-----------|--------|
| Convex | `/get-convex/convex` | schema optional fields, indexes, mutations |
| React | `/facebook/react` | useState, useCallback, conditional rendering |
| Next.js | `/vercel/next.js` | client components, routing |

---

**Plan Status**: ✅ Ready for Execution
**Output Location**: `specs/dm-pins-threads/tasks.md` (to be generated)
