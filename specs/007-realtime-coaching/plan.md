# Implementation Plan: Real-Time Coaching Modules (M2, M4, M6)

**Branch**: `007-realtime-coaching` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-realtime-coaching/spec.md`

## Summary

This feature implements three real-time coaching modules for the AI Sales Trainer:
- **M2 (Coaching Whispers)**: 15 contextual micro-advice rules with i18n support, priority system (RACC > Normal > Positive), and cooldown management
- **M4 (Scenario Branching)**: Dynamic conversation paths where BDR actions have consequences, plus post-session What-If replay
- **M6 (Voice Sentiment)**: Client-side Web Audio API analysis for pace, confidence, energy, and hesitation feedback

The implementation extends existing session infrastructure (Spec 004/006) and integrates with the voice pipeline (Spec 005) to provide real-time guidance without breaking conversation immersion.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 15, React 19, Convex, Web Audio API, Framer Motion
**Storage**: Convex (EU region) - 6 new tables + session extensions
**Testing**: Vitest + convex-test (unit/integration), Playwright (E2E)
**Target Platform**: Modern browsers with Web Audio API support
**Project Type**: Web application (Next.js App Router + Convex backend)
**Performance Goals**:
- Whisper evaluation: <100ms per trigger check (FR-010)
- Whisper display: <200ms from trigger (SC-001)
- Branch logging: <100ms (SC-006)
- Voice updates: Every 5s with 95% reliability (SC-007)
- CPU usage: <5% for voice analysis (SC-003)

**Constraints**:
- No raw audio data transmission (FR-025) - only numeric metrics
- Whispers disabled in evaluation mode (FR-005)
- Max 4 whispers per 60 seconds (FR-002)
- Max 5 branch decisions per session (FR-012)
- Max 3 What-If explorations per session (FR-020)

**Scale/Scope**: ~10,000 training sessions/month, 15 whisper rules × 5 languages, ~600MB/month additional storage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Article I: Code Quality ✅
- [x] TypeScript strict mode enforced
- [x] No `any` types - using proper validators and interfaces
- [x] Explicit return types on all exported functions in contracts

### Article II: Testing Standards ✅
- [x] Unit tests planned for whisper evaluation, branch detection, voice analysis
- [x] Integration tests for Convex functions (convex-test)
- [x] E2E tests for whisper display, voice indicator visibility

### Article III: User Experience ✅
- [x] Loading states: Whisper overlay uses AnimatePresence
- [x] Error handling: Graceful degradation when dependencies unavailable (FR-010a)
- [x] Optimistic updates: Whisper state managed client-side

### Article IV: Accessibility ✅
- [x] Whisper overlay uses semantic HTML with ARIA attributes
- [x] Pace indicator accessible to screen readers
- [x] Voice feedback optional (handles permission denial)

### Article V: Security ✅
- [x] All mutations use `requireAuth()` first line
- [x] No raw audio leaves browser (privacy by design)
- [x] Input validation with Zod validators

### Article VI: Performance ✅
- [x] Targets defined: 200ms whisper latency, 100ms branch logging, <5% CPU
- [x] Indexes defined for all query patterns
- [x] Client-side voice analysis to avoid network latency

### Article XI: Convex Patterns ✅
- [x] Returns validators defined for all functions
- [x] Indexes used: by_session, by_rule, by_branch_type, etc.
- [x] Timestamps use `Date.now()` (milliseconds)

### Article XIV: AI & External Services ✅
- [x] What-If generation uses Claude 3.5 Haiku (fast, cost-effective)
- [x] Temperature 0.3 for persona consistency
- [x] All 5 languages supported (fr, en, it, de, es)

## Project Structure

### Documentation (this feature)

```text
specs/007-realtime-coaching/
├── plan.md              # This file
├── research.md          # Dependencies on Spec 004/005/006
├── data-model.md        # 6 new tables + session extensions
├── quickstart.md        # Implementation guide
├── contracts/
│   ├── whisper-engine.ts    # M2 types, constants, pure functions
│   ├── scenario-branching.ts # M4 branch detection
│   ├── what-if-replay.ts     # M4 What-If exploration
│   └── voice-sentiment.ts    # M6 voice analysis
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
convex/
├── coaching/
│   ├── whispers.ts          # Whisper evaluation & recording
│   ├── branching.ts         # Branch detection & logging
│   ├── what-if.ts           # What-If replay generation
│   └── voice.ts             # Voice metrics storage & summary
└── schema.ts                # Extended with 6 new tables

src/
├── app/
│   └── (dashboard)/
│       └── training/
│           └── [sessionId]/
│               └── page.tsx     # Integrates whisper overlay
├── components/
│   └── coaching/
│       ├── whisper-overlay.tsx      # Floating whisper display
│       ├── pace-indicator.tsx       # Real-time pace feedback
│       ├── branch-summary.tsx       # Post-session branch review
│       └── what-if-explorer.tsx     # What-If replay UI
├── hooks/
│   └── coaching/
│       ├── use-whispers.ts          # Whisper state & evaluation
│       ├── use-voice-analysis.ts    # Web Audio API integration
│       ├── use-branch-history.ts    # Session branch state
│       └── use-what-if.ts           # What-If exploration state
└── lib/
    └── coaching/
        └── voice-analyzer.ts        # Client-side audio analysis

tests/
├── unit/
│   └── convex/
│       └── coaching/
│           ├── whispers.test.ts
│           ├── branching.test.ts
│           └── voice.test.ts
├── integration/
│   └── coaching/
│       └── whisper-flow.test.ts
└── e2e/
    └── training/
        └── coaching-modules.spec.ts
```

**Structure Decision**: Using existing Next.js + Convex web application structure with new `coaching/` directories in `convex/`, `src/components/`, `src/hooks/`, and `tests/`.

## Complexity Tracking

> No violations - design follows constitution patterns.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Client-side voice analysis | Web Audio API only | Privacy requirement (FR-025), performance (<5% CPU) |
| 6 new tables | Normalized event storage | Enables analytics, observability, retention per requirements |
| What-If AI generation | Convex Action + Claude | Maintains persona consistency (SC-004: 85%), low temp 0.3 |

## Artifacts Generated

| Artifact | Path | Status |
|----------|------|--------|
| Data Model | `specs/007-realtime-coaching/data-model.md` | ✅ Complete |
| Whisper Contract | `specs/007-realtime-coaching/contracts/whisper-engine.ts` | ✅ Complete |
| Branching Contract | `specs/007-realtime-coaching/contracts/scenario-branching.ts` | ✅ Complete |
| What-If Contract | `specs/007-realtime-coaching/contracts/what-if-replay.ts` | ✅ Complete |
| Voice Contract | `specs/007-realtime-coaching/contracts/voice-sentiment.ts` | ✅ Complete |
| Quickstart Guide | `specs/007-realtime-coaching/quickstart.md` | ✅ Complete |

## Next Steps

Run `/speckit.tasks` to generate the implementation task list with:
- Schema updates (priority 1)
- Backend Convex functions (priority 2)
- Frontend components and hooks (priority 3)
- Test coverage (priority 4)
- Integration with Spec 005/006 (priority 5)
