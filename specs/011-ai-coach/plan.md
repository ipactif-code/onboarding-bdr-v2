# Implementation Plan: AI Coach Module (M7)

**Branch**: `011-ai-coach` | **Date**: 2026-01-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/011-ai-coach/spec.md`

## Summary

Build the AI Coach module that provides personalized post-session coaching for BDRs through four modes: post-session debrief, training plan generator, weekly progress check-in, and on-demand Q&A ("Ask Coach"). Uses Claude 3.5 Haiku for cost-effective conversational AI (<$0.05 per interaction), with streaming responses for perceived <5s latency. Integrates with Spec 004 (Sessions), 009 (Scoring), and 010 (Certification) for context.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 15.x, React 19.x, Convex, Anthropic SDK (Claude 3.5 Haiku)
**Storage**: Convex (EU region) - 4 new tables
**Testing**: Vitest + convex-test, Playwright
**Target Platform**: Web (mobile-responsive)
**Project Type**: Web application (Next.js + Convex)
**Performance Goals**: <5s coach response time (perceived via streaming), <15s for plan generation
**Constraints**: <$0.05/interaction AI cost, 90-day conversation retention, GDPR compliant
**Scale/Scope**: 100-500 BDRs, ~30 coach interactions/user/day max

## Constitution Check

*GATE: All checks pass. Feature complies with BDR LMS Constitution.*

| Article | Requirement | Status |
|---------|-------------|--------|
| I: Code Quality | TypeScript strict, ESLint zero warnings | ✅ Will enforce |
| II: Testing | convex-test for all functions, E2E for flows | ✅ Will implement |
| III: UX | Skeleton loading, toast errors | ✅ Will implement |
| IV: Accessibility | WCAG 2.1 AA, keyboard nav | ✅ Will implement |
| V: Security | requireAuth() first line, Zod validation | ✅ Will enforce |
| VI: Performance | Indexes on all queries | ✅ Schema includes indexes |
| IX: Tech Stack | Next.js 15, React 19, Convex, TypeScript | ✅ Compliant |
| X: Folder Structure | convex/coach/, src/components/coach/ | ✅ Will follow |
| XI: Convex Patterns | Query/mutation patterns, indexes | ✅ Contracts follow patterns |
| XIV: AI Services | Claude Haiku, rate limits, budget | ✅ Research confirms compliance |

## Project Structure

### Documentation (this feature)

```text
specs/011-ai-coach/
├── plan.md              # This file
├── research.md          # Technology decisions (complete)
├── data-model.md        # Entity definitions (complete)
├── quickstart.md        # Implementation guide (complete)
├── spec.md              # Feature specification
├── checklists/
│   └── requirements.md  # Spec validation checklist
└── contracts/
    ├── queries.md       # Query contracts (complete)
    ├── mutations.md     # Mutation contracts (complete)
    ├── actions.md       # AI action contracts (complete)
    └── scheduled.md     # Cron job contracts (complete)
```

### Source Code (repository root)

```text
convex/
├── schema.ts             # Add 4 new tables
├── coach/
│   ├── queries.ts        # 9 queries
│   ├── mutations.ts      # 11 mutations
│   ├── actions.ts        # 3 AI actions
│   ├── scheduled.ts      # 3 scheduled functions
│   └── lib/
│       ├── config.ts     # Cost/limit configuration
│       ├── prompts.ts    # System prompts (5 languages)
│       ├── helpers.ts    # Date utilities, parsing
│       └── types.ts      # Shared types
└── crons.ts              # Add 3 cron jobs

src/
├── app/(dashboard)/
│   └── coach/
│       ├── page.tsx              # Main coach page
│       └── [conversationId]/
│           └── page.tsx          # Conversation detail
├── components/coach/
│   ├── coach-chat.tsx            # Main chat container
│   ├── message-list.tsx          # Message display with streaming
│   ├── message-input.tsx         # User input with limits
│   ├── coach-header.tsx          # Mode indicator & actions
│   ├── transcript-reference.tsx  # Debrief excerpts
│   ├── training-plan-card.tsx    # Plan overview
│   ├── week-progress.tsx         # Plan week progress
│   ├── plan-generation-dialog.tsx # Plan request flow
│   ├── weekly-checkin-banner.tsx # Check-in notification
│   └── coach-fab.tsx             # Floating access button
└── hooks/
    ├── use-coach-conversation.ts # Conversation state
    └── use-coach-streaming.ts    # Streaming response handling

tests/
├── unit/convex/
│   └── coach/
│       ├── queries.test.ts
│       ├── mutations.test.ts
│       └── scheduled.test.ts
└── e2e/
    └── coach/
        ├── debrief.spec.ts
        ├── ask-coach.spec.ts
        └── training-plan.spec.ts
