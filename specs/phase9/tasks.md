# Phase 9 Audit Fixes - Task Decomposition

**Feature**: Audit Remediation for Messaging System
**Complexity**: L (Large)
**Estimated Duration**: 3-4 days
**Total Tasks**: 28 atomic tasks

---

## Prerequisites

- [x] Phase 9 implementation complete
- [x] All features working (reactions, mentions, rich text)
- [x] Audit findings documented
- [ ] Test suite passing baseline

---

## Task Overview by Priority

| Priority | Category | Count | Time Estimate |
|----------|----------|-------|---------------|
| P0 | Security | 3 | 4 hours |
| P0 | Code Quality (Type Safety) | 4 | 4 hours |
| P0 | File Splits | 2 | 6 hours |
| P0 | Tests | 1 | 3 hours |
| P1 | File Splits | 5 | 8 hours |
| P1 | Security | 1 | 2 hours |
| P1 | Accessibility | 6 | 8 hours |
| P2 | Accessibility | 2 | 2 hours |
| P2 | Documentation | 1 | 2 hours |

**Total: 39 hours across 28 tasks**

---

## Execution Strategy

### Batch 1: Critical Security & Type Safety (P0 - Parallel)
Fix security vulnerabilities and remove `any` types. These are independent and can run in parallel.

### Batch 2: Large File Splits (P0 - Sequential)
Split oversized files. Must be done carefully to avoid breaking changes.

### Batch 3: Test Fixes (P0 - Sequential)
Fix TypeScript errors in tests after file splits are complete.

### Batch 4: Medium File Splits (P1 - Sequential)
Split remaining oversized files.

### Batch 5: Accessibility Enhancements (P1 - Parallel)
Improve keyboard navigation, ARIA labels, and touch targets.

### Batch 6: Final Polish (P2 - Parallel)
Documentation and remaining accessibility improvements.

---

## BATCH 1: Critical Security & Type Safety (P0)

**Execution Order**: All tasks in parallel
**Time Estimate**: 4 hours total
**Quality Gate**: Security audit + TypeScript check

### Security Fixes

| ID | Task | File(s) | Agent | Deps | Parallel | Size |
|----|------|---------|-------|------|----------|------|
| **T001** | Add admin authorization check for @everyone mentions | `convex/messages/helpers.ts` | security-auditor | - | [P] | S |
| **T002** | Add channel membership verification before allowing reactions | `convex/reactions.ts` | security-auditor | - | [P] | S |
| **T003** | Add user authorization check to getMentionsForUser | `convex/mentions.ts` | security-auditor | - | [P] | S |

**T001 Details:**
```markdown
File: convex/messages/helpers.ts
Function: validateMentions() or similar

Current Issue: No admin check when @everyone is used
Required Fix:
- Before processing @everyone mention, verify user has admin role
- Use requireAdmin() or check user.role === "admin"
- Throw error if non-admin attempts @everyone mention

Security Impact: HIGH - Prevents notification spam
Acceptance Criteria:
- Non-admin users cannot use @everyone
- Admin users can use @everyone
- Clear error message returned to client
- Unit test added for both cases
```

**T002 Details:**
```markdown
File: convex/reactions.ts
Mutation: addReaction

Current Issue: Users can react to messages in channels they're not members of
Required Fix:
- Before adding reaction, verify user is member of channel
- Query channelMembers table for user + channel combination
- Throw error if not a member

Security Impact: MEDIUM - Prevents unauthorized interaction
Acceptance Criteria:
- Only channel members can add reactions
- Clear error message for non-members
- Existing reactions from current members still work
- Unit test for membership check
```

**T003 Details:**
```markdown
File: convex/mentions.ts
Query: getMentionsForUser

Current Issue: Query doesn't verify requester is authorized to see mentions
Required Fix:
- Add requireAuth() as first line of handler
- Verify userId === ctx.userId (user can only query their own mentions)
- Consider: Admin override to view any user's mentions

Security Impact: MEDIUM - Prevents privacy leak
Acceptance Criteria:
- Users can only query their own mentions
- requireAuth() call added
- Authorization check throws error for other users
- Unit test for auth check
```

---

### Type Safety Fixes

