# Implementation Plan: Adaptive Behavior Modules (M1 & M3)

**Branch**: `006-adaptive-behavior` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-adaptive-behavior/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build two core adaptive modules for the AI Sales Trainer:
- **M1 (Adaptive Difficulty Engine)**: Implements Vygotsky's Zone of Proximal Development (ZPD) by dynamically adjusting prospect difficulty based on real-time BDR performance across 7 weighted metrics
- **M3 (Emotional State Machine)**: Manages 6 emotional states with action-weighted probabilistic transitions, affecting voice tone and conversation behavior

These modules integrate with Spec 005's Context Builder V7 and Cartesia TTS to create realistic, personalized training experiences.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Convex (real-time serverless), integration with Spec 005 Voice Pipeline (Context Builder V7, Cartesia TTS)
**Storage**: Convex (EU region) - extends existing trainingSessions schema
**Testing**: Vitest + convex-test for backend, React Testing Library for overlay components
**Target Platform**: Web application (Next.js 15 + React 19)
**Project Type**: Web application extending existing LMS platform
**Performance Goals**: <10ms overhead per turn for M1/M3 calculations (FR-016)
**Constraints**: 60-second difficulty adjustment cooldown, max 2 state transitions/minute
**Scale/Scope**: Real-time processing during AI training sessions, supports 5 languages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| I (Code Quality) | TypeScript strict, no `any` | ✅ PASS | All types will be explicit |
| I (Code Quality) | Explicit return types | ✅ PASS | All functions typed |
| II (Testing) | 80% coverage, convex-test | ✅ PASS | Will test all state machines |
| III (UX) | Loading states, error handling | ✅ PASS | Overlay has loading skeleton |
| V (Security) | requireAuth first line | ✅ PASS | All Convex functions protected |
| VI (Performance) | <10ms overhead | ✅ PASS | Core requirement from FR-016 |
| IX (Tech Stack) | Locked technologies | ✅ PASS | No new dependencies |
| XI (Convex) | withIndex, returns validator | ✅ PASS | All queries indexed |
| XIV (AI Services) | EU data sovereignty | ✅ PASS | Convex EU region |

## Project Structure

### Documentation (this feature)

```text
specs/006-adaptive-behavior/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── difficulty-engine.ts
│   ├── emotional-state-machine.ts
│   └── performance-overlay.ts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# Backend (Convex)
convex/
├── schema.ts                        # Extend with M1/M3 event tables
├── lib/
│   ├── m1-difficulty-engine.ts      # M1 calculation logic (internal)
│   └── m3-emotional-state.ts        # M3 state machine logic (internal)
├── training/
│   ├── difficulty.ts                # M1 queries/mutations
│   └── emotional-state.ts           # M3 queries/mutations
└── actions/
    └── session-context.ts           # Integration with Context Builder

# Frontend
src/
├── components/
│   └── ai-trainer/
│       ├── performance-overlay.tsx  # Optional HUD component
│       └── difficulty-indicator.tsx # Visual difficulty display
├── hooks/
│   └── ai-trainer/
│       ├── use-difficulty-state.ts  # Subscribe to M1 state
│       └── use-emotional-state.ts   # Subscribe to M3 state
└── lib/
    └── ai-trainer/
        └── metrics-calculator.ts    # Client-side metric helpers

# Tests
tests/
├── unit/
│   └── convex/
│       ├── m1-difficulty-engine.test.ts
│       └── m3-emotional-state.test.ts
└── integration/
    └── ai-trainer/
        └── adaptive-behavior.test.ts
```

**Structure Decision**: Extends existing AI Sales Trainer architecture from Spec 004/005. Backend logic in Convex with pure internal functions for testability. Frontend provides optional performance overlay for free practice mode.

## Complexity Tracking

> No constitution violations requiring justification. All requirements fit within existing patterns.

| Potential Complexity | Mitigation |
|---------------------|------------|
| Real-time metric calculation | Use Convex internal functions, benchmark to ensure <10ms |
| State machine transitions | Pure functions with comprehensive unit tests |
| Integration with Context Builder | Extends existing types from Spec 005 |
