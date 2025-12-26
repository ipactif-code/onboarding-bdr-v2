# 📋 PHASE 8 TASK DECOMPOSITION

**Feature**: Rich Text Messages (User Story 6)
**Estimated Complexity**: M (Medium)
**Estimated Duration**: 1.5-2 days
**Total Tasks**: 18 sub-tasks

---

## Prerequisites (Validation)

- [x] Basic messaging components exist (`message-input.tsx`, `message-item.tsx`)
- [x] Plate.js is installed and configured
- [x] Basic marks (Bold, Italic, Code) are working
- [x] Message serialization utilities exist (`message-input-utils.ts`)
- [ ] Extended Plate.js plugins configured for messaging
- [ ] Rich text renderer implemented

---

## Dependencies Summary

```
Critical Path:
T088.1 → T089.1 → T090.1 → T091.1 → T094.1 → T094.4 → [Complete]

Parallel Branches:
- T088.2 + T088.3 + T088.4 (can run simultaneously after T088.1)
- T089.2 + T089.3 (can run simultaneously after T089.1)
- T090.2 + T090.3 (can run simultaneously after T090.1)
- T091.2 + T092.1 + T093.1 (can run after T090.1 independently)
```

---

## Phase 8.1: Plugin Configuration (T088 - Configure Plate.js)

**Goal**: Add Link, Mention, Autoformat, and SoftBreak plugins to MessageInput

### T088.1: Add Link plugin to MessageInput [P] ⚙️

**Size**: S
**Agent**: frontend-engineer
**File**: `src/components/messaging/message-input.tsx`
**Skills**: `ui-components`, `react-nextjs`
**Context7 IDs**: `/websites/platejs`, `/facebook/react`

**Task**:
1. Import `LinkPlugin` from `@platejs/link/react`
2. Import `LinkElement` from `@/components/ui/link-node` (already exists)
3. Add `LinkPlugin.configure({ render: { node: LinkElement } })` to `MessageInputPlugins`
4. Verify links can be inserted via keyboard shortcuts (Cmd/Ctrl+K would be ideal, but may require toolbar)
5. Test pasting URLs auto-creates links

**Dependencies**: None
**Acceptance**:
- [ ] User can create links in message input
- [ ] Pasted URLs auto-convert to link nodes
- [ ] Links are serialized correctly in JSON

---

### T088.2: Add Autoformat plugin to MessageInput [P] ⚙️

**Size**: S
**Agent**: frontend-engineer
**File**: `src/components/messaging/message-input.tsx`
**Skills**: `ui-components`, `react-nextjs`
**Context7 IDs**: `/websites/platejs`

**Task**:
1. Import autoformat rules from `@/components/editor/plugins/autoformat-kit` (already exists)
2. Extract only message-relevant autoformat rules:
   - Marks: `**bold**`, `*italic*`, `` `code` ``, `~~strikethrough~~`
   - Lists: `* ` for bullet, `1. ` for numbered
   - No headings, blockquotes, code blocks (too complex for messaging)
3. Create minimal `MessageAutoformatRules` array
4. Add `AutoformatPlugin.configure({ options: { rules: MessageAutoformatRules } })` to plugins
5. Test markdown shortcuts work

**Dependencies**: T088.1
**Acceptance**:
- [ ] `**text**` auto-formats to bold
- [ ] `*text*` auto-formats to italic
- [ ] `` `code` `` auto-formats to inline code
- [ ] `* ` triggers bullet list
- [ ] `1. ` triggers numbered list

---

### T088.3: Add Mention plugin to MessageInput [P] ⚙️

**Size**: M
**Agent**: frontend-engineer
**Files**:
- `src/components/messaging/message-input.tsx`
- `src/components/messaging/mention-combobox-messaging.tsx` (new)
**Skills**: `ui-components`, `react-nextjs`, `convex`
**Context7 IDs**: `/websites/platejs`, `/get-convex/convex`