| ID | Task | File(s) | Agent | Deps | Parallel | Size |
|----|------|---------|-------|------|----------|------|
| **T004** | Replace `any` type with proper interface in ReactionBar | `src/components/messaging/reaction-bar.tsx:10` | typescript-expert | - | [P] | XS |
| **T005** | Replace `any` type with proper interface in MentionInput | `src/components/messaging/mention-input-messaging.tsx:15` | typescript-expert | - | [P] | XS |
| **T006** | Replace `any` type with proper interface in MessageItem | `src/components/messaging/message-item.tsx:8` | typescript-expert | - | [P] | XS |
| **T007** | Replace `any` type with proper interface in MessageActionButtons | `src/components/messaging/message-action-buttons.tsx:11` | typescript-expert | - | [P] | XS |

**T004 Details:**
```markdown
File: src/components/messaging/reaction-bar.tsx
Line: 10
Current: const handleReactionClick = (emoji: any) => { ... }

Required Fix:
- Define proper type: emoji: string (since emojis are strings)
- OR: Create EmojiValue type if more complex structure needed
- Update function signature
- Verify TypeScript compiles

Acceptance Criteria:
- No `any` types in file
- TypeScript check passes
- Component functionality unchanged
- Type is accurate and descriptive
```

**T005-T007 Details:** Similar pattern to T004
- Identify the `any` usage at specified line
- Determine correct type from context
- Replace with proper type annotation
- Verify no regressions

---

## BATCH 2: Large File Splits (P0)

**Execution Order**: Sequential (T008 → T009)
**Time Estimate**: 6 hours total
**Quality Gate**: TypeScript check + tests pass + no breaking changes

| ID | Task | File(s) | Agent | Deps | Parallel | Size |
|----|------|---------|-------|------|----------|------|
| **T008** | Split channelMessageQueries.ts (645 lines) into modular files | `convex/messages/channelMessageQueries.ts` → 4 new files | backend-engineer | T001-T007 | [S] | M |
| **T009** | Split conversationQueries.ts (357 lines) into modular files | `convex/messages/conversationQueries.ts` → 2 new files | backend-engineer | T008 | [S] | M |

**T008 Details:**
```markdown
File: convex/messages/channelMessageQueries.ts (645 lines)
Target: Split into 4 files, each < 200 lines

Proposed Structure:
1. convex/messages/channelMessages.ts (queries)
   - getChannelMessages
   - getChannelMessage
   - searchChannelMessages
   (~160 lines)

2. convex/messages/channelMessageMutations.ts (mutations)
   - sendChannelMessage
   - editChannelMessage
   - deleteChannelMessage
   (~180 lines)

3. convex/messages/channelMessageHelpers.ts (internal helpers)
   - validateChannelAccess
   - formatChannelMessage
   - parseChannelMessageContent
   (~150 lines)

4. convex/messages/channelMessageTypes.ts (validators + types)
   - channelMessageValidator
   - channelMessageInputValidator
   - Type exports
   (~155 lines)

Migration Steps:
1. Create new files with proper exports
2. Move functions maintaining all imports
3. Update import paths in consumers
4. Update convex/messages/index.ts (if exists)
5. Verify all queries/mutations still work
6. Run TypeScript check
7. Run tests

Acceptance Criteria:
- All 4 files < 200 lines
- No breaking changes to public API
- All imports updated
- TypeScript compiles
- Tests pass
- No duplicate code
```

**T009 Details:**
```markdown
File: convex/messages/conversationQueries.ts (357 lines)
Target: Split into 2 files, each < 200 lines

Proposed Structure:
1. convex/messages/conversationMessages.ts (queries)
   - getConversationMessages
   - getConversation
   (~180 lines)

2. convex/messages/conversationMessageMutations.ts (mutations)
   - sendConversationMessage
   - markConversationRead
   (~177 lines)

Migration Steps:
1. Create new files with proper exports
2. Move functions maintaining imports
3. Update import paths
4. Verify functionality
5. Run checks

Acceptance Criteria:
- All files < 200 lines
- No breaking changes
- TypeScript compiles
- Tests pass
```

---

## BATCH 3: Test Fixes (P0)

**Execution Order**: Sequential after BATCH 2
**Time Estimate**: 3 hours
**Quality Gate**: All tests pass with no TypeScript errors

| ID | Task | File(s) | Agent | Deps | Parallel | Size |
|----|------|---------|-------|------|----------|------|
| **T010** | Fix 26 TypeScript errors in test files | `tests/unit/components/mention-input-messaging.test.tsx`, `tests/unit/components/reaction-bar.test.tsx` | test-architect | T004-T009 | [S] | M |

