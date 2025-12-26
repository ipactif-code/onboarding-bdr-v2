# Phase 6 UI Feature Implementation - Decomposition Plan

**Feature**: Channel Search Component + Settings Integration
**Complexity**: S (Small)
**Estimated Duration**: 4-6 hours
**Date**: 2025-12-26

## Overview

Implement three small UI enhancements to the messaging interface:
1. Channel search component with real-time search
2. Integration of search into sidebar
3. Channel settings trigger in header dropdown

## Prerequisites

- [x] Convex backend structure in place
- [x] `ChannelSettingsDialog` component exists
- [x] Messaging sidebar and header components exist
- [ ] `api.channels.search` Convex query exists (TO VERIFY in T001)

## Dependencies Analysis

### External Dependencies
- React 19 features (hooks, transitions)
- Next.js 15 App Router (navigation)
- Convex real-time queries
- shadcn/ui components (Input, DropdownMenu, etc.)
- lucide-react icons

### Internal Dependencies
- Existing messaging sidebar structure
- Existing channel header dropdown
- `ChannelSettingsDialog` component
- User permission/role system

## Architectural Decisions

### 1. Component Placement
- **ChannelSearch**: New standalone component in `src/components/messaging/`
- **Sidebar Integration**: Modify existing `messaging-sidebar.tsx`
- **Header Integration**: Modify existing `channel-header.tsx`

### 2. State Management
- Local component state for search input
- Convex real-time query for search results
- Dialog open/close state via React.useState
- Debouncing via custom hook or inline setTimeout

### 3. Performance Considerations
- Debounce search input (300ms)
- Skip Convex query if < 2 characters (security + performance)
- Use Convex real-time subscriptions (already built-in)

### 4. Security Considerations
- Minimum 2 characters before searching (prevents excessive queries)
- Backend query already handles permission checks
- Settings dialog only shown to admins/owners/moderators

---

# Task Breakdown

## Phase 1: Backend Verification & Preparation

### T001 [P] Verify backend search query exists
**File**: `convex/channels.ts`
**Agent**: `backend-engineer`
**Complexity**: XS
**Duration**: 15 minutes
**Depends on**: —

**Description**:
Verify that `api.channels.search` query exists in Convex backend. If not, this task escalates to orchestrator.

**Acceptance Criteria**:
- [ ] Query `api.channels.search` exists
- [ ] Query accepts `{ query: string, limit?: number }` parameters
- [ ] Query returns array of channels with name, type, memberCount
- [ ] Query respects 2-character minimum
- [ ] Query handles permissions correctly (only returns channels user can access)

**If Query Does NOT Exist**:
- STOP and escalate to orchestrator
- Backend implementation must be completed first
- This plan assumes query exists

**Output**: Verification report with query signature

---

## Phase 2: Channel Search Component

### T002 Create ChannelSearch component skeleton
**File**: `src/components/messaging/channel-search.tsx`
**Agent**: `frontend-engineer`
**Complexity**: S
**Duration**: 45 minutes
**Depends on**: T001 (must verify query exists first)

**Context7 Documentation (Pre-Validated by Orchestrator)**:

| Technology | Library ID | Reputation | Suggested Topics |
|------------|-----------|------------|------------------|
| React | /facebook/react | ✅ High | useState, useCallback, useEffect |
| Next.js | /vercel/next.js | ✅ High | useRouter, navigation |
| Convex | /get-convex/convex | ✅ High | useQuery, real-time |

**Description**:
Create the `ChannelSearch` component with:
- Search input with magnifying glass icon
- Debounced input (300ms)
- Minimum 2 characters validation
- Three states: idle, loading, results
- Empty state "No channels found"
- Results dropdown with keyboard navigation
- Click handler to navigate to channel

**Implementation Steps**:
1. Create new file with "use client" directive
2. Set up state: `searchQuery`, `debouncedQuery`
3. Implement debounce logic with useEffect + setTimeout
4. Add Convex `useQuery` with conditional skip (< 2 chars)
5. Create Input component with Search icon
6. Add Clear button (X icon) when input has value
7. Implement results dropdown structure

**Acceptance Criteria**:
- [ ] Component renders without errors
- [ ] TypeScript compiles with no errors
- [ ] Search input visible and functional
- [ ] Debounce works (300ms delay)
- [ ] Query skipped if < 2 characters
- [ ] Component matches existing messaging UI style

