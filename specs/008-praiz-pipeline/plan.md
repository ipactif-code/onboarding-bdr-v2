# Implementation Plan: Praiz Video Processing Pipeline

**Branch**: `008-praiz-pipeline` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-praiz-pipeline/spec.md`

## Summary

This feature implements a batch processing pipeline for Praiz video recordings (DiliTrust's call recording platform) to extract actionable sales intelligence. The pipeline analyzes real sales calls to build an Objection Library with RACC-structured responses that enrich AI training personas.

**Core Capabilities**:
- Batch processing of Praiz videos with configurable rate limits (50/hour, $500/month budget)
- AI-powered pattern extraction using Claude Sonnet for quality extraction
- Objection Library management with confidence-based auto-validation workflow
- Integration with Context Builder (Spec 005) to inject patterns into AI conversations
- GDPR-compliant anonymization and 12-month log retention

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 15, React 19, Convex, Claude Sonnet API, Praiz API
**Storage**: Convex (EU region) - 4 new tables + 2 log tables
**Testing**: Vitest + convex-test (unit/integration), Playwright (E2E)
**Target Platform**: Web application (Next.js App Router + Convex backend)
**Project Type**: Web application extending existing BDR LMS platform

**Performance Goals**:
- Pattern extraction: < 5 minutes per video (SC-005)
- Batch throughput: 50 videos/hour without errors (SC-006)
- New objections available: < 24 hours after validation (SC-007)
- Extraction accuracy: > 80% validated as accurate (SC-001)
- Cost target: < $0.50/video average (SC-002)

**Constraints**:
- Monthly budget: $500 (~1,000 videos at $0.50 each)
- Rate limit: 50 videos/hour max
- Languages: French, English (priority), Italian, Spanish, German (secondary)
- Data retention: Patterns indefinitely with freshness flags; logs 12 months
- EU data sovereignty: All processing in EU regions
- No PII in extracted patterns (FR-017, FR-018)

**Scale/Scope**: ~1,000 videos/month, 100+ validated objections target in 4 weeks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design completion.*

### Article I: Code Quality ✅
- [x] TypeScript strict mode enforced (all contracts use strict types)
- [x] No `any` types - using proper validators and interfaces in all 4 contracts
- [x] Explicit return types on all 35+ exported functions in contracts

### Article II: Testing Standards ✅
- [x] Unit tests planned for extraction logic, validation workflow (tests/unit/convex/praiz/)
- [x] Integration tests for Convex functions via convex-test (processing-flow.test.ts)
- [x] E2E tests for validation queue UI, library browsing (tests/e2e/praiz/)

### Article III: User Experience ✅
- [x] Loading states: Validation queue uses Skeleton components (planned in quickstart.md)
- [x] Error handling: Processing failures logged with toast notifications + error tracking
- [x] Optimistic updates: Validation status changes update immediately via Convex reactivity

### Article IV: Accessibility ✅
- [x] Validation UI uses semantic HTML with ARIA attributes (validation queue, objection cards)
- [x] Keyboard navigation for approve/reject/edit actions (button-based actions)
- [x] Color contrast compliant for status indicators (getStatusVariant in contracts)

### Article V: Security ✅
- [x] All mutations use `requireAuth()` first line (documented in quickstart.md)
- [x] Admin/Manager role check for validation actions via canValidate() (validation.ts:238)
- [x] Input validation with Zod validators (all inputs validated)
- [x] PII anonymization via anonymizeText() before storage (extraction.ts:341-357)

### Article VI: Performance ✅
- [x] Rate limiting: 50 videos/hour enforced (observability.ts:20)
- [x] Budget alerts at 80% utilization (observability.ts:18, shouldSendBudgetAlert)
- [x] Indexes defined for all query patterns (data-model.md index strategy)

### Article VII: Documentation ✅ (Post-Design)
- [x] JSDoc planned on all exported functions (contracts have module docstrings)
- [x] Research decisions documented (research.md - 10 topics)
- [x] Quickstart guide created (quickstart.md - 6 implementation steps)

### Article XI: Convex Patterns ✅
- [x] Returns validators defined for all functions (planned in contracts)
- [x] Indexes used: by_status, by_category, by_module_lang, by_batch, by_video (data-model.md)
- [x] Timestamps use `Date.now()` (milliseconds) - all timestamp fields

### Article XIII: Anti-Hallucination ✅ (Post-Design)
- [x] Existing patterns verified (read convex/schema.ts before data-model design)
- [x] Context7 documentation consulted for Convex patterns
- [x] Project skills referenced (.claude/skills/convex/)

### Article XIV: AI & External Services ✅
- [x] Model selection: Claude Sonnet for extraction (quality matters, extraction.ts:17)
- [x] Cost tracking per video (observability.ts CostMetrics)
- [x] Cost target: <$0.50/video (extraction.ts:23)
- [x] Budget cap: $500/month (observability.ts:16)
- [x] EU data sovereignty: Convex EU region enforced
- [x] RACC framework integrated (objection-library.ts RACC_TEMPLATES)
- [x] 5 languages supported: fr, en, it, de, es (extraction.ts:62)
- [x] AI output validation: validateExtractionResult() validates JSON structure (extraction.ts:323-336)

## Project Structure

### Documentation (this feature)

```text
specs/008-praiz-pipeline/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── extraction.ts        # Pattern extraction types & validation
│   ├── objection-library.ts # Library management types
│   ├── validation.ts        # Validation workflow types
│   └── observability.ts     # Metrics tracking types
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
convex/
├── praiz/
│   ├── processing.ts        # Batch processing & job management
│   ├── extraction.ts        # AI extraction action (Claude Sonnet)
│   ├── objections.ts        # Objection library CRUD
│   ├── validation.ts        # Validation workflow mutations
│   ├── observability.ts     # Metrics tracking queries
│   └── scheduled.ts         # Cron jobs (freshness, log cleanup)
└── schema.ts                # Extended with 6 new tables

