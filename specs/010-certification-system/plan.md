# Implementation Plan: BDR Certification System

**Branch**: `010-certification-system` | **Date**: 2026-01-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-certification-system/spec.md`

## Summary

Build a progressive certification system for BDRs that tracks advancement through four levels (Bronze → Silver → Gold → Platinum), gates persona access based on demonstrated competency, awards achievement badges, and synchronizes progress with the existing LMS via REST API. The system uses Convex for real-time state management with server-side cooldown enforcement, idempotent LMS sync via a queue pattern, and role-based admin controls for Team Leads and System Admins.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**:
- Next.js 15.x (App Router)
- React 19.x
- Convex (EU region) - database, real-time subscriptions, actions
- Clerk 6.x - authentication, role-based access

**Storage**: Convex (6 new tables: certificationLevels, bdrCertifications, badges, bdrBadges, cooldownResets, lmsSyncQueue)
**Testing**: Vitest + convex-test (unit/integration), Playwright (E2E)
**Target Platform**: Web application (Next.js deployed to Vercel)
**Project Type**: Web application (Next.js frontend + Convex backend)
**Performance Goals**:
- LMS sync <5s latency (SC-002)
- Evaluation flow <20min average (SC-006)
- Dashboard load <30s for team view (SC-005)

**Constraints**:
- Server-side cooldown enforcement (no client bypass)
- Idempotent LMS sync with retry
- Atomic certification level changes
- Immutable audit logs

**Scale/Scope**: 100-500 BDRs, teams of 5-20 members, ~50 concurrent evaluations, ~1000 badge awards/month

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| I: Code Quality | strict: true, no any, explicit returns | PASS | Standard Convex patterns |
| II: Testing | 80% unit, convex-test for functions | PASS | Will create tests for all mutations/queries |
| III: User Experience | Skeleton loading, toast errors | PASS | Progress dashboard with loading states |
| IV: Accessibility | WCAG 2.1 AA, keyboard nav | PASS | Badge notifications accessible |
| V: Security | requireAuth on first line, RBAC | PASS | Team Lead + Admin roles for cooldown reset |
| VI: Performance | Indexes, no filter scans | PASS | Indexes defined for all query patterns |
| IX: Tech Stack | Locked technologies | PASS | Using approved stack only |
| XI: Convex Patterns | withIndex, timestamps | PASS | All queries use indexes |
| XIV: AI Services | N/A for this feature | N/A | No AI/LLM operations |
| XIV: Multilingual | 5 languages | PASS | Certification names, badge text localized |

**Constitution Gate: PASSED** - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/010-certification-system/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
│   └── certification-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Backend (Convex)
convex/
├── schema.ts                    # Add 6 new tables
├── certifications.ts            # Certification queries/mutations
├── badges.ts                    # Badge queries/mutations
├── evaluations.ts               # Evaluation management
├── lmsSync.ts                   # LMS synchronization actions
├── cooldowns.ts                 # Cooldown management
└── lib/
    └── certificationRules.ts    # Business rule helpers

# Frontend (Next.js)
src/
├── app/(dashboard)/
│   ├── certification/
│   │   ├── page.tsx             # BDR certification dashboard
│   │   └── components/
│   │       ├── progress-card.tsx
│   │       ├── level-badge.tsx
│   │       ├── persona-grid.tsx
│   │       └── evaluation-start.tsx
│   ├── badges/
│   │   └── page.tsx             # Badge collection page
│   └── admin/
│       └── team-certifications/
│           └── page.tsx         # Team Lead dashboard
├── components/
│   └── certification/
│       ├── badge-notification.tsx
│       ├── cooldown-timer.tsx
│       └── certification-level-indicator.tsx
└── hooks/
    ├── useCertification.ts
    ├── useBadges.ts
    └── useTeamCertifications.ts

# Tests
tests/
├── unit/
│   └── convex/
│       ├── certifications.test.ts
│       ├── badges.test.ts
│       ├── evaluations.test.ts
│       └── lmsSync.test.ts
└── e2e/
    ├── certification-progress.spec.ts
    └── badge-award.spec.ts
```

**Structure Decision**: Web application following existing BDR LMS patterns. New Convex files for certification domain, new Next.js pages under (dashboard) route group, shared components in src/components/certification/.

## Complexity Tracking

> No constitution violations - complexity tracking not required.

## Dependencies Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    External Dependencies                         │
├─────────────────────────────────────────────────────────────────┤
│  Spec 004 (Sessions)        Spec 009 (Scoring)                  │
│  ├── trainingSessions       ├── sessionScores                   │
│  ├── personas               └── scoringJobs                     │
│  └── scenarios                                                   │
├─────────────────────────────────────────────────────────────────┤
│                    This Feature (010)                            │
├─────────────────────────────────────────────────────────────────┤
│  certificationLevels  ←────┐                                    │
│  bdrCertifications    ─────┼── Core certification state         │
│  badges               ←────┘                                    │
│  bdrBadges            ─────── User badge awards                 │
│  cooldownResets       ─────── Audit trail                       │
│  lmsSyncQueue         ─────── Async LMS integration             │
├─────────────────────────────────────────────────────────────────┤
│                    External Integration                          │
├─────────────────────────────────────────────────────────────────┤
│  LMS REST API                                                    │
│  ├── POST /api/lms/progress        (session_completed)          │
│  ├── POST /api/lms/certifications  (certification_earned)       │
│  └── POST /api/lms/badges          (badge_awarded)              │
└─────────────────────────────────────────────────────────────────┘
```

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| LMS API unavailable | High | Medium | Queue with retry, graceful degradation UI |
| Scoring service delay | Medium | Low | Deferred certification update, user notification |
| Cooldown bypass attempts | High | Low | Server-side enforcement only, no client trust |
| Badge criteria complexity | Medium | Medium | Modular evaluator pattern, extensive tests |
| Concurrent evaluation race | Medium | Low | Convex transactions, optimistic locking |

## Next Steps

After Phase 0-1 planning completes:
1. Run `/speckit.tasks` to generate implementation tasks
2. Execute tasks in priority order (P1 → P2 → P3)
3. Code review with `code-reviewer` and `security-auditor` agents