**Task**:
1. Import `MentionPlugin` from `@platejs/mention/react`
2. Import `MentionElementStatic` from `@/components/ui/mention-node-static` (already exists)
3. Create `MentionComboboxMessaging` component:
   - Query Convex for users matching `@` input
   - Display user list with avatars
   - Insert mention node on selection
4. Add `MentionPlugin.configure({ render: { node: MentionElementStatic }, options: { triggerPreviousCharPattern: /^$|^[\s]$/ } })` to plugins
5. Test `@username` triggers mention combobox

**Dependencies**: T088.1
**Acceptance**:
- [ ] Typing `@` triggers user search combobox
- [ ] Selecting user inserts mention
- [ ] Mentions are serialized with user ID

---

### T088.4: Add SoftBreak plugin to MessageInput [P] ⚙️

**Size**: XS
**Agent**: frontend-engineer
**File**: `src/components/messaging/message-input.tsx`
**Skills**: `ui-components`, `react-nextjs`
**Context7 IDs**: `/websites/platejs`

**Task**:
1. Import `SoftBreakPlugin` from `@platejs/break/react`
2. Configure to insert line break on `Shift+Enter`
3. Ensure plain `Enter` still sends message (existing behavior)
4. Add to `MessageInputPlugins` array

**Dependencies**: T088.1
**Acceptance**:
- [ ] `Shift+Enter` inserts line break (soft break)
- [ ] `Enter` sends message (existing behavior preserved)

---

## Phase 8.2: Markdown Shortcuts (T089 - Enhanced UX)

**Goal**: Ensure all basic markdown shortcuts work seamlessly

### T089.1: Verify markdown mark shortcuts [P] ⚙️

**Size**: XS
**Agent**: test-architect
**File**: `src/components/messaging/message-input.test.tsx` (new)
**Skills**: `testing`, `ui-components`
**Context7 IDs**: `/vitest-dev/vitest`, `/testing-library/react-testing-library`

**Task**:
1. Create unit test suite for MessageInput autoformat
2. Test cases:
   - `**bold**` → bold mark
   - `*italic*` → italic mark
   - `` `code` `` → code mark
   - `~~strike~~` → strikethrough mark
3. Use Testing Library to simulate typing

**Dependencies**: T088.2
**Acceptance**:
- [ ] All mark autoformat tests pass
- [ ] Coverage > 80% for autoformat logic

---

### T089.2: Verify list markdown shortcuts [P] 🧪

**Size**: XS
**Agent**: test-architect
**File**: `src/components/messaging/message-input.test.tsx`
**Skills**: `testing`, `ui-components`
**Context7 IDs**: `/vitest-dev/vitest`

**Task**:
1. Add test cases for list autoformat:
   - `* ` → bullet list
   - `1. ` → numbered list
2. Verify list items can be nested (Tab/Shift+Tab)

**Dependencies**: T089.1
**Acceptance**:
- [ ] List autoformat tests pass
- [ ] Nested lists work correctly

---

### T089.3: Document markdown shortcuts [P] 📄

**Size**: XS
**Agent**: frontend-engineer
**File**: `src/components/messaging/markdown-help-dialog.tsx` (new)
**Skills**: `ui-components`, `react-nextjs`
**Context7 IDs**: `/shadcn-ui/ui`

**Task**:
1. Create `MarkdownHelpDialog` component using shadcn Dialog
2. Display table of supported markdown shortcuts:
   - Text formatting (bold, italic, code, strike)
   - Lists (bullet, numbered)
   - Links (auto-detection)
   - Mentions (@username)
3. Add "?" icon button near MessageInput to open dialog

**Dependencies**: T089.1
**Acceptance**:
- [ ] Help dialog is accessible from MessageInput
- [ ] All shortcuts are documented
- [ ] Dialog is keyboard navigable (Esc to close)

---

## Phase 8.3: Rich Text Renderer (T090 - Display)

**Goal**: Render formatted message content in MessageItem

### T090.1: Create RichTextRenderer component ⚙️

