# Tasks: Enable Pins and Threads in Direct Messages

**Feature**: DM Pins & Threads
**Created**: 2025-12-30
**Estimated Duration**: 6-8 hours (parallelized)

---

## Task List

| ID | Task | Agent | File(s) | Depends | Parallel | Estimate |
|----|------|-------|---------|---------|----------|----------|
| **Phase 1: Schema & Backend** |
| T001 | Update pins schema for DM support | `schema-architect` | `convex/schema.ts` | - | ❌ | 1h |
| T002 | Create DM pin mutations & queries | `backend-engineer` | `convex/pins.ts` | T001 | ❌ | 2h |
| T003 | Verify DM thread backend support | `backend-engineer` | `convex/messages/*.ts` | - | ✅ | 30m |
| **Phase 2: Frontend - Pins** |
| T004 | Wire up pins in dm-message-list | `frontend-engineer` | `src/app/(dashboard)/messages/dm/[conversationId]/components/dm-message-list.tsx` | T002 | ❌ | 1h |
| T005 | Add pinned messages panel to dm-view | `frontend-engineer` | `src/app/(dashboard)/messages/dm/[conversationId]/dm-view.tsx` | T002, T004 | ❌ | 2h |
| **Phase 3: Frontend - Threads** |
| T006 | Enable thread UI in dm-message-list | `frontend-engineer` | `src/app/(dashboard)/messages/dm/[conversationId]/components/dm-message-list.tsx` | T003 | ✅ | 30m |
| T007 | Add thread panel to dm-view | `frontend-engineer` | `src/app/(dashboard)/messages/dm/[conversationId]/dm-view.tsx` | T006 | ❌ | 2h |
| **Phase 4: Component Updates** |
| T008 | Verify/update MessageActionButtons | `frontend-engineer` | `src/components/messaging/message-action-buttons.tsx` | T004 | ❌ | 1h |
| **Phase 5: Testing & QA** |
| T009 | Unit tests for DM pin mutations | `test-architect` | `tests/unit/pins/dmPins.test.ts` | T002 | ✅ | 1.5h |
| T010 | E2E tests for DM pins & threads | `e2e-specialist` | `tests/e2e/dm-pins-threads.spec.ts` | T005, T007 | ❌ | 2h |
| T011 | Code review - Pins & Threads | `code-reviewer` | All modified files | T002, T005, T007, T008 | ❌ | 1h |
| T012 | Security audit - DM pins authorization | `security-auditor` | `convex/pins.ts` | T002 | ✅ | 30m |

---

## Critical Path

```
T001 → T002 → T004 → T005 → T008 → T011
         ↓
T003 → T006 → T007 ────────────────┘
```

**Parallelization Opportunities**:
- T003 || T001-T002
- T006 || T005
- T009 || T005-T008
- T012 || T011

---

## Detailed Task Specifications

### T001: Update pins schema for DM support
**Agent**: schema-architect
**Skills**: `.claude/skills/convex/`

**Changes Required**:
```typescript
// convex/schema.ts
pins: defineTable({
  channelId: v.optional(v.id("channels")),        // Make optional
  conversationId: v.optional(v.id("conversations")), // Add this
  messageId: v.id("messages"),
  pinnedBy: v.id("users"),
  pinnedAt: v.number(),
})
  .index("by_channel", ["channelId"])
  .index("by_channel_time", ["channelId", "pinnedAt"])
  .index("by_message", ["messageId"])
  .index("by_conversation", ["conversationId"])          // Add this
  .index("by_conversation_time", ["conversationId", "pinnedAt"]), // Add this
```

**Acceptance Criteria**:
- Schema compiles without errors
- Existing channel pins remain valid
- New indexes created for conversation queries

---

### T002: Create DM pin mutations & queries
**Agent**: backend-engineer
**Skills**: `.claude/skills/convex/`, `.claude/skills/security/`
**Context7**: `/get-convex/convex` (mutations, queries, auth)

**New Functions**:

1. **pinDMMessage** mutation:
```typescript
export const pinDMMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
  },
  returns: v.id("pins"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify conversation exists
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // Verify user is participant
    if (!conversation.participants.includes(user._id)) {
      throw new Error("Forbidden: Not a conversation participant");
    }

    // Verify message belongs to conversation
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.conversationId !== args.conversationId) {
      throw new Error("Message does not belong to this conversation");
    }
    if (message.deletedAt) {
      throw new Error("Cannot pin a deleted message");
    }

    // Check if already pinned
    const existingPin = await ctx.db
      .query("pins")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (existingPin) return existingPin._id;

    // Create pin
    return await ctx.db.insert("pins", {
      conversationId: args.conversationId,
      messageId: args.messageId,
      pinnedBy: user._id,
      pinnedAt: Date.now(),
    });
  },
});
```

2. **listByConversation** query:
```typescript
export const listByConversation = query({
  args: { conversationId: v.id("conversations") },
  returns: v.array(/* enriched pin type */),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const pins = await ctx.db
      .query("pins")
      .withIndex("by_conversation_time", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .collect();

    // Enrich with message + user details (similar to listByChannel)
    // ...
  },
});
```