src/
├── app/
│   └── (dashboard)/
│       └── admin/
│           └── praiz/
│               ├── page.tsx              # Dashboard overview
│               ├── processing/
│               │   └── page.tsx          # Batch processing UI
│               ├── validation/
│               │   └── page.tsx          # Validation queue
│               └── library/
│                   ├── page.tsx          # Objection library
│                   └── [id]/
│                       └── page.tsx      # Single objection view/edit
├── components/
│   └── praiz/
│       ├── processing-dashboard.tsx     # Processing stats & controls
│       ├── batch-trigger-form.tsx       # Date range batch trigger
│       ├── validation-queue.tsx         # Pending objections list
│       ├── objection-card.tsx           # Single objection display
│       ├── racc-editor.tsx              # RACC response editor
│       ├── objection-filters.tsx        # Filter by category/lang/module
│       └── metrics-chart.tsx            # Observability metrics
└── hooks/
    └── praiz/
        ├── use-processing-jobs.ts       # Job status subscription
        ├── use-validation-queue.ts      # Pending objections
        ├── use-objection-library.ts     # Library queries
        └── use-praiz-metrics.ts         # Observability data

tests/
├── unit/
│   └── convex/
│       └── praiz/
│           ├── extraction.test.ts       # Extraction logic tests
│           ├── validation.test.ts       # Validation workflow tests
│           └── objections.test.ts       # Library CRUD tests
├── integration/
│   └── praiz/
│       └── processing-flow.test.ts      # End-to-end processing
└── e2e/
    └── praiz/
        └── validation-workflow.spec.ts  # E2E validation UI tests
```

**Structure Decision**: Using existing Next.js + Convex web application structure with new `praiz/` directories in `convex/`, `src/app/(dashboard)/admin/`, `src/components/`, `src/hooks/`, and `tests/`.

## Complexity Tracking

> No violations - design follows constitution patterns.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Claude Sonnet for extraction | External action | Quality matters more than cost for extraction accuracy (SC-001: >80%) |
| 6 new tables | Normalized event storage | Enables analytics, observability, retention per requirements |
| Admin UI in `/admin/praiz/` | Restricted access | Validation limited to admins + sales enablement managers |

## Artifacts Generated

| Artifact | Path | Status |
|----------|------|--------|
| Research | `specs/008-praiz-pipeline/research.md` | ✅ Complete |
| Data Model | `specs/008-praiz-pipeline/data-model.md` | ✅ Complete |
| Extraction Contract | `specs/008-praiz-pipeline/contracts/extraction.ts` | ✅ Complete |
| Objection Library Contract | `specs/008-praiz-pipeline/contracts/objection-library.ts` | ✅ Complete |
| Validation Contract | `specs/008-praiz-pipeline/contracts/validation.ts` | ✅ Complete |
| Observability Contract | `specs/008-praiz-pipeline/contracts/observability.ts` | ✅ Complete |
| Quickstart Guide | `specs/008-praiz-pipeline/quickstart.md` | ✅ Complete |

## Next Steps

1. ~~Phase 0: Generate `research.md` resolving Praiz API integration patterns~~ ✅
2. ~~Phase 1: Generate data model, contracts, and quickstart guide~~ ✅
3. Run `/speckit.tasks` to generate implementation task list