**T010 Details:**
```markdown
Files:
- tests/unit/components/mention-input-messaging.test.tsx
- tests/unit/components/reaction-bar.test.tsx

Current Issue: 26 TypeScript errors due to:
- Type changes from T004-T007
- Import path changes from T008-T009
- Mock structure mismatches

Required Fixes:
1. Update import paths after file splits
2. Fix type annotations in mocks
3. Update test props to match new types
4. Fix mock function signatures
5. Ensure all test utilities properly typed

Steps:
1. Run `pnpm typecheck` to see all errors
2. Categorize errors (imports vs types vs mocks)
3. Fix import paths first
4. Fix type annotations
5. Update mocks
6. Verify tests still run and pass

Acceptance Criteria:
- Zero TypeScript errors in test files
- All tests pass
- Test coverage maintained
- Mock implementations match real types
```

---

## BATCH 4: Medium File Splits (P1)

**Execution Order**: Can run in parallel after BATCH 3
**Time Estimate**: 8 hours total
**Quality Gate**: TypeScript check + tests pass

| ID | Task | File(s) | Agent | Deps | Parallel | Size |
|----|------|---------|-------|------|----------|------|
| **T011** | Split reactions.ts (320 lines) into query and mutation files | `convex/reactions.ts` → 2 files | backend-engineer | T010 | [P] | M |
| **T012** | Split mentions.ts (231 lines) into query and mutation files | `convex/mentions.ts` → 2 files | backend-engineer | T010 | [P] | M |
| **T013** | Split reaction-bar.tsx (273 lines) into component and hooks | `src/components/messaging/reaction-bar.tsx` → 2 files | frontend-engineer | T010 | [P] | M |
| **T014** | Split mention-input-messaging.tsx (247 lines) into component and hooks | `src/components/messaging/mention-input-messaging.tsx` → 2 files | frontend-engineer | T010 | [P] | M |
| **T015** | Split rich-text-static-components.tsx (282 lines) into individual component files | `src/components/messaging/rich-text-static-components.tsx` → 5 files | frontend-engineer | T010 | [P] | M |

**T011 Details:**
```markdown
File: convex/reactions.ts (320 lines)
Target: Split into 2 files

Proposed Structure:
1. convex/reactions/queries.ts
   - getMessageReactions
   - getUserReactions
   (~150 lines)

2. convex/reactions/mutations.ts
   - addReaction (with T002 security fix)
   - removeReaction
   (~170 lines)

Acceptance Criteria:
- Each file < 200 lines
- T002 security fix included
- No breaking changes
- Tests pass
```

**T012 Details:**
```markdown
File: convex/mentions.ts (231 lines)
Target: Split into 2 files

Proposed Structure:
1. convex/mentions/queries.ts
   - getMentionsForUser (with T003 security fix)
   - getMentionsInMessage
   (~120 lines)

2. convex/mentions/mutations.ts
   - createMention
   - markMentionRead
   (~111 lines)

Acceptance Criteria:
- Each file < 200 lines
- T003 security fix included
- Tests pass
```

**T013 Details:**
```markdown
File: src/components/messaging/reaction-bar.tsx (273 lines)
Target: Split into 2 files

Proposed Structure:
1. src/components/messaging/reaction-bar.tsx (component only)
   - ReactionBar component
   - ReactionButton sub-component
   (~140 lines)

2. src/hooks/use-reaction-bar.ts (business logic)
   - useReactionBar hook
   - Reaction state management
   - Add/remove reaction handlers
   (~133 lines)

Acceptance Criteria:
- Each file < 200 lines
- Component remains functional
- Tests updated
```

**T014 Details:**
```markdown
File: src/components/messaging/mention-input-messaging.tsx (247 lines)
Target: Split into 2 files

Proposed Structure:
1. src/components/messaging/mention-input.tsx (UI only)
   - MentionInput component
   - MentionSuggestion sub-component
   (~120 lines)

2. src/hooks/use-mention-input.ts (logic)
   - useMentionInput hook
   - Mention detection
   - Suggestion filtering
   (~127 lines)

Acceptance Criteria:
- Each file < 200 lines
- Functionality preserved
- Tests pass
```

