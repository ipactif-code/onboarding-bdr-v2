# Phase 6 UI Features - Implementation Specification

**Status**: Ready for Execution
**Created**: 2025-12-26
**Complexity**: S (Small)
**Estimated Duration**: 3.5-4 hours

## Overview

This specification covers three small UI enhancements to the messaging interface:

1. **Channel Search Component** - Real-time search for channels in sidebar
2. **Sidebar Integration** - Add search to messaging sidebar
3. **Settings Integration** - Add "Channel settings" trigger to channel header

## Quick Start

### For Orchestrator

```bash
# 1. Verify backend query exists
Delegate T001 to backend-engineer

# 2. If backend ready, execute frontend tasks
Delegate T002-T010 to frontend-engineer (sequential with some parallel)

# 3. Review quality gates
All must pass before marking complete
```

### For Implementation Agents

1. Read `plan.md` for full context and architectural decisions
2. Read `tasks.md` for specific task assignments
3. Consult required skills before implementing:
   - `.claude/skills/react-nextjs/SKILL.md`
   - `.claude/skills/ui-components/SKILL.md`
   - `.claude/skills/convex/SKILL.md`

## Files Modified/Created

### New Files
- `src/components/messaging/channel-search.tsx` (T002)

### Modified Files
- `src/components/messaging/messaging-sidebar.tsx` (T005)
- `src/components/messaging/channel-header.tsx` (T006)

### No Changes Required
- Backend (assuming `api.channels.search` exists)
- Tests (manual testing only for Phase 6)

## Key Decisions

### Architecture
- **Standalone component** for ChannelSearch (reusable)
- **Local state** for search input and debouncing
- **Convex real-time** queries for search results
- **Existing patterns** followed from NewDMDialog

### Performance
- **300ms debounce** to prevent excessive queries
- **2-char minimum** before searching (security + performance)
- **Query skip** when below minimum

### Security
- Backend query handles permission checks
- Settings only shown to admins/owners/moderators
- Input validation in backend (minimum 2 chars)

## Dependencies

### External
- React 19 (hooks)
- Next.js 15 (App Router, navigation)
- Convex (real-time queries)
- shadcn/ui components
- lucide-react icons

### Internal
- `api.channels.search` query (must exist - T001)
- `ChannelSettingsDialog` component (already exists)
- Messaging sidebar structure
- Channel header structure

## Acceptance Criteria

Feature complete when:

- [x] Backend search query verified (T001)
- [ ] ChannelSearch component created (T002-T004)
- [ ] Search integrated into sidebar (T005)
- [ ] Settings trigger added to header (T006)
- [ ] Manual testing passed (T007-T008)
- [ ] TypeScript/build passing (T009)
- [ ] Documentation added (T010)

## Quality Gates

All must pass:

- [ ] `pnpm typecheck` - no errors
- [ ] `pnpm lint` - no errors
- [ ] `pnpm build` - succeeds
- [ ] Search bar visible in sidebar
- [ ] Search results appear after 2+ characters
- [ ] Keyboard navigation (arrows, Enter, Escape)
- [ ] Settings accessible from channel header
- [ ] Settings dialog opens with correct data
- [ ] No console errors or warnings

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Backend query missing | LOW | HIGH | T001 verifies first; escalate if missing |
| Dropdown positioning | LOW | MEDIUM | Follow existing ScrollArea pattern |
| Keyboard accessibility | LOW | MEDIUM | Follow Radix UI patterns |
| Layout shift | LOW | LOW | Test in T007; CSS adjustments |

## Timeline

| Phase | Tasks | Duration | Agent |
|-------|-------|----------|-------|
| Verification | T001 | 15 min | backend-engineer |
| Component | T002-T004 | 95 min | frontend-engineer |
| Integration | T005-T006 | 45 min | frontend-engineer |
| Testing | T007-T009 | 45 min | frontend-engineer |
| Docs | T010 | 15 min | frontend-engineer |
| **TOTAL** | | **3.5 hrs** | |

## Next Steps

1. Orchestrator delegates T001 to backend-engineer
2. If T001 passes, orchestrator delegates T002-T010 to frontend-engineer
3. Frontend-engineer follows tasks.md sequentially
4. All quality gates verified
5. Feature marked complete

## Reference Documents

- `plan.md` - Full decomposition with architectural decisions
- `tasks.md` - Actionable task list with acceptance criteria

## Contact / Escalation

If issues arise:
- **Missing backend query** → Escalate to orchestrator
- **Accessibility concerns** → Consult `.claude/skills/ui-components/references/accessibility.md`
- **Performance issues** → Consult `.claude/skills/performance/SKILL.md`
- **Security concerns** → Escalate to security-auditor