**Size**: M
**Agent**: frontend-engineer
**File**: `src/components/messaging/rich-text-renderer.tsx` (new)
**Skills**: `ui-components`, `react-nextjs`
**Context7 IDs**: `/websites/platejs`, `/facebook/react`

**Task**:
1. Create `RichTextRenderer` component:
   - Accepts `content: string` prop (serialized JSON)
   - Deserializes JSON to Plate.js value
   - Renders using Plate in read-only mode
2. Configure minimal plugins for rendering:
   - BoldPlugin, ItalicPlugin, CodePlugin
   - LinkPlugin (with LinkElement)
   - BaseListPlugin (for ul/ol)
3. Add custom CSS for message-specific styling:
   - Smaller font size (text-sm)
   - Tighter line height
   - Inline list rendering (no excessive margins)

**Dependencies**: T088.1, T088.2
**Acceptance**:
- [ ] Component renders bold, italic, code marks
- [ ] Component renders links (clickable)
- [ ] Component renders lists (ul, ol)
- [ ] Styling matches message context (compact)

---

### T090.2: Integrate RichTextRenderer into MessageItem [P] ⚙️

**Size**: S
**Agent**: frontend-engineer
**File**: `src/components/messaging/message-item.tsx`
**Skills**: `ui-components`, `react-nextjs`

**Task**:
1. Import `RichTextRenderer` component
2. Replace `content` text rendering with:
   ```tsx
   <RichTextRenderer content={content} />
   ```
3. Add fallback for plain text (if deserialization fails)
4. Ensure styling consistency with existing MessageItem

**Dependencies**: T090.1
**Acceptance**:
- [ ] Rich text messages render correctly
- [ ] Plain text fallback works
- [ ] No layout shifts or overflow issues

---

### T090.3: Add unit tests for RichTextRenderer [P] 🧪

**Size**: S
**Agent**: test-architect
**File**: `src/components/messaging/rich-text-renderer.test.tsx` (new)
**Skills**: `testing`, `ui-components`
**Context7 IDs**: `/vitest-dev/vitest`, `/testing-library/react-testing-library`

**Task**:
1. Test rendering bold, italic, code marks
2. Test rendering links with href
3. Test rendering bullet/numbered lists
4. Test invalid JSON fallback to plain text

**Dependencies**: T090.1
**Acceptance**:
- [ ] All rendering tests pass
- [ ] Edge cases handled (empty content, malformed JSON)

---

## Phase 8.4: Advanced Features (T091, T092, T093)

**Goal**: Link preview, code highlighting, list rendering

### T091.1: Add link preview support [P] ⚙️

**Size**: M
**Agent**: frontend-engineer
**Files**:
- `src/components/messaging/link-preview.tsx` (new)
- `convex/messages.ts` (update)
**Skills**: `ui-components`, `convex`, `react-nextjs`
**Context7 IDs**: `/get-convex/convex`, `/facebook/react`

**Task**:
1. Create `LinkPreview` component:
   - Displays URL, title, description, thumbnail
   - Fetches metadata via Convex action (Open Graph)
2. Update RichTextRenderer to detect link nodes
3. For each link, render LinkPreview below message content
4. Add loading state (skeleton) while fetching metadata
5. Cache metadata in Convex (avoid re-fetching)

**Dependencies**: T090.1
**Acceptance**:
- [ ] Links display preview card with title/description
- [ ] Previews load asynchronously without blocking message render
- [ ] Failed previews degrade gracefully (show URL only)

**FR Reference**: FR-010 (enhanced link support)

---

### T091.2: Add link preview Convex action [P] ⚙️

**Size**: M
**Agent**: backend-engineer
**File**: `convex/actions/link-preview.ts` (new)
**Skills**: `convex`, `security`
**Context7 IDs**: `/get-convex/convex`

**Task**:
1. Create action `generateLinkPreview(url: string)`
2. Fetch Open Graph metadata (og:title, og:description, og:image)
3. Use `node-fetch` or similar library
4. Validate URL (https only, no localhost/private IPs)
5. Return metadata object with error handling
6. Add rate limiting (max 10 requests/minute per user)