**T015 Details:**
```markdown
File: src/components/messaging/rich-text-static-components.tsx (282 lines)
Target: Split into 5 smaller component files

Proposed Structure:
1. src/components/messaging/rich-text/heading.tsx (~50 lines)
2. src/components/messaging/rich-text/list.tsx (~60 lines)
3. src/components/messaging/rich-text/code-block.tsx (~70 lines)
4. src/components/messaging/rich-text/blockquote.tsx (~50 lines)
5. src/components/messaging/rich-text/index.ts (exports) (~52 lines)

Acceptance Criteria:
- All files < 100 lines
- Export from index.ts
- No breaking changes
- Tests pass
```

---

## BATCH 5: Accessibility Enhancements (P1)

**Execution Order**: Can run in parallel after BATCH 4
**Time Estimate**: 8 hours total
**Quality Gate**: Accessibility audit passes

| ID | Task | File(s) | Agent | Deps | Parallel | Size |
|----|------|---------|-------|------|----------|------|
| **T016** | Add visible focus indicator to EmojiPicker category buttons | `src/components/messaging/emoji-picker.tsx` | design-system-expert | T011 | [P] | S |
| **T017** | Add visible focus indicator to ReactionBar emoji buttons | `src/components/messaging/reaction-bar.tsx` | design-system-expert | T013 | [P] | S |
| **T018** | Add visible focus indicator to MentionInput suggestions | `src/components/messaging/mention-input.tsx` | design-system-expert | T014 | [P] | S |
| **T019** | Add aria-live region for reaction count updates | `src/components/messaging/reaction-bar.tsx` | design-system-expert | T013 | [P] | S |
| **T020** | Add visual indicator for current user mentions in MentionHighlight | `src/components/messaging/mention-highlight.tsx` | design-system-expert | - | [P] | S |
| **T021** | Increase touch target size to 44px for mention suggestions | `src/components/messaging/mention-input.tsx` | design-system-expert | T014 | [P] | S |

**T016 Details:**
```markdown
File: src/components/messaging/emoji-picker.tsx
Component: Category buttons (tabs at top)

Current Issue: Focus state not clearly visible
Required Fix:
- Add focus-visible:ring-2 focus-visible:ring-primary
- Add focus-visible:ring-offset-2
- Ensure 3:1 contrast ratio with background
- Test keyboard navigation (Tab, Arrow keys)

Acceptance Criteria:
- Focus ring visible on keyboard navigation
- Focus ring NOT visible on mouse click
- 3:1 contrast ratio verified
- Keyboard navigation works smoothly
```

**T017 Details:**
```markdown
File: src/components/messaging/reaction-bar.tsx
Component: Emoji reaction buttons

Current Issue: Focus state not clearly visible
Required Fix:
- Add focus-visible:ring-2 focus-visible:ring-primary
- Add focus-visible:ring-offset-1 (smaller offset for compact UI)
- Ensure button remains visually clear with ring

Acceptance Criteria:
- Focus ring visible on Tab navigation
- No visual overlap with emoji
- Works in both light and dark mode
```

**T018 Details:**
```markdown
File: src/components/messaging/mention-input.tsx
Component: Suggestion dropdown items

Current Issue: Selected item not clearly indicated for keyboard users
Required Fix:
- Add focus-visible:ring-2 focus-visible:ring-primary
- Add bg-accent for currently selected item
- Combine with existing hover state
- Test Arrow Up/Down navigation

Acceptance Criteria:
- Clear visual distinction for keyboard-selected item
- Different style from mouse hover (if applicable)
- Smooth navigation with arrow keys
```

**T019 Details:**
```markdown
File: src/components/messaging/reaction-bar.tsx
Component: ReactionBar wrapper

Current Issue: Screen reader users don't hear count updates
Required Fix:
- Add <div aria-live="polite" aria-atomic="true" className="sr-only">
- Populate with "{emoji} reaction count: {count}" on change
- Only announce changes, not initial render

Implementation:
```tsx
const [announcement, setAnnouncement] = useState("");

useEffect(() => {
  if (reactionAdded) {
    setAnnouncement(`${emoji} reaction count: ${newCount}`);
  }
}, [reactions]);

return (
  <>
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
    {/* existing ReactionBar UI */}
  </>
);
```

Acceptance Criteria:
- Screen reader announces count changes
- No announcement on initial load
- Announcement is concise and clear
```