**Code Pattern** (follow NewDMDialog pattern):
```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Search, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
// ... more imports

interface ChannelSearchProps {
  className?: string;
}

export function ChannelSearch({ className }: ChannelSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const router = useRouter();

  // Debounce logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Convex query (skip if < 2 chars)
  const searchResults = useQuery(
    api.channels.search,
    debouncedQuery.trim().length >= 2
      ? { query: debouncedQuery.trim(), limit: 10 }
      : "skip"
  );

  // ... rest of implementation
}
```

**Reference Files**:
- `src/components/messaging/messaging-sidebar.tsx` lines 56-191 (NewDMDialog pattern)
- `src/components/ui/input.tsx` (Input component)

---

### T003 Add keyboard navigation to ChannelSearch
**File**: `src/components/messaging/channel-search.tsx`
**Agent**: `frontend-engineer`
**Complexity**: S
**Duration**: 30 minutes
**Depends on**: T002

**Context7 Documentation (Pre-Validated by Orchestrator)**:

| Technology | Library ID | Reputation | Suggested Topics |
|------------|-----------|------------|------------------|
| React | /facebook/react | ✅ High | useRef, keyboard events |
| Radix UI | /radix-ui/primitives | ✅ High | focus management |

**Description**:
Add keyboard navigation to search results:
- Arrow Up/Down to navigate results
- Enter to select highlighted result
- Escape to close dropdown
- Focus management for accessibility

**Implementation Steps**:
1. Add `selectedIndex` state
2. Add `useRef` for result items
3. Implement `onKeyDown` handler for arrow keys
4. Implement Enter key to navigate to selected channel
5. Implement Escape to clear search
6. Add visual highlight for selected item
7. Add ARIA attributes for screen readers

**Acceptance Criteria**:
- [ ] Arrow keys navigate through results
- [ ] Enter key selects highlighted channel
- [ ] Escape key clears search
- [ ] Visual feedback on selected item
- [ ] Focus returns to input after selection
- [ ] ARIA attributes present (aria-activedescendant, role="listbox")

**Skills to Consult**:
- `.claude/skills/ui-components/SKILL.md` (keyboard navigation patterns)
- `.claude/skills/ui-components/references/accessibility.md`

---

### T004 Add loading and empty states to ChannelSearch
**File**: `src/components/messaging/channel-search.tsx`
**Agent**: `frontend-engineer`
**Complexity**: XS
**Duration**: 20 minutes
**Depends on**: T002

**Description**:
Add proper loading and empty states to the search component.

**Implementation Steps**:
1. Add loading state: Spinner when `searchResults === undefined`
2. Add idle state: "Type at least 2 characters" prompt
3. Add empty state: "No channels found" with query text
4. Use existing Skeleton/Loader2 components
5. Match styling from NewDMDialog

**Acceptance Criteria**:
- [ ] Idle state shows before 2 characters typed
- [ ] Loading spinner shows while query executes
- [ ] Empty state shows when no results
- [ ] All states have proper semantic HTML
- [ ] Styling matches existing messaging UI

**Reference**:
- `src/components/messaging/messaging-sidebar.tsx` lines 126-142 (state patterns)

---

## Phase 3: Sidebar Integration

### T005 Integrate ChannelSearch into MessagingSidebar
**File**: `src/components/messaging/messaging-sidebar.tsx`
**Agent**: `frontend-engineer`
**Complexity**: XS
**Duration**: 15 minutes
**Depends on**: T002, T003, T004

**Description**:
Add the ChannelSearch component to the top of the messaging sidebar, below QuickNavigation and above Favorites section.

**Implementation Steps**:
1. Import `ChannelSearch` component
2. Add `<ChannelSearch />` after `<QuickNavigation />` (line 493)
3. Add spacing divider if needed
4. Test responsive behavior
5. Verify scroll behavior with ScrollArea

**Acceptance Criteria**:
- [ ] Search bar visible at top of sidebar
- [ ] Positioned below QuickNavigation
- [ ] Positioned above Favorites section
- [ ] No layout shift when search expands
- [ ] Scroll behavior works correctly
- [ ] Component takes full width of sidebar

**Code Change**:
```tsx
// In MessagingSidebar component, around line 493
<div className="py-2">
  {/* Quick Navigation - always visible */}
  <QuickNavigation className="mb-2" />

  {/* Channel Search */}
  <div className="px-2 mb-2">
    <ChannelSearch />
  </div>

  <div className="my-2 border-t" />

  {/* Favorites Section */}
  <CollapsibleSection id="favorites" title="Favorites" defaultOpen>
```