**Dependencies**: T091.1
**Acceptance**:
- [ ] Action returns metadata for valid URLs
- [ ] Invalid URLs return error gracefully
- [ ] Rate limiting prevents abuse
- [ ] Security review passes (no SSRF vulnerability)

---

### T092.1: Add code block syntax highlighting [P] ⚙️

**Size**: M
**Agent**: frontend-engineer
**Files**:
- `src/components/messaging/code-block-message.tsx` (new)
- `src/components/messaging/rich-text-renderer.tsx` (update)
**Skills**: `ui-components`, `react-nextjs`
**Context7 IDs**: `/websites/platejs`, `/facebook/react`

**Task**:
1. Install `react-syntax-highlighter` or similar
2. Create `CodeBlockMessage` component:
   - Renders code with syntax highlighting
   - Auto-detect language (or default to plaintext)
   - Add copy button
3. Update RichTextRenderer to use CodeBlockMessage for code blocks
4. Style for compact messaging context

**Dependencies**: T090.1
**Acceptance**:
- [ ] Code blocks render with syntax highlighting
- [ ] Language auto-detection works
- [ ] Copy button copies code to clipboard
- [ ] Dark mode supported

**FR Reference**: FR-010 (code block support)

---

### T093.1: Enhance list rendering [P] ⚙️

**Size**: S
**Agent**: frontend-engineer
**File**: `src/components/messaging/rich-text-renderer.tsx`
**Skills**: `ui-components`, `react-nextjs`

**Task**:
1. Configure ListPlugin in RichTextRenderer
2. Style lists for messaging:
   - Reduced margins (my-1 instead of my-4)
   - Smaller bullet/number size
   - Tighter line spacing
3. Test nested lists
4. Ensure ordered lists start at correct number

**Dependencies**: T090.1
**Acceptance**:
- [ ] Bullet lists render with compact spacing
- [ ] Numbered lists render correctly
- [ ] Nested lists indent properly
- [ ] No excessive whitespace

**FR Reference**: FR-010 (list support)

---

## Phase 8.5: Character Limit Validation (T094)

**Goal**: Enforce 4000 character limit with proper UX

### T094.1: Extract text length from rich content ⚙️

**Size**: S
**Agent**: frontend-engineer
**File**: `src/components/messaging/message-input-utils.ts`
**Skills**: `typescript`, `ui-components`
**Context7 IDs**: `/microsoft/typescript`

**Task**:
1. Update `getTextFromValue()` function:
   - Count only visible text characters (not formatting JSON)
   - Exclude HTML tags, Plate.js metadata
   - Count link text (not full URL in JSON)
2. Add unit tests for character counting edge cases:
   - Text with bold/italic marks
   - Text with links
   - Text with lists
   - Mixed formatting

**Dependencies**: None (existing code update)
**Acceptance**:
- [ ] Character count matches visible text only
- [ ] Formatting markup doesn't count toward limit
- [ ] All edge case tests pass

**FR Reference**: FR-046 (4000 character limit)

---

### T094.2: Display character count warning [P] ⚙️

**Size**: XS
**Agent**: frontend-engineer
**File**: `src/components/messaging/message-input.tsx`
**Skills**: `ui-components`, `react-nextjs`

**Task**:
1. Show character count when user is within 200 chars of limit
2. Change color to warning (orange) at 3800 chars
3. Change color to destructive (red) when over limit
4. Position counter in bottom-right of input (already exists, verify)

**Dependencies**: T094.1
**Acceptance**:
- [ ] Counter appears at 3800 characters
- [ ] Warning color at 3800
- [ ] Destructive color when over 4000
- [ ] Counter doesn't overlap with text

---

### T094.3: Prevent sending over-limit messages [P] ⚙️

**Size**: XS
**Agent**: frontend-engineer
**File**: `src/components/messaging/message-input.tsx`
**Skills**: `ui-components`, `react-nextjs`

