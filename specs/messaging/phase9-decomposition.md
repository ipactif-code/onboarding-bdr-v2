# Phase 9: Reactions and Mentions - Task Decomposition

**Feature**: User Story 7 - Message Reactions and @Mentions
**Complexity**: M (Medium)
**Estimated Duration**: 2.5-3 days
**Original Tasks**: T095-T105

## Context Analysis

### Schema Status (convex/schema.ts)
âœ… **reactions table exists** (lines 479-489) with proper indexes:
- `by_message`, `by_message_emoji`, `by_user`, `by_message_user`

âœ… **mentions table exists** (lines 491-512) with proper indexes:
- `by_message`, `by_mentioned_user`, `by_channel`, `by_user_unnotified`

âœ… **messages.reactionCount field exists** (line 288) - denormalized count

### Backend Status
âœ… **extractAndStoreMentions helper exists** (convex/messages/helpers.ts, lines 75-134)
- Already handles @everyone, @here, @username patterns
- Already creates mention records in database

❌ **convex/reactions.ts does NOT exist** - needs to be created

### Frontend Status
âœ… **mention-input-messaging.tsx exists** - already provides @mention autocomplete
- Uses InlineCombobox from platejs/mention
- Queries Convex users.search API
- Shows avatars and roles in dropdown

❌ **No emoji picker component** - @emoji-mart/react NOT installed
❌ **No reaction display** - reaction-bar.tsx does not exist
❌ **No mention highlighting** - message-item.tsx shows plain text

### Dependencies
- **emoji-mart library** needs to be added to package.json
- **Plate.js mention plugin** already integrated in message-input

---

## Phase Breakdown

### Phase 9A: Backend - Reactions System (T095-T097)

| ID | Task | Agent | Depends | Parallel | Est. |
|----|------|-------|---------|----------|------|
| T095a | Create convex/reactions.ts with addReaction mutation | backend-engineer | - | âœ… [P] | 1.5h |
| T095b | Add integration tests for addReaction in convex/reactions.test.ts | test-architect | T095a | âœ— | 1h |
| T096a | Implement removeReaction mutation in convex/reactions.ts | backend-engineer | T095a | âœ— | 1h |
| T096b | Add integration tests for removeReaction in convex/reactions.test.ts | test-architect | T096a | âœ— | 0.5h |
| T097a | Create getMessageReactions query in convex/reactions.ts (aggregated by emoji) | backend-engineer | T095a | âœ… [P] | 1h |
| T097b | Update channelMessageWithSenderValidator to include reactions array | backend-engineer | T097a | âœ— | 0.5h |
| T097c | Add integration tests for getMessageReactions in convex/reactions.test.ts | test-architect | T097a | âœ— | 0.5h |

**Sub-tasks Detail:**

**T095a**: Create convex/reactions.ts with addReaction mutation
- File: `convex/reactions.ts`
- Skills: convex, security
- Requirements:
  - `requireAuth()` on first line
  - Args: `messageId: Id<"messages">`, `emoji: v.string()`
  - Returns: `v.id("reactions")`
  - Check if user already reacted with this emoji (upsert behavior)
  - Increment `messages.reactionCount` (denormalized counter)
  - Validate emoji is a valid Unicode emoji (basic regex check)
  - Add JSDoc comments
- Context7: /get-convex/convex (mutations, validators)

**T095b**: Add integration tests for addReaction
- File: `convex/reactions.test.ts`
- Skills: testing, convex
- Test cases:
  - User can add reaction to message
  - Adding same emoji twice is idempotent (returns existing)
  - Reaction count increments on messages table
  - Reaction is associated with correct user and message
  - Requires authentication
- Context7: /vitest-dev/vitest (testing)

**T096a**: Implement removeReaction mutation
- File: `convex/reactions.ts`
- Skills: convex, security
- Requirements:
  - `requireAuth()` on first line
  - Args: `reactionId: Id<"reactions">`
  - Returns: `v.null()`
  - Verify user owns the reaction before deleting
  - Decrement `messages.reactionCount`
  - Handle case where reaction doesn't exist (no-op)
- Context7: /get-convex/convex (mutations)

