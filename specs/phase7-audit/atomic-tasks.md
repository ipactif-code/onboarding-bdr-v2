# Phase 7 Audit Fixes - Atomic Task Breakdown

**Created**: 2025-12-26
**Priority**: P0 (Critical) → P2 (Medium)
**Estimated Duration**: 1-2 days
**Dependencies**: All tasks operate on existing code from Phase 6 completion

---

## Execution Groups

Tasks are organized by dependency order and parallelization opportunities.

---

## Group A: Quick Cleanup & Simple Fixes [Parallel ✅]

**All tasks in this group can run in parallel - no dependencies**

### Task A1: Delete Dead Code [XS]
- **File**: `src/hooks/use-threads.ts`
- **Agent**: `frontend-engineer`
- **Size**: XS (5 min)
- **Action**: DELETE the entire file (confirmed dead code - grep shows no imports)
- **Validation**:
  - `grep -r "use-threads" src/` returns nothing
  - `pnpm typecheck` passes
- **Dependencies**: None
- **Parallel**: ✅

### Task A2: Add TypeScript Tech Debt Comment [XS]
- **File**: `src/hooks/use-thread.ts:9`
- **Agent**: `frontend-engineer`
- **Size**: XS (5 min)
- **Action**: Add JSDoc comment above `const api: any` explaining the tech debt
  ```typescript
  /**
   * [TECH DEBT] Using `any` to avoid Convex deep type instantiation (TS2589).
   * This is a known Convex limitation with complex generated types.
   * See: https://github.com/get-convex/convex-js/issues/XXX
   * TODO: Remove when Convex resolves TS2589 in generated API types
   */
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const api: any = require("../../convex/_generated/api").api;
  ```
- **Validation**: Comment exists, explains rationale
- **Dependencies**: None
- **Parallel**: ✅

### Task A3: Add Security JSDoc to threadInternals [XS]
- **File**: `convex/messages/threadInternals.ts:19`
- **Agent**: `security-auditor`
- **Size**: XS (10 min)
- **Action**: Enhance JSDoc with security considerations
  ```typescript
  /**
   * Update thread metadata (reply count and last reply time) on a parent message.
   *
   * **Security Note:**
   * - This is an internal mutation (not exposed to client)
   * - Called only by backend mutations after authentication/authorization
   * - No direct user input - parentId comes from authenticated mutation context
   * - Uses database indexes for safe, performant queries
   *
   * This internal mutation recalculates and updates the `threadReplyCount` and
   * `threadLastReplyAt` fields on a parent message by counting all non-deleted
   * replies and finding the most recent reply timestamp.
   *
   * T082.1: Called after replies are added or deleted to keep thread metadata in sync.
   *
   * @param parentId - The ID of the parent message whose metadata should be updated
   */
  ```
- **Validation**: Security considerations documented
- **Dependencies**: None
- **Parallel**: ✅

