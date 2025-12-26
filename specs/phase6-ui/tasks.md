# Phase 6 UI Features - Task List

**Feature**: Channel Search + Settings Integration
**Created**: 2025-12-26
**Status**: Ready for execution

## Task Assignments

### Phase 1: Backend Verification

- [ ] **T001** - Verify `api.channels.search` query exists
  - **Agent**: backend-engineer
  - **File**: `convex/channels.ts`
  - **Complexity**: XS (15 min)
  - **Depends**: —
  - **Parallel**: ✓
  - **Skills**: convex, security
  - **Acceptance**:
    - Query exists and accepts `{ query: string, limit?: number }`
    - Returns channels with name, type, memberCount
    - Respects 2-char minimum
    - Handles permissions correctly
  - **If Not Exists**: STOP and escalate to orchestrator

---

### Phase 2: Channel Search Component

- [ ] **T002** - Create ChannelSearch component skeleton
  - **Agent**: frontend-engineer
  - **File**: `src/components/messaging/channel-search.tsx` (NEW)
  - **Complexity**: S (45 min)
  - **Depends**: T001
  - **Parallel**: ✗
  - **Skills**: react-nextjs, ui-components, convex
  - **Context7 Pre-Validated**:
    - React: `/facebook/react` (useState, useCallback, useEffect)
    - Next.js: `/vercel/next.js` (useRouter, navigation)
    - Convex: `/get-convex/convex` (useQuery, real-time)
  - **Acceptance**:
    - Component renders without errors
    - Search input with magnifying glass icon
    - Debounced input (300ms)
    - Convex query skipped if < 2 chars
    - Basic structure complete

- [ ] **T003** - Add keyboard navigation to ChannelSearch
  - **Agent**: frontend-engineer
  - **File**: `src/components/messaging/channel-search.tsx`
  - **Complexity**: S (30 min)
  - **Depends**: T002
  - **Parallel**: ✗
  - **Skills**: ui-components (accessibility)
  - **Context7 Pre-Validated**:
    - React: `/facebook/react` (useRef, keyboard events)
    - Radix UI: `/radix-ui/primitives` (focus management)
  - **Acceptance**:
    - Arrow Up/Down navigate results
    - Enter selects highlighted channel
    - Escape clears search
    - ARIA attributes present
    - Visual feedback on selection

- [ ] **T004** - Add loading and empty states to ChannelSearch
  - **Agent**: frontend-engineer
  - **File**: `src/components/messaging/channel-search.tsx`
  - **Complexity**: XS (20 min)
  - **Depends**: T002
  - **Parallel**: ✗
  - **Skills**: ui-components
  - **Acceptance**:
    - Idle state: "Type at least 2 characters"
    - Loading state: Spinner while querying
    - Empty state: "No channels found"
    - Styling matches NewDMDialog

---

### Phase 3: Sidebar Integration

- [ ] **T005** - Integrate ChannelSearch into MessagingSidebar
  - **Agent**: frontend-engineer
  - **File**: `src/components/messaging/messaging-sidebar.tsx`
  - **Complexity**: XS (15 min)
  - **Depends**: T002, T003, T004
  - **Parallel**: ✗
  - **Skills**: react-nextjs
  - **Acceptance**:
    - Search bar below QuickNavigation
    - Search bar above Favorites section
    - No layout shift
    - Scroll behavior works
    - Full width of sidebar

---

### Phase 4: Channel Header Settings Integration

- [ ] **T006** - Add "Channel settings" menu item to channel header
  - **Agent**: frontend-engineer
  - **File**: `src/components/messaging/channel-header.tsx`
  - **Complexity**: S (30 min)
  - **Depends**: —
  - **Parallel**: ✓
  - **Skills**: react-nextjs, ui-components
  - **Context7 Pre-Validated**:
    - shadcn/ui: `/shadcn-ui/ui` (dropdown-menu)
  - **Acceptance**:
    - "Channel settings" in dropdown
    - Only shown to admins/owners/moderators
    - Settings icon displayed
    - Opens ChannelSettingsDialog
    - Passes correct channelId
    - No TypeScript errors