**T020 Details:**
```markdown
File: src/components/messaging/mention-highlight.tsx
Component: Mention badge/chip

Current Issue: No visual distinction for current user's mentions vs others
Required Fix:
- Check if mention.userId === currentUserId
- If true, add icon (e.g., @UserIcon or BadgeIcon)
- Use different background color (e.g., bg-primary/10)
- Update aria-label to include "(you)"

Example:
```tsx
const isCurrentUser = mention.userId === currentUserId;

return (
  <span
    className={cn(
      "mention-highlight",
      isCurrentUser && "bg-primary/10 font-semibold"
    )}
    aria-label={isCurrentUser ? `@${mention.name} (you)` : `@${mention.name}`}
  >
    {isCurrentUser && <AtSignIcon className="h-3 w-3" />}
    @{mention.name}
  </span>
);
```

Acceptance Criteria:
- Current user mentions visually distinct
- Icon used if space allows
- Accessible label includes context
- Works in both light and dark themes
```

**T021 Details:**
```markdown
File: src/components/messaging/mention-input.tsx
Component: Suggestion list items (dropdown)

Current Issue: Touch targets smaller than 44px (WCAG 2.5.5)
Required Fix:
- Increase min-height to 44px (h-11 in Tailwind)
- Increase padding to accommodate height
- Ensure text remains vertically centered
- Test on mobile device or browser DevTools

Before:
```tsx
<button className="px-3 py-2 hover:bg-accent">
  @{user.name}
</button>
```

After:
```tsx
<button className="px-3 py-2.5 min-h-[44px] flex items-center hover:bg-accent">
  @{user.name}
</button>
```

Acceptance Criteria:
- All suggestion items >= 44px tall
- Text centered vertically
- No visual regressions
- Touch-friendly on mobile
```

---

## BATCH 6: Final Polish (P2)

**Execution Order**: Can run in parallel after BATCH 5
**Time Estimate**: 4 hours total
**Quality Gate**: Documentation complete + accessibility audit passes

| ID | Task | File(s) | Agent | Deps | Parallel | Size |
|----|------|---------|-------|------|----------|------|
| **T022** | Add role="listbox" to MentionInput suggestions dropdown | `src/components/messaging/mention-input.tsx` | design-system-expert | T014, T021 | [P] | XS |
| **T023** | Add aria-live regions for status messages across components | All messaging components | design-system-expert | T011-T015 | [P] | S |
| **T024** | Add JSDoc comments to all exported functions | All convex files affected by splits | backend-engineer | T008-T012 | [P] | S |

**T022 Details:**
```markdown
File: src/components/messaging/mention-input.tsx
Component: Suggestions dropdown wrapper

Current Issue: Missing ARIA role for autocomplete pattern
Required Fix:
- Add role="listbox" to dropdown wrapper
- Add role="option" to each suggestion item
- Add aria-selected={isSelected} to current item
- Add aria-activedescendant to input pointing to selected option

Example:
```tsx
<div role="listbox" id="mention-suggestions">
  {suggestions.map((user, index) => (
    <div
      key={user._id}
      role="option"
      id={`mention-option-${index}`}
      aria-selected={index === selectedIndex}
      className="mention-suggestion"
    >
      @{user.name}
    </div>
  ))}
</div>

<input
  aria-autocomplete="list"
  aria-controls="mention-suggestions"
  aria-activedescendant={selectedIndex >= 0 ? `mention-option-${selectedIndex}` : undefined}
/>
```

Acceptance Criteria:
- Proper ARIA roles applied
- Screen reader announces selection changes
- Keyboard navigation works with ARIA
- No accessibility warnings in DevTools
```

**T023 Details:**
```markdown
Files: All messaging components
- src/components/messaging/message-composer.tsx
- src/components/messaging/message-item.tsx
- src/components/messaging/reaction-bar.tsx
- src/components/messaging/mention-input.tsx

Current Issue: Status messages (errors, success) not announced to screen readers
Required Fix:
- Add aria-live="polite" region to each component
- Announce errors: "Failed to send message"
- Announce success: "Message sent", "Reaction added"
- Clear announcement after 5 seconds

Example pattern:
```tsx
const [statusMessage, setStatusMessage] = useState("");