---

## Phase 4: Channel Header Settings Integration

### T006 Add "Channel settings" menu item to channel header dropdown
**File**: `src/components/messaging/channel-header.tsx`
**Agent**: `frontend-engineer`
**Complexity**: S
**Duration**: 30 minutes
**Depends on**: —

**Context7 Documentation (Pre-Validated by Orchestrator)**:

| Technology | Library ID | Reputation | Suggested Topics |
|------------|-----------|------------|------------------|
| shadcn/ui | /shadcn-ui/ui | ✅ High | dropdown-menu |

**Description**:
Add "Channel settings" menu item to the existing dropdown in channel header. Only show for users with admin/owner/moderator roles.

**Implementation Steps**:
1. Add state `const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)`
2. Import `ChannelSettingsDialog` component
3. Check user permissions (same pattern as canArchive)
4. Add new `DropdownMenuItem` after "Mute channel" (line 284)
5. Add separator before settings item
6. Add click handler to open dialog
7. Render `<ChannelSettingsDialog />` at bottom of component

**Acceptance Criteria**:
- [ ] "Channel settings" item visible in dropdown
- [ ] Only shown to admins/owners/moderators
- [ ] Settings icon (gear) displayed
- [ ] Click opens ChannelSettingsDialog
- [ ] Dialog receives correct channelId
- [ ] Dialog close handler works correctly
- [ ] No TypeScript errors

**Code Pattern**:
```tsx
// Add to imports
import { ChannelSettingsDialog } from "./channel-settings-dialog";

// Add state (around line 90)
const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

// Check permissions (around line 105)
const canManageSettings =
  channel?.membership?.role === "owner" ||
  channel?.membership?.role === "admin" ||
  channel?.membership?.role === "moderator" ||
  currentUser?.role === "admin";

// Add menu item (around line 285, after "Mute channel")
{canManageSettings && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => setIsSettingsDialogOpen(true)}>
      <Settings className="mr-2 size-4" aria-hidden="true" />
      Channel settings
    </DropdownMenuItem>
  </>
)}

// Add dialog at end (around line 346, after ChannelMembersDialog)
<ChannelSettingsDialog
  channelId={channel._id}
  open={isSettingsDialogOpen}
  onOpenChange={setIsSettingsDialogOpen}
/>
```

**Reference**:
- `src/components/messaging/channel-header.tsx` lines 262-298 (existing dropdown)
- `src/components/messaging/channel-header.tsx` lines 340-346 (dialog pattern)

---

## Phase 5: Testing & Quality Assurance

### T007 [P] Manual testing - Channel search functionality
**Agent**: `frontend-engineer`
**Complexity**: XS
**Duration**: 20 minutes
**Depends on**: T002, T003, T004, T005

**Description**:
Manually test the channel search feature end-to-end.

**Test Checklist**:
- [ ] Search bar visible in sidebar
- [ ] Typing 1 character shows "Type at least 2 characters"
- [ ] Typing 2+ characters triggers search
- [ ] Loading state appears while searching
- [ ] Results appear in dropdown
- [ ] Clicking result navigates to channel
- [ ] Keyboard navigation works (arrows, Enter)
- [ ] Empty state shows for no results
- [ ] Clear button (X) clears search
- [ ] Debounce works (no queries until 300ms pause)

**Output**: Test report with pass/fail for each item

---

### T008 [P] Manual testing - Settings dialog integration
**Agent**: `frontend-engineer`
**Complexity**: XS
**Duration**: 15 minutes
**Depends on**: T006

**Description**:
Manually test the channel settings integration in header.

**Test Checklist**:
- [ ] Settings item visible in dropdown for admins
- [ ] Settings item NOT visible for regular members
- [ ] Clicking settings opens dialog
- [ ] Dialog shows correct channel data
- [ ] Dialog close button works
- [ ] Dialog backdrop click closes it
- [ ] No console errors or warnings

**Output**: Test report with pass/fail for each item

---

### T009 TypeScript and build verification
**Agent**: `frontend-engineer`
**Complexity**: XS
**Duration**: 10 minutes
**Depends on**: T005, T006

**Description**:
Run TypeScript and build checks to ensure no errors.

**Commands**:
```bash
pnpm typecheck
pnpm lint
pnpm build
```