---

### Phase 5: Testing & Quality Assurance

- [ ] **T007** - Manual testing - Channel search functionality
  - **Agent**: frontend-engineer
  - **Complexity**: XS (20 min)
  - **Depends**: T002, T003, T004, T005
  - **Parallel**: ✓
  - **Test Checklist**:
    - [ ] Search bar visible
    - [ ] 1 char shows prompt
    - [ ] 2+ chars triggers search
    - [ ] Loading state appears
    - [ ] Results appear
    - [ ] Click navigates
    - [ ] Keyboard nav works
    - [ ] Empty state works
    - [ ] Clear button works
    - [ ] Debounce works

- [ ] **T008** - Manual testing - Settings dialog integration
  - **Agent**: frontend-engineer
  - **Complexity**: XS (15 min)
  - **Depends**: T006
  - **Parallel**: ✓
  - **Test Checklist**:
    - [ ] Settings visible for admins
    - [ ] Settings hidden for members
    - [ ] Dialog opens correctly
    - [ ] Correct channel data
    - [ ] Close button works
    - [ ] Backdrop click works
    - [ ] No console errors

- [ ] **T009** - TypeScript and build verification
  - **Agent**: frontend-engineer
  - **Complexity**: XS (10 min)
  - **Depends**: T005, T006
  - **Parallel**: ✗
  - **Commands**:
    ```bash
    pnpm typecheck
    pnpm lint
    pnpm build
    ```
  - **Acceptance**:
    - [ ] TypeScript compiles
    - [ ] ESLint passes
    - [ ] Build succeeds
    - [ ] No console warnings

---

### Phase 6: Documentation

- [ ] **T010** - Update component documentation
  - **Agent**: frontend-engineer
  - **Complexity**: XS (15 min)
  - **Depends**: T009
  - **Parallel**: ✗
  - **Acceptance**:
    - JSDoc on ChannelSearch
    - Props interface documented
    - Usage example provided
    - Pattern matches existing components

---

## Execution Order

### Sequential Tasks
1. T001 (verify backend) → T002 (component skeleton)
2. T002 → T003 (keyboard nav)
3. T002 → T004 (states)
4. T003 + T004 → T005 (sidebar integration)
5. T005 + T008 → T009 (verification)
6. T009 → T010 (docs)

### Parallel Tasks
- T001 can run in parallel with planning
- T006 can run in parallel with T002-T005
- T007 and T008 can run in parallel

## Critical Path

**T001 → T002 → T003 → T004 → T005 → T007 → T009 → T010**

Estimated: **3.5-4 hours total**

## Quality Gates (Must Pass)

- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] ESLint passes (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Search bar visible in sidebar
- [ ] Search returns results after 2+ chars
- [ ] Keyboard navigation functional
- [ ] Settings accessible from header
- [ ] Settings dialog opens correctly
- [ ] No console errors
- [ ] Manual testing complete

## Notes for Agent Orchestrator

1. **START with T001** - If backend query doesn't exist, STOP and escalate
2. **T006 can run early** - Independent of search feature
3. **T007 and T008 in parallel** - Different features to test
4. **All tasks use frontend-engineer** except T001 (backend-engineer)
5. **Reference existing patterns**: NewDMDialog, channel-header dropdown

## Skill References Required

All frontend tasks need:
- `.claude/skills/react-nextjs/SKILL.md`
- `.claude/skills/ui-components/SKILL.md`
- `.claude/skills/convex/SKILL.md`
- `.claude/skills/typescript/SKILL.md`

Backend verification (T001) needs:
- `.claude/skills/convex/SKILL.md`
- `.claude/skills/security/SKILL.md`