3. **Update unpinMessage** to support DM pins (if needed)

**Acceptance Criteria**:
- All mutations have `requireAuth()` first line
- All exports have `returns:` validators
- Conversation membership validated
- JSDoc comments on all exports
- No admin checks (any participant can pin)

---

### T003: Verify DM thread backend support
**Agent**: backend-engineer
**Skills**: `.claude/skills/convex/`

**Investigation Checklist**:
- [ ] Check `convex/messages/send.ts` - does it accept `parentId` for DM messages?
- [ ] Verify `updateThreadMetadata` is called for DM thread replies
- [ ] Test thread queries work with `conversationId` context
- [ ] Document any gaps found

**Acceptance Criteria**:
- Findings documented in task notes
- If working: Confirm no backend changes needed
- If broken: Create follow-up tasks with specific fixes

---

### T004: Wire up pins in dm-message-list
**Agent**: frontend-engineer
**Skills**: `.claude/skills/react-nextjs/`, `.claude/skills/typescript/`

**Changes Required**:
```typescript
// dm-message-list.tsx
interface DMMessageListProps {
  // ... existing props
  conversationId?: string;  // Add this
  onPin?: (messageId: Id<"messages">) => void;  // Add this
  onUnpin?: (pinId: Id<"pins">) => void;  // Add this
}

export function DMMessageList({
  conversationId,
  onPin,
  onUnpin,
  // ... other props
}: DMMessageListProps) {
  // Pass conversationId to MessageActionButtons
  // Wire up onPin/onUnpin handlers
}
```

**Acceptance Criteria**:
- TypeScript compiles
- Props properly typed
- Handlers wired to MessageActionButtons

---

### T005: Add pinned messages panel to dm-view
**Agent**: frontend-engineer
**Skills**: `.claude/skills/react-nextjs/`, `.claude/skills/ui-components/`
**Context7**: `/facebook/react` (useState, useCallback)

**Changes Required**:
```typescript
// dm-view.tsx
import { PinnedMessagesSheet } from "@/components/messaging/pinned-messages-sheet";

export function DMView({ conversationId }: DMViewProps) {
  // Add query
  const pinnedMessages = useQuery(api.pins.listByConversation, {
    conversationId: parsedConversationId,
  });

  // Add mutations
  const pinMutation = useMutation(api.pins.pinDMMessage);
  const unpinMutation = useMutation(api.pins.unpinMessage);

  // Add handlers
  const handlePin = useCallback(async (messageId: Id<"messages">) => {
    try {
      await pinMutation({ conversationId: parsedConversationId, messageId });
      toast.success("Message pinned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to pin");
    }
  }, [parsedConversationId, pinMutation]);

  // Add UI: pinned messages badge/button in header
  // Render PinnedMessagesSheet component
}
```

**Acceptance Criteria**:
- Pinned messages badge shows count (if > 0)
- Sheet opens on click
- Real-time updates via Convex
- Loading states with Skeleton
- Error handling with toast
- Can pin/unpin from sheet

---

### T006: Enable thread UI in dm-message-list
**Agent**: frontend-engineer
**Skills**: `.claude/skills/react-nextjs/`

**Changes Required**:
```typescript
// dm-message-list.tsx
interface DMMessageListProps {
  // ... existing props
  onReply?: (message: Message) => void;  // Add this
  showThreadButton?: boolean;  // Add this
}

export function DMMessageList({
  onReply,
  showThreadButton = false,
  // ... other props
}: DMMessageListProps) {
  // Pass to MessageActionButtons or message rendering
}
```

**Acceptance Criteria**:
- Thread button visible on messages
- Clicking calls `onReply` handler
- TypeScript compiles

---

### T007: Add thread panel to dm-view
**Agent**: frontend-engineer
**Skills**: `.claude/skills/react-nextjs/`, `.claude/skills/ui-components/`

**Changes Required**:
```typescript
// dm-view.tsx
import { ThreadPanel } from "@/components/messaging/thread-panel";

export function DMView({ conversationId }: DMViewProps) {
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);

  const threadReplies = useQuery(
    api.messages.listThreadReplies,
    threadMessage ? { parentId: threadMessage._id } : "skip"
  );

  const handleReply = useCallback((message: Message) => {
    setThreadMessage(message);
  }, []);

  const handleSendReply = useCallback(async (content: string) => {
    if (!threadMessage) return;
    try {
      await sendMessageMutation({
        conversationId: parsedConversationId,
        content,
        parentId: threadMessage._id,
      });
    } catch (error) {
      toast.error("Failed to send reply");
    }
  }, [threadMessage, parsedConversationId, sendMessageMutation]);

  // Render ThreadPanel
  return (
    <>
      <DMMessageList onReply={handleReply} showThreadButton={true} />
      {threadMessage && (
        <ThreadPanel
          message={threadMessage}
          replies={threadReplies}
          onSendReply={handleSendReply}
          onClose={() => setThreadMessage(null)}
        />
      )}
    </>
  );
}
```