**Acceptance Criteria**:
- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm build` succeeds
- [ ] No console warnings in dev mode

**If Failures**:
- Fix all TypeScript errors
- Fix all ESLint errors
- Verify all imports are correct
- Re-run until all pass

---

## Phase 6: Documentation & Completion

### T010 Update component documentation
**Agent**: `frontend-engineer`
**Complexity**: XS
**Duration**: 15 minutes
**Depends on**: T009

**Description**:
Add JSDoc comments to the new ChannelSearch component.

**Documentation to Add**:
1. Component-level JSDoc with description
2. Props interface documentation
3. Usage example in JSDoc
4. Internal function documentation if complex

**Acceptance Criteria**:
- [ ] ChannelSearch has JSDoc comment
- [ ] Props interface documented
- [ ] Usage example provided
- [ ] Pattern matches existing components

**Example**:
```tsx
/**
 * ChannelSearch provides real-time search for channels.
 *
 * Features:
 * - Debounced input (300ms)
 * - Minimum 2 characters before searching
 * - Keyboard navigation (arrows, Enter)
 * - Loading and empty states
 *
 * @example
 * ```tsx
 * <ChannelSearch className="w-full" />
 * ```
 */
export function ChannelSearch({ className }: ChannelSearchProps) {
  // ...
}
```

---

# Summary

## Task Dependencies Graph

```
T001 (Verify backend)
  │
  ├─→ T002 (Create component)
  │     ├─→ T003 (Keyboard nav)
  │     └─→ T004 (States)
  │           └─→ T005 (Sidebar integration)
  │                 └─→ T007 [P] (Manual test search)
  │
  └─→ T006 (Header integration)
        └─→ T008 [P] (Manual test settings)

T007 + T008 → T009 (TypeScript/build)
                └─→ T010 (Documentation)
```

## Task Summary Table

| ID | Task | Agent | Complexity | Duration | Parallel |
|----|------|-------|------------|----------|----------|
| T001 | Verify backend search query | backend-engineer | XS | 15 min | ✓ |
| T002 | Create ChannelSearch skeleton | frontend-engineer | S | 45 min | ✗ |
| T003 | Add keyboard navigation | frontend-engineer | S | 30 min | ✗ |
| T004 | Add loading/empty states | frontend-engineer | XS | 20 min | ✗ |
| T005 | Integrate into sidebar | frontend-engineer | XS | 15 min | ✗ |
| T006 | Add settings to header | frontend-engineer | S | 30 min | ✓ |
| T007 | Manual test search | frontend-engineer | XS | 20 min | ✓ |
| T008 | Manual test settings | frontend-engineer | XS | 15 min | ✓ |
| T009 | TypeScript/build check | frontend-engineer | XS | 10 min | ✗ |
| T010 | Update documentation | frontend-engineer | XS | 15 min | ✗ |

**Total Estimated Time**: 3.5 - 4 hours

## Critical Path

T001 → T002 → T003 → T004 → T005 → T007 → T009 → T010

## Quality Gates

- [ ] All TypeScript compilation passes
- [ ] ESLint passes with no warnings
- [ ] Build succeeds
- [ ] Search bar visible in sidebar
- [ ] Search returns results after 2+ characters
- [ ] Keyboard navigation functional
- [ ] Settings accessible via channel header
- [ ] Settings dialog opens with correct data
- [ ] No console errors
- [ ] Manual testing complete

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `api.channels.search` doesn't exist | HIGH | T001 verifies first; escalate if missing |
| Dropdown positioning issues | MEDIUM | Use existing ScrollArea pattern from sidebar |
| Keyboard nav accessibility | MEDIUM | Follow Radix UI patterns; consult skills |
| Layout shift when search expands | LOW | Test in T007; adjust CSS if needed |

## Skill References

All tasks should reference:
- `.claude/skills/react-nextjs/SKILL.md` (React patterns)
- `.claude/skills/ui-components/SKILL.md` (shadcn/ui components)
- `.claude/skills/convex/SKILL.md` (Convex queries)
- `.claude/skills/typescript/SKILL.md` (TypeScript patterns)

## Success Criteria

Feature is complete when:
1. ✅ Users can search for channels from sidebar
2. ✅ Search is debounced and performant
3. ✅ Keyboard navigation works
4. ✅ Channel settings accessible from header for admins
5. ✅ All quality gates pass
6. ✅ No regression in existing functionality