**Task**:
1. Disable Send button when `characterCount > maxLength`
2. Show tooltip on hover: "Message exceeds 4000 character limit"
3. Prevent Enter key from sending when over limit
4. Add toast notification if user tries to send over-limit message

**Dependencies**: T094.2
**Acceptance**:
- [ ] Send button disabled when over limit
- [ ] Tooltip explains why button is disabled
- [ ] Enter key doesn't send over-limit message
- [ ] Clear user feedback via toast

---

### T094.4: Add E2E test for character limit 🧪

**Size**: S
**Agent**: e2e-specialist
**File**: `tests/e2e/messaging/character-limit.spec.ts` (new)
**Skills**: `testing`
**Context7 IDs**: `/microsoft/playwright`

**Task**:
1. Create E2E test scenario:
   - Navigate to Messages
   - Type message approaching limit (3900 chars)
   - Verify warning color appears
   - Type beyond limit (4100 chars)
   - Verify Send button is disabled
   - Verify error state styling
2. Test edge case: Delete characters to go back under limit
3. Verify Send button re-enables

**Dependencies**: T094.3
**Acceptance**:
- [ ] E2E test passes
- [ ] Character limit enforced in UI
- [ ] User can recover by editing message

---

## Phase 8.6: Quality Assurance

**Goal**: Ensure all features work together without regressions

### T095.1: Integration test - Send formatted message 🧪

**Size**: M
**Agent**: test-architect
**File**: `tests/integration/messaging/rich-text-messaging.test.ts` (new)
**Skills**: `testing`, `convex`
**Context7 IDs**: `/vitest-dev/vitest`

**Task**:
1. Create integration test:
   - User A sends message with bold, italic, link, list
   - Verify message is serialized correctly in Convex
   - User B receives message
   - Verify RichTextRenderer displays all formatting
2. Test mention insertion and rendering
3. Test link preview generation

**Dependencies**: T090.2, T091.1, T094.3
**Acceptance**:
- [ ] End-to-end rich text flow works
- [ ] No data loss in serialization/deserialization
- [ ] All formatting renders correctly

---

### T095.2: Accessibility audit for rich text input 🔍

**Size**: S
**Agent**: accessibility-expert
**Files**:
- `src/components/messaging/message-input.tsx`
- `src/components/messaging/rich-text-renderer.tsx`
**Skills**: `ui-components`, `testing`

**Task**:
1. Verify keyboard navigation works for:
   - Typing and formatting
   - Inserting links/mentions
   - Navigating lists
   - Opening markdown help dialog
2. Verify screen reader announces:
   - Character count warnings
   - Link insertion
   - Mention insertion
   - Send button state (enabled/disabled)
3. Test with NVDA/VoiceOver

**Dependencies**: T094.3, T089.3
**Acceptance**:
- [ ] All interactive elements keyboard accessible
- [ ] Screen reader provides meaningful feedback
- [ ] No accessibility violations (WCAG 2.1 AA)

---

### T095.3: Performance test - Large messages 🔍

**Size**: S
**Agent**: performance-engineer
**File**: `tests/performance/messaging/rich-text-render.bench.ts` (new)
**Skills**: `testing`, `performance`
**Context7 IDs**: `/vitest-dev/vitest`

**Task**:
1. Benchmark RichTextRenderer with:
   - 1000 character message with mixed formatting
   - 3000 character message with lists/links
   - 4000 character message (max limit)
2. Measure render time (target < 100ms)
3. Measure memory usage
4. Identify any performance bottlenecks

**Dependencies**: T090.2
**Acceptance**:
- [ ] Render time < 100ms for typical messages
- [ ] No memory leaks detected
- [ ] Performance within acceptable range

---

### T095.4: Code review - Security & XSS protection 🔍

**Size**: M
**Agent**: security-auditor
**Files**:
- `src/components/messaging/message-input.tsx`
- `src/components/messaging/rich-text-renderer.tsx`
- `convex/actions/link-preview.ts`
**Skills**: `security`, `convex`