const handleSend = async () => {
  try {
    await sendMessage();
    setStatusMessage("Message sent successfully");
    setTimeout(() => setStatusMessage(""), 5000);
  } catch (error) {
    setStatusMessage(`Error: ${error.message}`);
    setTimeout(() => setStatusMessage(""), 5000);
  }
};

return (
  <>
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {statusMessage}
    </div>
    {/* component UI */}
  </>
);
```

Acceptance Criteria:
- All status changes announced
- Announcements clear after 5s
- No duplicate announcements
- Polite interruption (not assertive)
```

**T024 Details:**
```markdown
Files: All Convex files created/modified during file splits
- convex/messages/channelMessages.ts
- convex/messages/channelMessageMutations.ts
- convex/messages/channelMessageHelpers.ts
- convex/messages/conversationMessages.ts
- convex/messages/conversationMessageMutations.ts
- convex/reactions/queries.ts
- convex/reactions/mutations.ts
- convex/mentions/queries.ts
- convex/mentions/mutations.ts

Required: Add JSDoc to all exported functions

Template:
```typescript
/**
 * Retrieves paginated messages for a channel with sender information.
 *
 * @param channelId - The ID of the channel to fetch messages from
 * @param paginationOpts - Pagination options (limit, cursor)
 * @returns Paginated list of messages with sender details
 * @throws {ConvexError} If user is not a member of the channel
 *
 * @example
 * const messages = await ctx.runQuery(api.messages.channelMessages.getChannelMessages, {
 *   channelId: "channel123",
 *   paginationOpts: { numItems: 50 }
 * });
 */
export const getChannelMessages = query({
  args: { ... },
  handler: async (ctx, args) => { ... }
});
```

Acceptance Criteria:
- Every exported query/mutation has JSDoc
- JSDoc includes: description, params, returns, throws, example
- Examples use realistic data
- No placeholder text ("TODO", "TBD")
```

---

## Quality Gates Summary

### Per-Task Gates
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] ESLint passes (`pnpm lint`)
- [ ] Unit tests pass (`pnpm test`)
- [ ] No console.log or debugger statements
- [ ] No `any` types introduced

### Batch-Level Gates

**BATCH 1 (Security & Types):**
- [ ] security-auditor review passed
- [ ] All security tests added and passing
- [ ] Zero `any` types in modified files

**BATCH 2 (Large File Splits):**
- [ ] All files < 200 lines
- [ ] No breaking changes to public API
- [ ] Import paths updated across entire codebase
- [ ] All affected tests updated and passing

**BATCH 3 (Test Fixes):**
- [ ] Zero TypeScript errors in test files
- [ ] Test coverage maintained or improved
- [ ] All tests green in CI

**BATCH 4 (Medium File Splits):**
- [ ] All files < 200 lines
- [ ] Logical separation maintained
- [ ] No duplicate code

**BATCH 5 (Accessibility):**
- [ ] Focus indicators meet 3:1 contrast ratio
- [ ] Touch targets >= 44px
- [ ] Screen reader announcements tested
- [ ] Keyboard navigation verified

**BATCH 6 (Final Polish):**
- [ ] All JSDoc comments complete
- [ ] ARIA roles correct
- [ ] Accessibility audit passes (WCAG 2.1 AA)

### Final Verification
- [ ] Full E2E test suite passes
- [ ] Manual QA on all affected features
- [ ] Performance benchmarks maintained
- [ ] No new accessibility violations
- [ ] Bundle size delta acceptable (<5% increase)

---

## Risk Mitigation

### High-Risk Areas

| Risk | Mitigation | Contingency |
|------|------------|-------------|
| File splits break imports | Comprehensive grep for import paths before splitting | Automated refactoring script |
| Tests fail after splits | Run tests after each split immediately | Rollback file split and redesign |
| Security fixes break features | Add comprehensive unit tests for auth checks | Feature flag to disable auth temporarily |
| Accessibility changes affect UX | A/B test with user feedback | Revert to previous UI with accessibility overlay |

### Dependencies Requiring Attention

- **T008 → T009**: Second split learns from first split's challenges
- **T010 must wait for T008-T009**: Tests depend on import paths
- **T011-T015 can parallelize**: Independent files, no cross-dependencies
- **T016-T021 depend on T013-T014**: Accessibility fixes on split components

---

## Execution Checklist