### Task A4: Add prefers-reduced-motion Support [S]
- **File**: `src/app/globals.css`
- **Agent**: `accessibility-expert`
- **Size**: S (15 min)
- **Action**: Add motion preferences query at bottom of file
  ```css
  /* ============================================================================
     Accessibility: Reduced Motion
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
- **Validation**:
  - Browser dev tools > Emulate CSS media > prefers-reduced-motion
  - Animations are disabled when preference is active
- **Dependencies**: None
- **Parallel**: ✅

---

## Group B: Backend Fixes [Sequential]

**Backend tasks must run in order due to data flow dependencies**

### Task B1: Call updateThreadMetadata After Delete [M]
- **File**: `convex/messages/channelEditDeleteMutations.ts:77-128`
- **Agent**: `backend-engineer`
- **Size**: M (30 min)
- **Action**:
  1. Import `internal` API and updateThreadMetadata
  2. After soft delete (line 124), check if message was a reply
  3. If `message.parentId` exists, call `ctx.scheduler.runAfter(0, internal.messages.threadInternals.updateThreadMetadata, { parentId: message.parentId })`
  4. Add JSDoc explaining the updateThreadMetadata call
- **Code Location**: After line 124
  ```typescript
  // Soft delete
  await ctx.db.patch(args.messageId, {
    deletedAt: Date.now(),
    deletedBy: user._id,
  });

  // Update parent thread metadata if this was a reply
  if (message.parentId) {
    await ctx.scheduler.runAfter(
      0,
      internal.messages.threadInternals.updateThreadMetadata,
      { parentId: message.parentId }
    );
  }

  return null;
  ```
- **Validation**:
  - Create a thread with 3 replies
  - Delete one reply
  - Verify parent `threadReplyCount` decrements correctly
  - Verify `threadLastReplyAt` updates if latest reply was deleted
- **Dependencies**: None (operates on existing code)
- **Parallel**: ❌ (blocks B2)

### Task B2: Unit Tests for Thread Metadata Logic [M]
- **File**: `tests/unit/convex/threads.test.ts` (new file)
- **Agent**: `test-architect`
- **Size**: M (1 hour)
- **Action**: Create comprehensive unit tests using convex-test
  ```typescript
  import { convexTest } from "convex-test";
  import { describe, expect, it, beforeEach } from "vitest";
  import { api } from "../../../convex/_generated/api";
  import { internal } from "../../../convex/_generated/api";
  import schema from "../../../convex/schema";

  describe("Thread Metadata", () => {
    it("should update thread reply count when reply is deleted", async () => {
      // Setup: Create channel, parent message, 3 replies
      // Act: Delete one reply
      // Assert: Parent threadReplyCount === 2
    });

    it("should update threadLastReplyAt when latest reply is deleted", async () => {
      // Setup: Create thread with replies at T1, T2, T3
      // Act: Delete reply at T3
      // Assert: threadLastReplyAt === T2
    });

    it("should set threadLastReplyAt to undefined when all replies deleted", async () => {
      // Setup: Create thread with 1 reply
      // Act: Delete the reply
      // Assert: threadLastReplyAt === undefined, threadReplyCount === 0
    });

    it("should handle deleting a non-reply message gracefully", async () => {
      // Setup: Create top-level message (no parentId)
      // Act: Delete it
      // Assert: No errors, no updateThreadMetadata called
    });
  });
  ```
- **Validation**:
  - `pnpm test tests/unit/convex/threads.test.ts`
  - All 4 tests pass
  - Coverage includes edge cases (0 replies, last reply deleted)
- **Dependencies**: B1 (needs the updateThreadMetadata call implemented)
- **Parallel**: ❌

---

## Group C: Accessibility Fixes [Sequential within, parallel between C1/C2]

### Task C1: Auto-Focus Close Button in ThreadPanel [S]
- **File**: `src/components/messaging/thread-panel.tsx`
- **Agent**: `accessibility-expert`
- **Size**: S (20 min)
- **Action**:
  1. Add `useEffect` to focus close button when panel opens
  2. Use `aria-describedby` to connect panel to close button
  ```typescript
  // After line 64 (inside ThreadPanel component)
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus close button when panel opens
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      // Small delay to let Sheet animation start
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);
  ```

  3. Update ThreadView to accept closeButtonRef prop
  4. Pass ref to close button in ThreadView (line 108-116)
  ```tsx
  <Button
    ref={closeButtonRef} // Add this
    variant="ghost"
    size="icon"
    onClick={onClose}
    aria-label="Close thread"
    className="min-h-11 min-w-11"
  >
    <X className="size-4" aria-hidden="true" />
  </Button>
  ```
- **Validation**:
  - Open thread panel
  - Close button should receive focus automatically
  - Press Tab - focus moves to next interactive element
  - Screen reader announces "Close thread button"
- **Dependencies**: None
- **Parallel**: ✅ (independent from C2)

### Task C2: Restore Focus to Trigger on ThreadPanel Close [M]
- **File**: `src/app/(dashboard)/messages/[channelId]/channel-view.tsx`
- **Agent**: `frontend-engineer`
- **Size**: M (45 min)
- **Action**:
  1. Track the trigger button ref (the reply button that opened the thread)
  2. Store it when opening thread
  3. Restore focus when closing thread
  ```typescript
  // After line 82 (state declarations)
  const threadTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Modify handleReply (line 143)
  const handleReply = useCallback((messageId: Id<"messages">, triggerElement?: HTMLButtonElement) => {
    if (triggerElement) {
      threadTriggerRef.current = triggerElement;
    }
    setOpenThreadId(messageId);
  }, []);

  // Modify handleCloseThread (line 147)
  const handleCloseThread = useCallback(() => {
    setOpenThreadId(null);

    // Restore focus to trigger button after a brief delay
    // (allows Sheet close animation to complete)
    if (threadTriggerRef.current) {
      setTimeout(() => {
        threadTriggerRef.current?.focus();
        threadTriggerRef.current = null;
      }, 150);
    }
  }, []);
  ```

  4. Update MessageList to pass button ref to onReply callback
  5. Modify message-item.tsx reply button to use forwardRef pattern
- **Validation**:
  - Click reply button on a message
  - Thread panel opens
  - Press Escape or click close
  - Focus returns to the reply button that opened the thread
  - Keyboard navigation continues from that point
- **Dependencies**: None
- **Parallel**: ✅ (independent from C1)

### Task C3: Add aria-live to Thread Feed [S]
- **File**: `src/components/messaging/thread-view.tsx:201`
- **Agent**: `accessibility-expert`
- **Size**: S (10 min)
- **Action**: Add `aria-live="polite"` to the replies feed
  ```tsx
  {/* Line 200-204 */}
  <div
    role="feed"
    aria-label="Thread replies"
    aria-live="polite" // Add this
    className="flex-1 overflow-y-auto"
  >
  ```
- **Validation**:
  - Open thread panel
  - Send a new reply from another user (simulate via Convex dashboard)
  - Screen reader should announce "New reply from [username]"
- **Dependencies**: None
- **Parallel**: ✅

### Task C4: Add focus-visible Styles to Message Actions [XS]
- **File**: `src/components/messaging/message-item.tsx:162`
- **Agent**: `frontend-engineer`
- **Size**: XS (5 min)
- **Action**: Update action buttons container class
  ```tsx
  {/* Line 159-163 */}
  <div
    className={cn(
      "absolute right-4 top-2 flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 shadow-sm",
      "opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 focus-visible:opacity-100" // Add focus-visible
    )}
  >
  ```
- **Validation**:
  - Tab to a message
  - Press Tab again to reach action buttons
  - Buttons become visible when focused via keyboard
  - Works without mouse hover
- **Dependencies**: None
- **Parallel**: ✅

---

## Group D: Frontend Refactoring [Sequential]

**Refactoring tasks split large files into smaller, more maintainable components**

### Task D1: Extract RichTextContent Component [M]
- **File**: `src/components/messaging/message-item.tsx:139`
- **New File**: `src/components/messaging/rich-text-content.tsx`
- **Agent**: `frontend-engineer`
- **Size**: M (1 hour)
- **Action**:
  1. Create new component `RichTextContent`:
  ```tsx
  "use client";

  import { useMemo } from "react";
  import { cn } from "@/lib/utils";

  interface RichTextContentProps {
    content: string;
    className?: string;
  }

  /**
   * Renders rich text content from serialized Plate.js format.
   * Falls back to plain text if content is not valid JSON.
   */
  export function RichTextContent({ content, className }: RichTextContentProps) {
    const renderedContent = useMemo(() => {
      try {
        const parsed = JSON.parse(content);
        // TODO: Use Plate.js rendering when we implement rich text display
        // For now, extract plain text
        return extractPlainText(parsed);
      } catch {
        // Not JSON, treat as plain text
        return content;
      }
    }, [content]);

    return (
      <div className={cn("whitespace-pre-wrap break-words text-sm text-foreground", className)}>
        {renderedContent}
      </div>
    );
  }

  function extractPlainText(nodes: unknown[]): string {
    // Similar to getTextFromValue in message-input.tsx
    // Extract plain text from Plate.js structure
  }
  ```

  2. Replace line 137-140 in message-item.tsx:
  ```tsx
  {/* Message body */}
  <RichTextContent content={content} className="mt-1" />
  ```

  3. Update imports in message-item.tsx
- **Validation**:
  - Existing messages render correctly
  - New messages with formatting render
  - Plain text messages still work
  - `pnpm typecheck` passes
- **Dependencies**: None
- **Parallel**: ❌ (blocks D2)

### Task D2: Refactor thread-view.tsx to < 200 Lines [L]
- **File**: `src/components/messaging/thread-view.tsx` (247 lines)
- **Agent**: `frontend-engineer`
- **Size**: L (1.5 hours)
- **Action**: Extract sub-components
  1. Extract `ThreadViewHeader` (lines 105-119, 132-145, 165-179)
  2. Extract `ThreadEmptyState` (lines 146-156, 206-214)
  3. Create `src/components/messaging/thread-view-header.tsx`
  4. Create `src/components/messaging/thread-empty-state.tsx`
  5. Reduce main file to ~150 lines
- **Validation**:
  - Thread panel opens/closes correctly
  - Header displays with close button
  - Empty state shows when no replies
  - Loading state works
  - All interactive elements functional
- **Dependencies**: D1 (RichTextContent must exist first)
- **Parallel**: ❌ (blocks D3)

### Task D3: Refactor message-input.tsx to < 200 Lines [L]
- **File**: `src/components/messaging/message-input.tsx` (272 lines)
- **Agent**: `frontend-engineer`
- **Size**: L (1.5 hours)
- **Action**: Extract helpers and sub-components
  1. Extract Plate.js serialization utils to `src/lib/plate-utils.ts`
     - `createEmptyEditorValue()`
     - `getTextFromValue()`
     - `serializeEditorValue()`
  2. Extract `CharacterCounter` component
  3. Move `MessageInputPlugins` to `src/lib/message-editor-config.ts`
  4. Reduce main file to ~180 lines
- **Validation**:
  - Message input works as before
  - Character counter appears near limit
  - Enter sends, Shift+Enter new line
  - Formatting shortcuts work (Cmd+B, Cmd+I, Cmd+E)
- **Dependencies**: D2 (thread-view refactor complete)
- **Parallel**: ❌ (blocks D4)

### Task D4: Refactor channel-view.tsx to < 200 Lines [L]
- **File**: `src/app/(dashboard)/messages/[channelId]/channel-view.tsx` (369 lines)
- **Agent**: `frontend-engineer`
- **Size**: L (2 hours)
- **Action**: Extract sub-components
  1. Extract `ChannelNotFound` (lines 212-221)
  2. Extract `ChannelJoinPrompt` (lines 227-259)
  3. Extract `ChannelArchivedNotice` (lines 305-310)
  4. Create hooks for message actions:
     - `useChannelMessageActions.ts` (handleSend, handleReply, handleEdit, handleDelete)
  5. Move to `src/components/messaging/channel-view-states.tsx`
  6. Reduce main file to ~200 lines
- **Validation**:
  - Channel view renders all states correctly
  - Join prompt works for non-members
  - Archived notice shows for archived channels
  - Message actions (send, reply, edit, delete) work
- **Dependencies**: D3 (message-input refactor complete)
- **Parallel**: ❌

---

## Group E: Security Hardening [Parallel]

### Task E1: Generic Error Messages for Sensitive Operations [S]
- **File**: `convex/messages/channelSendMutation.ts:90-106`
- **Agent**: `security-auditor`
- **Size**: S (20 min)
- **Action**: Replace specific error messages with generic ones
  ```typescript
  // Before (line 102):
  throw new Error("Forbidden: You are not a member of this channel");

  // After:
  throw new Error("Unable to send message"); // Don't leak channel membership info

  // Before (line 93):
  throw new Error("Channel is archived");

  // After:
  throw new Error("Unable to send message"); // Don't confirm channel state to non-members
  ```
- **Rationale**: Prevent information disclosure attacks (user enumeration, channel state probing)
- **Validation**:
  - Non-member tries to send message → generic error
  - Try to send to archived channel → generic error
  - No user-enumeration possible via error messages
- **Dependencies**: None
- **Parallel**: ✅

---

## Group F: Component Testing [Parallel after D4 completes]

**All component tests can run in parallel once refactoring is complete**

### Task F1: ThreadPanel Component Tests [M]
- **File**: `tests/unit/components/thread-panel.test.tsx` (new)
- **Agent**: `test-architect`
- **Size**: M (1 hour)
- **Action**: Create React Testing Library tests
  ```typescript
  describe("ThreadPanel", () => {
    it("should render closed when parentMessageId is null", () => {});
    it("should render open when parentMessageId is provided", () => {});
    it("should call onClose when Sheet closes", () => {});
    it("should auto-focus close button when opened", () => {});
    it("should restore focus to trigger on close", () => {});
    it("should show ThreadView and MessageInput when open", () => {});
    it("should pass correct props to MessageInput (parentId)", () => {});
  });
  ```
- **Validation**: All tests pass, coverage > 80%
- **Dependencies**: D4 (all frontend refactoring complete)
- **Parallel**: ✅ (can run parallel with F2, F3)

### Task F2: ThreadView Component Tests [M]
- **File**: `tests/unit/components/thread-view.test.tsx` (new)
- **Agent**: `test-architect`
- **Size**: M (1 hour)
- **Action**: Create React Testing Library tests
  ```typescript
  describe("ThreadView", () => {
    it("should show loading skeleton when isLoading=true", () => {});
    it("should show 'not found' when parent is null", () => {});
    it("should render parent message and replies", () => {});
    it("should show empty state when no replies", () => {});
    it("should disable nested threading (showThreadButton=false)", () => {});
    it("should call onClose when close button clicked", () => {});
    it("should have aria-live on replies feed", () => {});
  });
  ```
- **Validation**: All tests pass, coverage > 80%
- **Dependencies**: D4
- **Parallel**: ✅

### Task F3: RichTextContent Component Tests [S]
- **File**: `tests/unit/components/rich-text-content.test.tsx` (new)
- **Agent**: `test-architect`
- **Size**: S (30 min)
- **Action**: Create React Testing Library tests
  ```typescript
  describe("RichTextContent", () => {
    it("should render plain text content", () => {});
    it("should parse JSON Plate.js content", () => {});
    it("should extract plain text from rich content", () => {});
    it("should handle invalid JSON gracefully", () => {});
  });
  ```
- **Validation**: All tests pass, coverage > 90%
- **Dependencies**: D4
- **Parallel**: ✅

---

## Group G: Quality Gates [Sequential]

**Final validation before marking complete**

### Task G1: TypeScript & ESLint Validation [XS]
- **Agent**: `code-reviewer`
- **Size**: XS (5 min)
- **Action**: Run quality checks
  ```bash
  pnpm typecheck
  pnpm lint
  ```
- **Validation**: Both commands exit 0 (no errors)
- **Dependencies**: All previous tasks complete
- **Parallel**: ❌

### Task G2: Unit Test Suite Validation [S]
- **Agent**: `test-architect`
- **Size**: S (10 min)
- **Action**: Run full test suite
  ```bash
  pnpm test
  pnpm test:coverage
  ```
- **Validation**:
  - All tests pass
  - Coverage for new files > 80%
  - No regressions in existing tests
- **Dependencies**: G1
- **Parallel**: ❌

### Task G3: Accessibility Audit [M]
- **Agent**: `accessibility-expert`
- **Size**: M (30 min)
- **Action**: Manual a11y testing
  1. Keyboard navigation through thread panel
  2. Screen reader announcement verification (VoiceOver/NVDA)
  3. Focus management (open → close → restore)
  4. Reduced motion preferences
  5. Color contrast checks (actions on hover/focus)
- **Validation**: WCAG 2.1 AA compliance confirmed
- **Dependencies**: G2
- **Parallel**: ❌

### Task G4: Security Review [S]
- **Agent**: `security-auditor`
- **Size**: S (20 min)
- **Action**: Review security changes
  1. Verify generic error messages don't leak info
  2. Verify updateThreadMetadata is internal-only
  3. Check for any new XSS vectors in RichTextContent
  4. Verify no sensitive data in JSDoc comments
- **Validation**: No security issues identified
- **Dependencies**: G3
- **Parallel**: ❌

---

## Summary

### Task Count by Group
- **Group A**: 4 tasks (XS/S) - ~35 min total
- **Group B**: 2 tasks (M) - ~1.5 hours total
- **Group C**: 4 tasks (XS/S/M) - ~1.5 hours total
- **Group D**: 4 tasks (M/L) - ~6 hours total
- **Group E**: 1 task (S) - ~20 min
- **Group F**: 3 tasks (S/M) - ~2.5 hours total
- **Group G**: 4 tasks (XS/S/M) - ~1 hour total

### Total Estimates
- **Total Tasks**: 22
- **Estimated Duration**: ~13 hours (1.5-2 days)
- **Parallelization Savings**: ~4 hours (Groups A, C, E, F can parallelize)
- **Critical Path**: A → B1 → B2 → D1 → D2 → D3 → D4 → F* → G* (~9 hours)

### Agent Workload
| Agent | Task Count | Est. Hours |
|-------|------------|------------|
| `frontend-engineer` | 7 | ~6 hours |
| `accessibility-expert` | 4 | ~1.5 hours |
| `test-architect` | 4 | ~3 hours |
| `backend-engineer` | 1 | ~30 min |
| `security-auditor` | 3 | ~50 min |
| `code-reviewer` | 1 | ~5 min |

### Dependency Graph
```
A1, A2, A3, A4 (parallel) ──┐
                             ├──> B1 ──> B2 ──┐
                             │                 │
                             ├──> C1 (parallel)│
                             ├──> C2 (parallel)│
                             ├──> C3 (parallel)├──> D1 ──> D2 ──> D3 ──> D4 ──┐
                             ├──> C4 (parallel)│                              │
                             │                 │                              │
                             └──> E1           │                              │
                                               │                              │
                                               └──────────────────────────────┤
                                                                              │
                                               F1, F2, F3 (parallel) ◄────────┘
                                                       │
                                                       ▼
                                               G1 ──> G2 ──> G3 ──> G4