**T096b**: Add integration tests for removeReaction
- File: `convex/reactions.test.ts`
- Skills: testing, convex
- Test cases:
  - User can remove their own reaction
  - User cannot remove other users' reactions
  - Reaction count decrements on messages table
  - Removing non-existent reaction is safe (no error)
- Context7: /vitest-dev/vitest

**T097a**: Create getMessageReactions query
- File: `convex/reactions.ts`
- Skills: convex, typescript
- Requirements:
  - Args: `messageId: Id<"messages">`
  - Returns: Array of `{ emoji: string, count: number, userIds: Id<"users">[], currentUserReacted: boolean }`
  - Use `.withIndex("by_message", ...)` for efficiency
  - Group reactions by emoji using lodash groupBy or manual aggregation
  - Include flag if current user has reacted with each emoji
- Context7: /get-convex/convex (queries, aggregation)

**T097b**: Update channelMessageWithSenderValidator
- File: `convex/messages/helpers.ts`
- Skills: convex, typescript
- Requirements:
  - Add `reactions: v.array(v.object({ emoji: v.string(), count: v.number(), users: v.array(v.id("users")), currentUserReacted: v.boolean() }))`
  - Optional field (existing messages may not have reactions)
- Context7: /microsoft/typescript (validators)

**T097c**: Add integration tests for getMessageReactions
- File: `convex/reactions.test.ts`
- Skills: testing, convex
- Test cases:
  - Empty array for message with no reactions
  - Aggregates multiple users reacting with same emoji
  - Multiple different emojis on same message
  - currentUserReacted flag works correctly
- Context7: /vitest-dev/vitest

---

### Phase 9B: Backend - Mentions Enhancement (T098-T100)

**NOTE**: Most mention backend is DONE in convex/messages/helpers.ts. These tasks are enhancements.

| ID | Task | Agent | Depends | Parallel | Est. |
|----|------|-------|---------|----------|------|
| T098a | Review existing extractAndStoreMentions in convex/messages/helpers.ts | backend-engineer | - | âœ… [P] | 0.5h |
| T098b | Create convex/mentions.ts with getMentionsForUser query | backend-engineer | T098a | âœ— | 1h |
| T098c | Add integration tests for mention extraction in convex/messages.test.ts | test-architect | T098a | âœ… [P] | 1h |
| T099a | Implement markMentionAsRead mutation in convex/mentions.ts | backend-engineer | T098b | âœ— | 0.5h |
| T099b | Add integration tests for markMentionAsRead in convex/mentions.test.ts | test-architect | T099a | âœ— | 0.5h |
| T100a | Enhance extractAndStoreMentions to notify mentioned users (optional) | backend-engineer | T098a | âœ… [P] | 1h |
| T100b | Add integration tests for @here and @everyone in convex/messages.test.ts | test-architect | T100a | âœ— | 1h |

**Sub-tasks Detail:**

**T098a**: Review existing extractAndStoreMentions
- File: `convex/messages/helpers.ts` (lines 75-134)
- Skills: convex
- Action: Read and understand existing implementation
- Verify it handles @everyone, @here, @username correctly
- Document any edge cases or limitations
- NO CODE CHANGES - analysis only

**T098b**: Create getMentionsForUser query
- File: `convex/mentions.ts`
- Skills: convex, typescript
- Requirements:
  - Query to get unread mentions for a user
  - Args: `userId: Id<"users">`, `limit: v.optional(v.number())`
  - Returns: Array with message context (sender, channel, timestamp)
  - Use `.withIndex("by_user_unnotified", ...)`
  - Include messageId so frontend can navigate to message
- Context7: /get-convex/convex (queries, indexes)

**T098c**: Add integration tests for mention extraction
- File: `convex/messages.test.ts` (or new convex/mentions.test.ts)
- Skills: testing, convex
- Test cases:
  - @username creates user mention
  - @everyone creates everyone mention
  - @here creates here mention
  - Multiple mentions in one message
  - Invalid usernames don't create mentions
  - Case sensitivity handling
- Context7: /vitest-dev/vitest