**Acceptance Criteria**:
- Thread panel opens on reply click
- Shows parent message + replies
- Can send replies
- Thread metadata updates (count)
- Real-time updates
- Can close panel

---

### T008: Verify/update MessageActionButtons
**Agent**: frontend-engineer
**Skills**: `.claude/skills/react-nextjs/`, `.claude/skills/typescript/`

**Investigation**:
1. Check if component accepts `conversationId` prop
2. Check if pin/unpin logic supports DM context
3. Update types/logic if needed

**Acceptance Criteria**:
- Component works for both channel and DM contexts
- Pin button shows correct state for DMs
- TypeScript types updated

---

### T009: Unit tests for DM pin mutations
**Agent**: test-architect
**Skills**: `.claude/skills/testing/`, `.claude/skills/convex/`
**Context7**: `/vitest-dev/vitest` (testing patterns)

**Test File**: `tests/unit/pins/dmPins.test.ts`

**Test Cases**:
```typescript
describe("pinDMMessage", () => {
  it("should pin message successfully", async () => {
    // Setup conversation + message
    // Call pinDMMessage
    // Verify pin created
  });

  it("should return existing pin ID if already pinned", async () => {
    // ...
  });

  it("should reject if user not a participant", async () => {
    // ...
  });

  it("should reject if message not in conversation", async () => {
    // ...
  });
});

describe("listByConversation", () => {
  it("should return all pins sorted by time", async () => {
    // ...
  });

  it("should enrich with message and user data", async () => {
    // ...
  });
});
```

**Acceptance Criteria**:
- All tests pass
- Coverage > 80% for new mutations
- Uses `convex-test` patterns

---

### T010: E2E tests for DM pins & threads
**Agent**: e2e-specialist
**Skills**: `.claude/skills/testing/`
**Context7**: `/microsoft/playwright` (selectors, assertions)

**Test File**: `tests/e2e/dm-pins-threads.spec.ts`

**Scenarios**:
```typescript
test("should pin and unpin DM message", async ({ page }) => {
  // Navigate to DM
  // Hover over message
  // Click pin button
  // Verify badge appears
  // Open pinned messages sheet
  // Verify message in sheet
  // Unpin
  // Verify badge disappears
});

test("should create and view thread in DM", async ({ page }) => {
  // Navigate to DM
  // Click reply on message
  // Verify thread panel opens
  // Type and send reply
  // Verify reply in thread
  // Verify thread count updated
  // Close panel
});
```

**Acceptance Criteria**:
- All scenarios pass
- No arbitrary timeouts (use proper waits)
- Proper cleanup after tests

---

### T011: Code review - Pins & Threads
**Agent**: code-reviewer

**Review Checklist**:
- [ ] Schema changes backward-compatible
- [ ] Mutations have `requireAuth()` first line
- [ ] Mutations have `returns:` validators
- [ ] Indexes used (no large `.filter()` calls)
- [ ] Error handling complete
- [ ] Loading states with Skeleton
- [ ] TypeScript strict mode (no `any`)
- [ ] JSDoc comments on exports
- [ ] UI consistent with channel patterns

**Acceptance Criteria**:
- All checks passed or documented exceptions
- Feedback provided to implementing agents
- No blocking issues

---

### T012: Security audit - DM pins authorization
**Agent**: security-auditor
**Skills**: `.claude/skills/security/`

**Security Checks**:
- [ ] Conversation membership validated before pin/unpin
- [ ] No privilege escalation possible
- [ ] Message ownership verified
- [ ] Deleted messages cannot be pinned
- [ ] Input validation (Zod validators)
- [ ] No information leakage in error messages

**Acceptance Criteria**:
- All security checks passed
- No vulnerabilities found
- Authorization model documented

---

## Skills Required for All Tasks

| Skill | Path | Used By |
|-------|------|---------|
| Convex | `.claude/skills/convex/` | T001, T002, T003, T009 |
| React/Next.js | `.claude/skills/react-nextjs/` | T004, T005, T006, T007, T008 |
| TypeScript | `.claude/skills/typescript/` | T004, T008 |
| UI Components | `.claude/skills/ui-components/` | T005, T007 |
| Testing | `.claude/skills/testing/` | T009, T010 |
| Security | `.claude/skills/security/` | T002, T012 |

---

## Quality Gates (Final Verification)

After all tasks complete:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] `pnpm test:e2e` passes
- [ ] Pin/unpin works in DMs (manual test)
- [ ] Pinned messages panel visible in DM view
- [ ] Thread reply works in DMs
- [ ] Thread panel opens and functions correctly
- [ ] No console errors in browser
- [ ] Real-time updates work (test with two users)

---

**Status**: ✅ Ready for Execution
**Next Step**: Begin with T001 (schema-architect) and T003 (backend-engineer) in parallel