```

---

## Next Steps

1. **Orchestrator**: Review this breakdown for accuracy
2. **Orchestrator**: Assign Group A tasks (can all run in parallel)
3. **Monitor Progress**: Use TodoWrite to track completion
4. **Sequential Execution**: Groups B-G must respect dependencies
5. **Final Review**: Code review after G4 completes

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Refactoring breaks existing tests** | Run `pnpm test` after each D* task |
| **Focus management browser differences** | Test on Chrome, Firefox, Safari |
| **Screen reader compatibility** | Test with VoiceOver (macOS) and NVDA (Windows) |
| **Race conditions in updateThreadMetadata** | Unit tests (B2) cover concurrent deletes |
| **TypeScript errors after extraction** | Run `pnpm typecheck` after each refactor |

---

✅ **TASK-DECOMPOSER COMPLETE**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Feature analyzed: Phase 7 Audit Fixes
Complexity: M (Medium)
Tasks generated: 22
Agents impliqués: frontend-engineer, accessibility-expert, test-architect, backend-engineer, security-auditor, code-reviewer
Chemin critique: A* → B1 → B2 → D1 → D2 → D3 → D4 → F* → G* (~9 hours)
Durée estimée: 1.5-2 days (with parallelization)
Prochaine étape: Orchestrator to begin Group A execution
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