### Pre-Execution
- [ ] Create feature branch: `git checkout -b phase9-audit-remediation`
- [ ] Baseline tests passing: `pnpm test`
- [ ] Baseline TypeScript check: `pnpm typecheck`
- [ ] Baseline accessibility audit (if automated)

### During Execution
- [ ] Commit after each batch completes
- [ ] Run quality gates after each batch
- [ ] Update this document with actual completion times

### Post-Execution
- [ ] Full regression test
- [ ] Update documentation
- [ ] Create PR with audit fixes summary
- [ ] Security team review (for T001-T003)
- [ ] Accessibility team review (for T016-T023)

---

## Agent Assignment Summary

| Agent | Task Count | Total Time | Primary Responsibilities |
|-------|------------|------------|--------------------------|
| **security-auditor** | 3 | 6 hours | T001-T003 (auth checks, security fixes) |
| **typescript-expert** | 4 | 2 hours | T004-T007 (remove `any` types) |
| **backend-engineer** | 6 | 16 hours | T008-T009, T011-T012, T024 (file splits, JSDoc) |
| **frontend-engineer** | 3 | 6 hours | T013-T015 (component splits) |
| **test-architect** | 1 | 3 hours | T010 (fix test TypeScript errors) |
| **design-system-expert** | 8 | 6 hours | T016-T023 (accessibility enhancements) |

---

## Success Criteria

### Functional
- [ ] All Phase 9 features working (reactions, mentions, rich text)
- [ ] No regressions introduced
- [ ] Performance maintained

### Code Quality
- [ ] Zero `any` types
- [ ] All files ≤ 200 lines
- [ ] All functions documented with JSDoc
- [ ] TypeScript strict mode passing

### Security
- [ ] Admin-only @everyone mentions enforced
- [ ] Channel membership verified for reactions
- [ ] User authorization checked for personal queries

### Accessibility
- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation fully functional
- [ ] Screen reader announcements complete
- [ ] Touch targets >= 44px

### Testing
- [ ] Zero TypeScript errors in tests
- [ ] All unit tests passing
- [ ] All E2E tests passing
- [ ] Test coverage >= 80%

---

## Notes for Agent Execution

### For security-auditor (T001-T003):
- Read `.claude/skills/security/SKILL.md`
- Consult `.claude/skills/security/references/rbac.md`
- Use `requireAuth()` and `requireAdmin()` from `convex/lib/auth.ts`
- Add unit tests for both authorized and unauthorized cases

### For typescript-expert (T004-T007):
- Read `.claude/skills/typescript/SKILL.md`
- Consult official React TypeScript docs via Context7
- Define types in component file or extract to `src/types/`
- Ensure strict mode compatibility

### For backend-engineer (T008-T009, T011-T012, T024):
- Read `.claude/skills/convex/SKILL.md`
- Consult `.claude/skills/convex/references/file-organization.md` (if exists)
- Use Convex import conventions
- Maintain index exports pattern
- Update affected test imports

### For frontend-engineer (T013-T015):
- Read `.claude/skills/react-nextjs/SKILL.md`
- Read `.claude/skills/ui-components/SKILL.md`
- Follow component/hook separation pattern
- Use custom hooks for business logic
- Keep components presentational

### For test-architect (T010):
- Read `.claude/skills/testing/SKILL.md`
- Fix import paths first
- Update mocks to match new types
- Ensure test coverage maintained

### For design-system-expert (T016-T023):
- Read `.claude/skills/ui-components/SKILL.md`
- Consult WCAG 2.1 guidelines via Context7
- Test with keyboard only
- Test with screen reader (VoiceOver/NVDA)
- Verify color contrast ratios

---

## Context7 Library IDs (Pre-Validated)

| Technology | Library ID | Use For |
|------------|-----------|---------|
| React | `/facebook/react` | Component patterns |
| TypeScript | `/microsoft/typescript` | Type definitions |
| Convex | `/get-convex/convex` | File organization, query/mutation patterns |
| Tailwind CSS | `/tailwindlabs/tailwindcss` | Focus ring styles |
| Radix UI | `/radix-ui/primitives` | Accessible component patterns |
| WCAG | (web search) | Accessibility criteria |

---

**Document Status**: Ready for Execution
**Last Updated**: 2025-12-27
**Reviewed By**: task-decomposer
**Next Step**: Delegate to agent-orchestrator for batch execution