```

## Implementation Phases

### Phase 1: Data Layer (Est: 4-6 hours)

1. Add schema tables to `convex/schema.ts`:
   - `coachConversations` (with 4 indexes)
   - `coachMessages` (with 2 indexes)
   - `trainingPlans` (with 2 indexes)
   - `weeklyCheckins` (with 3 indexes)

2. Create `convex/coach/lib/` helpers:
   - `config.ts` - Configuration constants
   - `types.ts` - Shared TypeScript types
   - `helpers.ts` - Date utilities

### Phase 2: Backend Core (Est: 8-12 hours)

1. Implement queries (`convex/coach/queries.ts`):
   - `getActiveConversation`
   - `getConversationMessages`
   - `getConversationHistory`
   - `getActivePlan`
   - `getPlanHistory`
   - `canGeneratePlan`
   - `getCurrentWeekCheckin`
   - `getCheckinHistory`
   - `getCoachRateLimits`

2. Implement mutations (`convex/coach/mutations.ts`):
   - `startConversation`
   - `sendMessage`
   - `endConversation`
   - `generatePlan`
   - `markCheckinViewed`
   - Internal mutations for AI responses

3. Add convex-test coverage

### Phase 3: AI Integration (Est: 6-8 hours)

1. Create `convex/coach/lib/prompts.ts`:
   - `COACH_PERSONA` (5 languages)
   - `PLAN_GENERATION_SYSTEM_PROMPT`
   - `WEEKLY_CHECKIN_SYSTEM_PROMPT`

2. Implement actions (`convex/coach/actions.ts`):
   - `generateResponse`
   - `generatePlanContent`
   - `generateWeeklyCheckinMessage`

3. Add Anthropic SDK integration with error handling

### Phase 4: Scheduled Functions (Est: 3-4 hours)

1. Implement schedulers (`convex/coach/scheduled.ts`):
   - `triggerWeeklyCheckins` (Monday check-ins)
   - `cleanupExpiredConversations` (90-day retention)
   - `sendExpirationWarnings` (7-day warning)

2. Register crons in `convex/crons.ts`

### Phase 5: Frontend Components (Est: 10-14 hours)

1. Create `src/components/coach/`:
   - `coach-chat.tsx` - Main chat container
   - `message-list.tsx` - Real-time message display
   - `message-input.tsx` - Input with character/message limits
   - `coach-header.tsx` - Mode switching and actions
   - `transcript-reference.tsx` - Debrief transcript excerpts
   - `training-plan-card.tsx` - Plan overview
   - `week-progress.tsx` - Weekly goal tracking
   - `coach-fab.tsx` - Global access button

2. Create `src/app/(dashboard)/coach/`:
   - `page.tsx` - Main coach interface
   - Conversation detail routes

3. Create hooks:
   - `use-coach-conversation.ts`
   - `use-coach-streaming.ts`

### Phase 6: Integration & Polish (Est: 4-6 hours)

1. Add post-session debrief entry point
2. Add weekly check-in notification banner
3. Integrate "Ask Coach" FAB across dashboard
4. Add loading states and error handling
5. Implement rate limit UI feedback

### Phase 7: Testing & QA (Est: 6-8 hours)

1. E2E tests:
   - Debrief conversation flow
   - Ask Coach conversation flow
   - Training plan generation
   - Weekly check-in flow

2. Accessibility audit
3. Performance testing (streaming latency)
4. Multi-language verification

## Dependencies

| Dependency | Source | Integration |
|------------|--------|-------------|
| `trainingSessions` | Spec 004 | Read session history for context |
| `sessionTranscripts` | Spec 004 | Read transcript for debrief |
| `sessionScores` | Spec 009 | Read scores for analysis |
| `scoreFeedback` | Spec 009 | Read strengths/improvements |
| `keyMoments` | Spec 009 | Read transcript highlights |
| `bdrCertifications` | Spec 010 | Read certification level |
| Anthropic API | External | Claude 3.5 Haiku |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI response latency >5s | Use streaming to show tokens as they generate |
| Cost overrun | Strict token limits, rate limiting, budget alerts |
| Inconsistent AI quality | Temperature 0.5, detailed system prompts, retry logic |
| Streaming complexity | Use Convex action + client subscription pattern |
| Multi-language quality | Pre-defined templates, language-specific prompts |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Debrief engagement | 70% of sessions | Count debriefs / sessions |
| Training plan satisfaction | 80%+ | In-app survey |
| Cost per interaction | <$0.05 | Anthropic billing |
| Response latency | <5s perceived | Time to first token |
| Weekly check-in completion | 5 min avg | Conversation duration |

## Next: Generate Tasks

Run `/speckit.tasks` to generate the implementation task list from this plan.