**T099a**: Implement markMentionAsRead mutation
- File: `convex/mentions.ts`
- Skills: convex, security
- Requirements:
  - `requireAuth()` on first line
  - Args: `mentionId: Id<"mentions">`
  - Returns: `v.null()`
  - Set `notifiedAt` timestamp
  - Verify user owns the mention (security check)
- Context7: /get-convex/convex (mutations)

**T099b**: Add integration tests for markMentionAsRead
- File: `convex/mentions.test.ts`
- Skills: testing, convex
- Test cases:
  - User can mark their own mention as read
  - User cannot mark other users' mentions as read
  - notifiedAt timestamp is set correctly
- Context7: /vitest-dev/vitest

**T100a**: Enhance extractAndStoreMentions (optional notification)
- File: `convex/messages/helpers.ts`
- Skills: convex, typescript
- Requirements:
  - OPTIONAL: Add comment indicating where real-time notifications could be triggered
  - Could call a scheduler to send push notifications
  - For now, just ensure data is ready for frontend to poll
  - Do NOT implement actual notifications (out of scope for Phase 9)
- Context7: /get-convex/convex (actions, schedulers)

**T100b**: Add integration tests for @here and @everyone
- File: `convex/messages.test.ts`
- Skills: testing, convex
- Test cases:
  - @everyone mention is created correctly
  - @here mention is created correctly
  - Both can coexist in same message
  - Validation that @everyone requires admin role (future enhancement)
- Context7: /vitest-dev/vitest

---

### Phase 9C: Frontend - Emoji Picker Setup (T101)

| ID | Task | Agent | Depends | Parallel | Est. |
|----|------|-------|---------|----------|------|
| T101a | Install @emoji-mart/react and @emoji-mart/data packages | frontend-engineer | - | âœ… [P] | 0.5h |
| T101b | Create src/components/messaging/emoji-picker.tsx wrapper component | frontend-engineer | T101a | âœ— | 2h |
| T101c | Add component tests for emoji-picker in src/components/messaging/emoji-picker.test.tsx | test-architect | T101b | âœ— | 1h |

**Sub-tasks Detail:**

**T101a**: Install @emoji-mart/react packages
- Command: `pnpm add @emoji-mart/react @emoji-mart/data`
- Skills: N/A (simple dependency installation)
- Verify installation: Check package.json includes both packages
- Check for TypeScript types availability

