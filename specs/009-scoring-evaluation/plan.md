# Implementation Plan: BDR Performance Scoring & Evaluation System

**Branch**: `009-scoring-evaluation` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-scoring-evaluation/spec.md`

## Summary

Post-session evaluation system that scores BDR training sessions across 6 dimensions (SPIN 20%, MEDDIC 20%, RACC 20%, BANT 15%, Behavioral 15%, Adaptive 10%) using Claude Sonnet for quality analysis. Delivers scores within 30 seconds, identifies 3-5 key moments, generates multilingual feedback, and supports evaluation mode for certifications with pass/fail/distinction thresholds.

**Technical Approach**: Queue-based async scoring via Convex actions, Claude Sonnet (temperature 0.1) for consistent evaluation, structured JSON output validated with Zod, competitive battlecard integration for RACC scoring.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 15, React 19, Convex (EU region), Claude Sonnet API (via Anthropic SDK)
**Storage**: Convex tables (sessionScores, scoringJobs, certificationRecords)
**Testing**: Vitest + convex-test for backend, React Testing Library for components, Playwright for E2E
**Target Platform**: Web (responsive), Convex EU region
**Project Type**: Web application (Next.js App Router + Convex backend)
**Performance Goals**: 30s P95 scoring latency, 50 concurrent sessions, <$0.10 per session
**Constraints**: 2-year data retention, immutable scores, 5 languages (FR/EN/DE/ES/IT)
**Scale/Scope**: ~50 concurrent scoring jobs, ~1000 sessions/day peak

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| I: TypeScript Strictness | strict: true, no any | ✅ PASS | All types will use Zod inference |
| II: Testing Standards | 80% coverage, convex-test | ✅ PASS | Tests planned for scoring engine + components |
| III: User Experience | Skeleton loading, toast errors | ✅ PASS | Scoring progress indicator + error toasts |
| IV: Accessibility | WCAG 2.1 AA | ✅ PASS | Score display is text-based, keyboard nav |
| V: Security | requireAuth first line, Zod validation | ✅ PASS | All queries/mutations protected |
| VI: Performance | .withIndex(), no .filter() scans | ✅ PASS | Indexes on sessionId, bdrId, teamId |
| XI: Convex Patterns | Auth first, returns validator | ✅ PASS | Following standard patterns |
| XIV: AI & External Services | Budget controls, temp 0.1 for scoring | ✅ PASS | <$0.10/session, Claude Sonnet |

**All gates pass. No violations requiring justification.**

## Project Structure

### Documentation (this feature)

```text
specs/009-scoring-evaluation/
├── plan.md              # This file
├── research.md          # Phase 0: Technology research
├── data-model.md        # Phase 1: Schema design
├── quickstart.md        # Phase 1: Developer guide
├── contracts/           # Phase 1: API contracts
│   ├── scoring.ts       # Scoring engine contracts
│   ├── evaluations.ts   # Evaluation mode contracts
│   └── feedback.ts      # Feedback/trends contracts
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
convex/
├── schema.ts                    # Add sessionScores, scoringJobs, certificationRecords tables
├── scoring/
│   ├── engine.ts                # Main scoring action (Claude integration)
│   ├── jobs.ts                  # Queue management queries/mutations
│   ├── results.ts               # Score retrieval queries
│   └── trends.ts                # Historical comparison queries
├── evaluations/
│   ├── certification.ts         # Pass/fail/distinction logic
│   └── notes.ts                 # Team Lead notes mutations
├── lib/
│   └── scoring-prompts.ts       # Scoring rubric prompts (constants)
└── actions/
    └── claude-scoring.ts        # External Claude API action

src/
├── app/(dashboard)/
│   └── sessions/
│       └── [sessionId]/
│           └── score/
│               └── page.tsx     # Score results page
├── components/
│   └── scoring/
│       ├── score-overview.tsx   # Overall score display
│       ├── dimension-card.tsx   # Expandable dimension scores
│       ├── key-moments.tsx      # Timeline of key moments
│       ├── feedback-summary.tsx # Strengths/improvements
│       ├── trend-chart.tsx      # Historical trend visualization
│       └── evaluation-badge.tsx # Pass/fail/distinction badge
├── hooks/
│   └── scoring/
│       ├── use-session-score.ts # Score query hook
│       └── use-scoring-status.ts# Real-time scoring progress
└── lib/
    └── validators/
        └── scoring.ts           # Zod schemas for scoring output

tests/
├── unit/
│   └── convex/
│       └── scoring/
│           ├── engine.test.ts   # Scoring calculation tests
│           └── jobs.test.ts     # Queue management tests
└── e2e/
    └── scoring.spec.ts          # End-to-end scoring flow
```

**Structure Decision**: Standard Next.js + Convex structure. Scoring logic isolated in `convex/scoring/` domain folder. Claude API calls wrapped in Convex action for security (API key in env vars).

## Complexity Tracking

> No violations requiring justification. All patterns align with constitution.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Queue-based scoring | Convex table as job queue | Simple, no external queue needed, supports retry |
| Single Claude call | One prompt for all dimensions | Cost-effective ($0.06-0.08), within 30s latency |
| Embedded battlecards | Constants in code | Static data, no runtime lookup needed |

## Dependencies from Other Specs

| Spec | Data Needed | Integration Point |
|------|-------------|-------------------|
| 005 (Transcripts) | Session transcript text | `sessionTranscripts.by_session` |
| 006 (M1/M3) | Performance + emotional metrics | `performanceMetrics.by_session`, `emotionalStates.by_session` |
| 008 (Objections) | Objection library for RACC | `objectionLibrary` table (competitive battlecards) |

## Scoring Prompt Strategy

**Single Comprehensive Prompt** (provided in user context):
- French system prompt for evaluation expertise
- Detailed rubric for all 6 dimensions with point ranges
- Structured JSON output format
- Key moments detection with positive/negative categorization
- Evaluation result calculation for certification mode

**Cost Estimate**:
- Input: ~2000 tokens (transcript + rubric)
- Output: ~1500 tokens (structured JSON)
- Claude Sonnet: ~$0.06-0.08 per session
- Within $0.10 target ✅

## Competitive Battlecard Data

Pre-loaded constants for 3 competitors:
1. **Icertis** (CLM) - EU sovereignty differentiation
2. **Diligent** (Board Portal) - Mid-market pricing differentiation
3. **SharePoint** (DIY) - Risk/automation differentiation

Evaluation criteria for competitive mentions:
- +5 acknowledged strengths
- -10 bashed competitor
- +10 differentiated on value
- +5 used case study
- +5 redirected to customer needs