**Task**:
1. Review serialization/deserialization for XSS vulnerabilities
2. Verify link URLs are sanitized (no javascript: protocol)
3. Verify link preview action is safe from SSRF
4. Check mention insertion doesn't allow arbitrary HTML
5. Verify character limit can't be bypassed via client manipulation

**Dependencies**: T091.2, T090.2, T094.3
**Acceptance**:
- [ ] No XSS vulnerabilities found
- [ ] Link URLs properly validated
- [ ] Link preview action has SSRF protections
- [ ] Character limit enforced server-side

---

## Quality Gates

### TypeScript & Linting
- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm lint` passes with no errors
- [ ] No `any` types introduced
- [ ] All new functions have explicit return types

### Testing
- [ ] Unit tests pass (`pnpm test`)
- [ ] E2E tests pass (`pnpm test:e2e`)
- [ ] Integration tests pass
- [ ] Code coverage > 80% for new code

### Component Quality
- [ ] All components have loading states
- [ ] All components have error states
- [ ] All components are responsive (mobile/tablet/desktop)
- [ ] All components are keyboard navigable
- [ ] All components support dark mode

### Convex Quality
- [ ] All actions have input validation
- [ ] Rate limiting implemented where needed
- [ ] Error handling complete
- [ ] No N+1 query issues

### Security
- [ ] Security audit completed
- [ ] XSS vulnerabilities addressed
- [ ] SSRF vulnerabilities addressed
- [ ] Input validation on client and server

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Link preview SSRF** | High | Validate URLs, block private IPs, rate limit |
| **XSS via rich text** | High | Sanitize URLs, use Plate.js built-in security |
| **Performance with large messages** | Medium | Benchmark early, optimize rendering if needed |
| **Character limit bypass** | Medium | Enforce limit server-side in Convex mutation |
| **Markdown shortcuts conflict** | Low | Test thoroughly, document behavior |

---

## Execution Order

### Parallel Group 1 (Foundation - can run simultaneously)
- T088.1: Add Link plugin ⚙️
- T094.1: Extract text length ⚙️

### Sequential Group 2 (Depends on T088.1)
- T088.2: Add Autoformat plugin ⚙️
- T088.3: Add Mention plugin ⚙️
- T088.4: Add SoftBreak plugin ⚙️

### Parallel Group 3 (Depends on Group 2)
- T089.1: Verify markdown mark shortcuts 🧪
- T090.1: Create RichTextRenderer ⚙️
- T094.2: Display character count warning ⚙️

### Parallel Group 4 (Depends on Group 3)
- T089.2: Verify list markdown shortcuts 🧪
- T089.3: Document markdown shortcuts 📄
- T090.2: Integrate RichTextRenderer ⚙️
- T090.3: Add unit tests for RichTextRenderer 🧪
- T094.3: Prevent sending over-limit messages ⚙️

### Parallel Group 5 (Advanced features - depends on T090.1)
- T091.1: Add link preview support ⚙️
- T091.2: Add link preview Convex action ⚙️
- T092.1: Add code block syntax highlighting ⚙️
- T093.1: Enhance list rendering ⚙️
- T094.4: Add E2E test for character limit 🧪

### Sequential Group 6 (QA - depends on Group 5)
- T095.1: Integration test ✅
- T095.2: Accessibility audit ✅
- T095.3: Performance test ✅
- T095.4: Security code review ✅

---

## Completion Criteria

✅ **Phase 8 is complete when:**

1. All 18 tasks marked as complete
2. All quality gates passed
3. Code review approved by:
   - code-reviewer (general quality)
   - security-auditor (security review)
   - accessibility-expert (a11y audit)
4. E2E tests passing in CI
5. No regressions in existing messaging features
6. FR-010 and FR-046 requirements fully implemented

---

## Legend

- ⚙️ Implementation task
- 🧪 Testing task
- 📄 Documentation task
- 🔍 Review/audit task
- [P] Can run in parallel with other [P] tasks in same group