**T101b**: Create emoji-picker.tsx wrapper component
- File: `src/components/messaging/emoji-picker.tsx`
- Skills: react-nextjs, ui-components, typescript
- Requirements:
  - Wrap @emoji-mart/react Picker component
  - Props: `onEmojiSelect: (emoji: string) => void`, `open: boolean`, `onOpenChange: (open: boolean) => void`
  - Use Popover or DropdownMenu from shadcn/ui for positioning
  - Theme integration (respect user's dark/light mode)
  - Lazy load emoji data for performance
  - Accessible keyboard navigation
  - Show recent/frequently used emojis
  - Search functionality
- Context7:
  - /facebook/react (hooks, memo)
  - /shadcn-ui/ui (Popover, DropdownMenu)
  - /tailwindlabs/tailwindcss (theming)
- Dependencies: Must read emoji-mart docs via Context7 (resolve-library-id first)

**T101c**: Add component tests for emoji-picker
- File: `src/components/messaging/emoji-picker.test.tsx`
- Skills: testing, react-nextjs
- Test cases:
  - Picker renders when open
  - onEmojiSelect callback fires with correct emoji
  - onOpenChange callback fires on close
  - Keyboard navigation works (Escape to close)
  - Search filters emojis
  - Respects theme prop
- Context7: /vitest-dev/vitest, /@testing-library/react

---

### Phase 9D: Frontend - Reaction Display (T102)

| ID | Task | Agent | Depends | Parallel | Est. |
|----|------|-------|---------|----------|------|
| T102a | Create src/components/messaging/reaction-bar.tsx component | frontend-engineer | T097a, T101b | âœ— | 2.5h |
| T102b | Add component tests for reaction-bar in src/components/messaging/reaction-bar.test.tsx | test-architect | T102a | âœ— | 1h |

**Sub-tasks Detail:**

**T102a**: Create reaction-bar.tsx component
- File: `src/components/messaging/reaction-bar.tsx`
- Skills: react-nextjs, ui-components, convex, typescript
- Requirements:
  - Props: `messageId: Id<"messages">`, `reactions: Array<{ emoji, count, users, currentUserReacted }>`
  - Display reactions grouped by emoji with counts
  - Highlight reactions the current user has added (different bg color)
  - Click to toggle reaction (add if not reacted, remove if already reacted)
  - Show hover tooltip with list of users who reacted
  - Add reaction button (opens emoji picker)
  - Use useMutation for addReaction and removeReaction
  - Optimistic updates for instant feedback
  - Accessible (keyboard navigable, screen reader friendly)
  - Responsive (wraps on small screens)
- Context7:
  - /facebook/react (hooks, useMutation from Convex)
  - /get-convex/convex (useMutation)
  - /shadcn-ui/ui (Button, Tooltip)
- Dependencies: T097a (getMessageReactions query), T101b (emoji picker)

**T102b**: Add component tests for reaction-bar
- File: `src/components/messaging/reaction-bar.test.tsx`
- Skills: testing, react-nextjs
- Test cases:
  - Renders reactions with correct counts
  - Highlights user's own reactions
  - Clicking reaction toggles it
  - Add reaction button opens picker
  - Tooltip shows user list on hover
  - Keyboard navigation works
  - Optimistic updates work (UI updates before mutation completes)
- Context7: /vitest-dev/vitest, /@testing-library/react

---

### Phase 9E: Frontend - Mention UI (T103-T105)

**NOTE**: mention-input-messaging.tsx already exists and provides autocomplete. T103-T105 are integration tasks.

| ID | Task | Agent | Depends | Parallel | Est. |
|----|------|-------|---------|----------|------|
| T103a | Review existing mention-input-messaging.tsx implementation | frontend-engineer | - | âœ… [P] | 0.5h |
| T103b | Add @here and @everyone support to mention-input-messaging.tsx | frontend-engineer | T103a | âœ— | 1h |
| T103c | Add component tests for mention autocomplete in src/components/messaging/mention-input-messaging.test.tsx | test-architect | T103b | âœ— | 1h |
| T104a | Add mention highlighting to message-item.tsx (parse and style @mentions) | frontend-engineer | T103a | âœ— | 2h |
| T104b | Add component tests for mention highlighting in src/components/messaging/message-item.test.tsx | test-architect | T104a | âœ— | 1h |
| T105a | Verify message-input.tsx already integrates MentionInputMessaging plugin | frontend-engineer | T104a | âœ— | 0.5h |
| T105b | Add E2E test for full mention flow in tests/e2e/messaging-mentions.spec.ts | e2e-specialist | T104a, T105a | âœ— | 1.5h |

**Sub-tasks Detail:**

**T103a**: Review existing mention-input-messaging.tsx
- File: `src/components/messaging/mention-input-messaging.tsx`
- Skills: react-nextjs
- Action: Read and understand existing implementation
- Verify it uses InlineCombobox from platejs/mention
- Verify it queries Convex users.search API
- Document current behavior
- NO CODE CHANGES - analysis only

**T103b**: Add @here and @everyone support to mention autocomplete
- File: `src/components/messaging/mention-input-messaging.tsx`
- Skills: react-nextjs, ui-components, typescript
- Requirements:
  - Add static items to combobox: @here, @everyone
  - Show these items BEFORE user results in the dropdown
  - Different icon/styling for special mentions (e.g., "@" badge with "all" or "online")
  - Keyboard navigation includes special mentions
  - Only show @everyone if user is admin (optional security check)
- Context7:
  - /facebook/react (hooks)
  - /websites/platejs (mention plugin, combobox)

**T103c**: Add component tests for mention autocomplete
- File: `src/components/messaging/mention-input-messaging.test.tsx`
- Skills: testing, react-nextjs
- Test cases:
  - Typing @ shows combobox
  - User search works (mocked Convex query)
  - Selecting user inserts mention
  - @here and @everyone appear in list
  - Admin-only @everyone enforcement (if implemented)
  - Keyboard navigation works (arrow keys, Enter, Escape)
- Context7: /vitest-dev/vitest, /@testing-library/react

**T104a**: Add mention highlighting to message-item.tsx
- File: `src/components/messaging/message-item.tsx`
- Skills: react-nextjs, typescript
- Requirements:
  - Enhance RichTextRenderer to detect @mentions in content
  - Apply styling: blue text, hover underline, clickable
  - Highlight current user's @mention differently (e.g., yellow bg)
  - Click on @mention could navigate to user profile (optional)
  - Parse @here and @everyone with special styling
  - Use regex: `/@([a-zA-Z0-9_-]+|here|everyone)/g`
  - Accessible (screen reader announces "mentioned [username]")
- Context7:
  - /facebook/react (components)
  - /tailwindlabs/tailwindcss (styling)
- Dependencies: T103a (understanding mention structure)

**T104b**: Add component tests for mention highlighting
- File: `src/components/messaging/message-item.test.tsx`
- Skills: testing, react-nextjs
- Test cases:
  - @username is highlighted with correct styling
  - @here and @everyone have special styling
  - Current user's mention has different background
  - Multiple mentions in one message
  - Clicking mention fires callback (if implemented)
  - Screen reader announces mentions correctly
- Context7: /vitest-dev/vitest, /@testing-library/react

**T105a**: Verify message-input.tsx integration
- File: `src/components/messaging/message-input.tsx`
- Skills: react-nextjs
- Action: Read and verify that MentionInputMessaging is already in MessageInputPlugins
- Check that `@` trigger is working
- Verify onSend serializes mentions correctly
- NO CODE CHANGES if integration is complete - analysis only
- If missing, add MentionInputMessaging to plugins array

**T105b**: Add E2E test for full mention flow
- File: `tests/e2e/messaging-mentions.spec.ts`
- Skills: testing, react-nextjs
- Test cases:
  - User types @ and sees autocomplete
  - User selects user from autocomplete
  - Mention is inserted into message
  - Message is sent with mention
  - Recipient sees highlighted mention in message
  - Clicking mention navigates (if implemented)
  - @here and @everyone work end-to-end
- Context7: /microsoft/playwright (selectors, assertions, page actions)

---

### Phase 9F: Integration & Quality Gates (T106-T110)

| ID | Task | Agent | Depends | Parallel | Est. |
|----|------|-------|---------|----------|------|
| T106 | Integrate reaction-bar.tsx into message-item.tsx | frontend-engineer | T102a, T104a | âœ— | 1h |
| T107 | Integrate emoji-picker.tsx into message-action-buttons.tsx | frontend-engineer | T101b, T106 | âœ— | 1h |
| T108 | Update message queries to include reactions data | backend-engineer | T097a | âœ— | 1h |
| T109 | Add E2E test for full reaction flow in tests/e2e/messaging-reactions.spec.ts | e2e-specialist | T106, T107 | âœ— | 1.5h |
| T110 | Code review and quality gate verification | code-reviewer | T109, T105b | âœ— | 1h |

**Sub-tasks Detail:**

**T106**: Integrate reaction-bar into message-item
- File: `src/components/messaging/message-item.tsx`
- Skills: react-nextjs, convex
- Requirements:
  - Add ReactionBar component below message content
  - Pass messageId and reactions array from query
  - Position correctly (below thread reply count if exists)
  - Ensure hover action buttons don't overlap reaction bar
  - Handle loading state (skeleton while reactions load)
- Context7: /facebook/react (components)

**T107**: Integrate emoji-picker into message-action-buttons
- File: `src/components/messaging/message-action-buttons.tsx`
- Skills: react-nextjs, ui-components
- Requirements:
  - Add "Add reaction" button (smile emoji icon) to action buttons
  - Open emoji picker on click
  - Position picker above/below message (auto-detect available space)
  - Close picker after emoji selected
  - Ensure picker doesn't interfere with other buttons
- Context7: /shadcn-ui/ui (Popover positioning)

**T108**: Update message queries to include reactions
- File: `convex/messages/channelQueries.ts` and `convex/messages/conversationQueries.ts`
- Skills: convex, typescript
- Requirements:
  - For each message returned, call getMessageReactions query
  - Include reactions array in response
  - Use Promise.all for parallel fetching (performance)
  - Update return type validators to include reactions
- Context7: /get-convex/convex (queries, performance)

**T109**: Add E2E test for full reaction flow
- File: `tests/e2e/messaging-reactions.spec.ts`
- Skills: testing, react-nextjs
- Test cases:
  - User clicks "Add reaction" button
  - Emoji picker appears
  - User selects emoji
  - Reaction appears on message
  - Reaction count increments
  - User can remove their reaction
  - Other users see the reaction in real-time
  - Multiple emojis on same message
- Context7: /microsoft/playwright

**T110**: Code review and quality gate verification
- Files: All files modified in Phase 9
- Skills: code-reviewer, security-auditor
- Checklist:
  - TypeScript compiles: `pnpm typecheck`
  - ESLint passes: `pnpm lint`
  - Unit tests pass: `pnpm test`
  - E2E tests pass: `pnpm test:e2e`
  - No console.log or debugger statements
  - All mutations use requireAuth()
  - Queries use indexes (not .filter())
  - Accessibility verified (keyboard nav, screen readers)
  - Emoji picker is performant (lazy loading)
  - Mention parsing is secure (no XSS)
  - Real-time updates work (Convex subscriptions)

---

## Execution Order & Parallelization

### Batch 1: Backend Foundation (Parallel)
- **T095a**: Create addReaction mutation
- **T097a**: Create getMessageReactions query
- **T098a**: Review extractAndStoreMentions
- **T098b**: Create getMentionsForUser query
- **T101a**: Install emoji-mart packages
- **T103a**: Review mention-input-messaging

**Wait for batch completion** âž¡ï¸

### Batch 2: Backend Tests + Frontend Components (Parallel)
- **T095b**: Test addReaction
- **T096a**: Create removeReaction mutation
- **T097b**: Update validator
- **T097c**: Test getMessageReactions
- **T098c**: Test mention extraction
- **T100a**: Enhance extractAndStoreMentions
- **T101b**: Create emoji-picker component

**Wait for batch completion** âž¡ï¸

### Batch 3: Frontend Components (Sequential + Parallel)
- **T096b**: Test removeReaction
- **T099a**: Create markMentionAsRead mutation
- **T100b**: Test @here/@everyone
- **T101c**: Test emoji-picker _(parallel)_
- **T102a**: Create reaction-bar component

**Wait for batch completion** âž¡ï¸

### Batch 4: Integration Components (Sequential)
- **T099b**: Test markMentionAsRead
- **T102b**: Test reaction-bar
- **T103b**: Add @here/@everyone to autocomplete
- **T104a**: Add mention highlighting

**Wait for batch completion** âž¡ï¸

### Batch 5: Integration & Tests (Sequential)
- **T103c**: Test mention autocomplete
- **T104b**: Test mention highlighting
- **T105a**: Verify message-input integration
- **T106**: Integrate reaction-bar into message-item
- **T107**: Integrate emoji-picker into action buttons
- **T108**: Update message queries

**Wait for batch completion** âž¡ï¸

### Batch 6: E2E & Quality (Sequential)
- **T105b**: E2E test for mentions
- **T109**: E2E test for reactions
- **T110**: Code review and quality gates

---

## Quality Gates

### Per-Component Gates
- [ ] TypeScript compiles without errors
- [ ] Component has loading states (Skeleton)
- [ ] Component has error handling (toast)
- [ ] Component is accessible (WCAG 2.1 AA)
- [ ] Component is keyboard navigable
- [ ] Component is responsive (mobile-first)

### Backend Gates (convex/reactions.ts, convex/mentions.ts)
- [ ] All mutations use `requireAuth()` on first line
- [ ] All queries use `.withIndex()` (not `.filter()`)
- [ ] All functions have `returns:` validator
- [ ] All functions have JSDoc comments
- [ ] Integration tests pass (convex-test)

### Frontend Gates (emoji-picker, reaction-bar, mention highlighting)
- [ ] Components use React.memo for performance
- [ ] Real-time updates work (Convex subscriptions)
- [ ] Optimistic updates for instant feedback
- [ ] No layout shift when reactions load
- [ ] Emoji picker lazy loads data
- [ ] Mention parsing is secure (escapes HTML)

### Security Gates
- [ ] No XSS vulnerabilities in mention parsing
- [ ] Emoji validation prevents injection
- [ ] User can only delete their own reactions
- [ ] @everyone mention restricted to admins (optional)

### E2E Gates
- [ ] Full reaction flow works end-to-end
- [ ] Full mention flow works end-to-end
- [ ] Real-time collaboration works (multiple users)
- [ ] No console errors in browser

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Emoji picker bundle size** | Large initial load | Lazy load @emoji-mart/data, code-split picker component |
| **Reaction count race conditions** | Incorrect counts | Use Convex transactions, optimistic UI with revert on failure |
| **Mention parsing XSS** | Security vulnerability | Sanitize all user input, use DOMPurify for HTML rendering |
| **@everyone spam** | Notification overload | Restrict to admins only, add rate limiting (future) |
| **Real-time updates lag** | Poor UX | Use Convex subscriptions, implement optimistic updates |
| **Emoji picker a11y** | Accessibility issues | Ensure keyboard nav, screen reader support, focus management |

---

## Success Criteria

### Functional Requirements Met
- âœ… FR-016: Users can add emoji reactions to any message
- âœ… FR-016: Users can see reaction counts grouped by emoji
- âœ… FR-016: Users can remove their own reactions
- âœ… FR-017: Users can @mention other users with autocomplete
- âœ… FR-017: @here mentions all online users in channel
- âœ… FR-017: @everyone mentions all users in channel
- âœ… FR-032: Mentions are highlighted in message display

### User Experience
- Emoji picker is intuitive and fast
- Reactions appear instantly (optimistic updates)
- Mention autocomplete shows results within 200ms
- Mention highlighting is visually distinct
- Mobile experience is smooth (touch targets 44x44px)

### Technical Quality
- All unit tests pass (100% coverage for new code)
- All E2E tests pass
- No TypeScript errors
- No accessibility violations
- Performance: Emoji picker loads in <500ms
- Performance: Reaction toggle feels instant (<100ms perceived latency)

---

## Dependencies Summary

### External Libraries
- **@emoji-mart/react** - Emoji picker component
- **@emoji-mart/data** - Emoji data files

### Internal Dependencies
- **convex/messages/helpers.ts** - extractAndStoreMentions (already exists)
- **src/components/messaging/mention-input-messaging.tsx** - Autocomplete (already exists)
- **convex/schema.ts** - reactions and mentions tables (already exist)

### Context7 Documentation Required
| Technology | Library ID | Topics |
|------------|-----------|--------|
| Emoji Mart | `/missive/emoji-mart` | picker, react, customization |
| Convex | `/get-convex/convex` | mutations, queries, indexes, subscriptions |
| React | `/facebook/react` | hooks, memo, performance |
| Plate.js | `/websites/platejs` | mention plugin, combobox |
| Vitest | `/vitest-dev/vitest` | testing, mocking |
| Playwright | `/microsoft/playwright` | e2e, selectors |

---

## Prochaine Ã‰tape

**Delegate to `agent-orchestrator`** to execute this plan in batches following the execution order above.

**Recommended approach:**
1. Start with Batch 1 (Backend Foundation)
2. Validate quality gates after each batch
3. Parallelize where marked [P]
4. Escalate if emoji-mart documentation is insufficient

---

âœ… **TASK-DECOMPOSER COMPLETE**
â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"
Feature analyzed: Phase 9 - Reactions and Mentions
Complexity: M (Medium)
Tasks generated: 35 atomic sub-tasks
Agents involved: backend-engineer, frontend-engineer, test-architect, e2e-specialist, code-reviewer, security-auditor
Critical path: T095a â†' T097a â†' T101b â†' T102a â†' T106 â†' T109 â†' T110
Estimated duration: 2.5-3 days (with parallelization)
Next step: agent-orchestrator to execute in 6 batches
â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"â"
