# Implementation Plan: AI Sales Trainer

**Branch**: `001-ai-sales-trainer` | **Date**: 2026-01-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-ai-sales-trainer/spec.md`

## Summary

The AI Sales Trainer is a real-time voice-based training simulation enabling 10,000+ BDRs to practice sales conversations with AI-powered virtual prospects. The system features two training modes (Free Practice with coaching whispers, Manager-assigned Evaluations), 7 intelligence modules for adaptive difficulty and coaching, certification progression, and GDPR-compliant consent management.

**Technical Approach**: Hybrid architecture with Next.js 15 frontend (Vercel), Convex backend (real-time data + crons), and Python LiveKit agent on Railway EU for real-time voice pipeline. Voice processing via Deepgram STT, Claude 3.5 Haiku/Sonnet for conversation/scoring, Cartesia TTS, and Simli avatar with D-ID fallback.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) for frontend/Convex, Python 3.11+ for LiveKit agent
**Primary Dependencies**: Next.js 15, React 19, Convex, Clerk, LiveKit SDK, Deepgram, Anthropic Claude, Cartesia, Simli
**Storage**: Convex (real-time database), Convex `_storage` for audio recordings
**Testing**: Vitest + RTL (unit), convex-test (integration), Playwright (E2E)
**Target Platform**: Web (desktop-optimized), EU deployment
**Project Type**: Web application (Next.js frontend + Convex backend + Python agent)
**Performance Goals**: P50 < 800ms, P95 < 1000ms, P99 < 1200ms end-to-end latency
**Constraints**: 99.5% uptime, AES-256 at rest + TLS 1.3 in transit, 90-day audio retention
**Scale/Scope**: 10,000+ users, 100-150 concurrent sessions, 5 languages, 8 personas, 2 scenarios (V1)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| **I: Code Quality** | TypeScript strict, no `any`, explicit returns | PASS | User input specifies TypeScript strict mode |
| **II: Testing Standards** | 80% unit, convex-test, E2E critical flows | PASS | 80% coverage required per user input |
| **III: User Experience** | Skeleton loading, toast errors, graceful degradation | PASS | Avatar fallback, latency degradation notification specified |
| **IV: Accessibility** | WCAG 2.1 AA | PASS | Audio-only fallback, screen-reader whispers specified |
| **V: Security** | Clerk auth, RBAC, requireAuth first line, Zod validation | PASS | RBAC model with manager/admin roles defined |
| **VI: Performance** | LCP < 2.5s, bundle < 150KB | PASS | Voice latency targets more stringent |
| **VII: Documentation** | JSDoc on exports | PASS | Standard practice |
| **VIII: Git Workflow** | Conventional commits, feature branches | PASS | User specifies conventional commits |
| **IX: Technology Stack** | Next.js 15, React 19, Convex, Clerk, Tailwind 4 | PASS | All locked technologies used |
| **X: Folder Structure** | Enforced directory layout | PASS | Will follow existing LMS structure |
| **XI: Convex Patterns** | requireAuth first line, withIndex, Date.now() | PASS | Standard patterns apply |
| **XII: Component Graduation** | Feature → Shared → UI Library | PASS | New components in `src/components/training/` |
| **XIII: Anti-Hallucination** | Read before write, search before create | PASS | Development practice |

**Constitution Compliance**: All articles PASS. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/004-ai-sales-trainer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── sessions.ts      # Session management contracts
│   ├── evaluations.ts   # Evaluation assignment contracts
│   ├── certifications.ts # Certification contracts
│   ├── consent.ts       # Consent management contracts
│   ├── scoring.ts       # Scoring and analytics contracts
│   └── agent.ts         # Agent-to-Convex contracts
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
# Next.js Frontend (Vercel)
src/
├── app/
│   └── (dashboard)/
│       └── training/                    # AI Sales Trainer pages
│           ├── page.tsx                 # Dashboard (scenarios, evaluations, progress)
│           ├── practice/
│           │   └── [sessionId]/page.tsx # Live practice session view
│           ├── evaluation/
│           │   └── [sessionId]/page.tsx # Live evaluation session view
│           ├── review/
│           │   └── [sessionId]/page.tsx # Post-session review & What-If
│           ├── certifications/page.tsx  # Certification progress & certificates
│           ├── consent/page.tsx         # Consent management
│           └── manager/                 # Manager views
│               ├── page.tsx             # Team overview
│               ├── assign/page.tsx      # Create evaluation assignments
│               └── review/
│                   └── [sessionId]/page.tsx # Review BDR recording
├── components/
│   └── training/                        # Feature components
│       ├── session/
│       │   ├── avatar-view.tsx          # Simli/D-ID avatar display
│       │   ├── audio-controls.tsx       # Microphone controls
│       │   ├── whisper-overlay.tsx      # Coaching whisper notifications
│       │   ├── session-timer.tsx        # Evaluation timer
│       │   └── degradation-notice.tsx   # Latency warning UI
│       ├── review/
│       │   ├── scorecard.tsx            # Post-session score breakdown
│       │   ├── timeline.tsx             # Key moments timeline
│       │   ├── what-if-replay.tsx       # Alternative response explorer
│       │   └── transcript-viewer.tsx    # Synchronized transcript
│       ├── dashboard/
│       │   ├── scenario-card.tsx        # Scenario selection card
│       │   ├── persona-card.tsx         # Persona selection card
│       │   ├── evaluation-card.tsx      # Pending evaluation card
│       │   └── progress-chart.tsx       # Skill progression chart
│       ├── certification/
│       │   ├── certificate-card.tsx     # Certificate display
│       │   ├── progress-tracker.tsx     # Bronze/Silver/Gold progress
│       │   └── verification-badge.tsx   # QR code badge
│       ├── consent/
│       │   └── consent-form.tsx         # 4-consent type form
│       └── manager/
│           ├── team-table.tsx           # BDR performance table
│           ├── assignment-form.tsx      # Evaluation assignment form
│           └── recording-player.tsx     # Audio playback with comments
├── hooks/
│   └── training/
│       ├── use-session.ts               # LiveKit room management
│       ├── use-audio.ts                 # Microphone + Web Audio API
│       ├── use-avatar.ts                # Avatar state management
│       ├── use-whispers.ts              # Real-time whisper subscription
│       ├── use-voice-metrics.ts         # M6 client-side voice analysis
│       └── use-degradation.ts           # Latency monitoring
├── lib/
│   └── training/
│       ├── livekit-client.ts            # LiveKit client setup
│       ├── voice-analyzer.ts            # Web Audio voice feature extraction
│       └── certificate-utils.ts         # QR code generation
└── types/
    └── training.ts                      # TypeScript types for feature

# Convex Backend
convex/
├── training/
│   ├── sessions.ts                      # Session CRUD + lifecycle
│   ├── transcripts.ts                   # Transcript storage + queries
│   ├── scores.ts                        # Scoring + analytics
│   ├── recordings.ts                    # Audio recording management
│   ├── evaluations.ts                   # Evaluation assignments
│   ├── certifications.ts                # Certification logic
│   ├── consent.ts                       # Consent management
│   ├── coaching.ts                      # M7 coaching plans
│   ├── audit.ts                         # Audit log mutations
│   └── internal/
│       ├── agentBridge.ts               # Internal actions for agent
│       └── scoring.ts                   # Internal scoring calculations
├── crons/
│   └── training.ts                      # M7 weekly coaching cron
├── schema.ts                            # Updated with new tables
└── lib/
    └── auth.ts                          # Add requireManager helper

# Python Agent (Railway EU)
agent/                                   # Separate repository or monorepo subfolder
├── pyproject.toml
├── agent/
│   ├── __init__.py
│   ├── main.py                          # LiveKit agent entrypoint
│   ├── pipeline/
│   │   ├── stt.py                       # Deepgram integration
│   │   ├── llm.py                       # Claude conversation
│   │   ├── tts.py                       # Cartesia integration
│   │   └── avatar.py                    # Simli/D-ID with circuit breaker
│   ├── modules/
│   │   ├── m1_difficulty.py             # Adaptive difficulty engine
│   │   ├── m2_whispers.py               # Coaching whisper triggers
│   │   ├── m3_emotional.py              # Emotional state machine
│   │   ├── m4_branching.py              # Scenario branching detection
│   │   └── m6_sentiment.py              # Voice sentiment aggregation
│   ├── personas/
│   │   └── loader.py                    # Persona prompt loading
│   ├── convex_client.py                 # Convex API client
│   └── config.py                        # Environment configuration
└── tests/
    └── unit/

# Tests
tests/
├── unit/
│   ├── components/
│   │   └── training/                    # Component tests
│   ├── convex/
│   │   └── training/                    # Convex function tests
│   └── hooks/
│       └── training/                    # Hook tests
├── integration/
│   └── training/                        # Integration tests
└── e2e/
    └── training/                        # Playwright E2E tests
```

**Structure Decision**: Web application pattern with Next.js frontend (existing LMS), Convex backend (serverless), and separate Python agent for real-time voice pipeline. Agent may be a separate repository or monorepo subfolder depending on deployment tooling.

## Complexity Tracking

> No violations requiring justification. All design choices align with constitution.

| Consideration | Decision | Rationale |
|---------------|----------|-----------|
| Python Agent | Separate runtime on Railway | Required for LiveKit Agents SDK (Python), real-time voice processing, low-latency requirements |
| Circuit Breaker (Avatar) | Simli primary, D-ID fallback | Ensures avatar reliability per edge case requirements |
| Dual LLM Models | Haiku (conversation) + Sonnet (scoring) | Latency vs quality tradeoff per architecture input |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL (EU)                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Next.js 15 Frontend                                     │    │
│  │  • /training/* pages                                     │    │
│  │  • Real-time Convex subscriptions (whispers, state)      │    │
│  │  • LiveKit client SDK (WebRTC)                           │    │
│  │  • Web Audio API (M6 voice features)                     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  CONVEX (EU)  │    │ LIVEKIT CLOUD │    │  RAILWAY (EU) │
│               │    │               │    │               │
│ • Sessions    │◄──►│ • WebRTC      │◄──►│ • Python Agent│
│ • Transcripts │    │ • Rooms       │    │ • M1-M4, M6   │
│ • Scores      │    │ • Tokens      │    │ • Voice pipe  │
│ • Consents    │    │               │    │ • Personas    │
│ • Certs       │    │               │    │               │
│ • M7 Cron     │    │               │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
┌───────────┐          ┌───────────┐          ┌───────────┐
│ DEEPGRAM  │          │ ANTHROPIC │          │   SIMLI   │
│  (EU)     │          │           │          │           │
│  STT      │          │ Claude    │          │  Avatar   │
│           │          │ 3.5 H/S   │          │           │
└───────────┘          └───────────┘          └───────────┘
                              │                      │
                       ┌───────────┐          ┌───────────┐
                       │ CARTESIA  │          │   D-ID    │
                       │           │          │ (Fallback)│
                       │   TTS     │          │           │
                       └───────────┘          └───────────┘
```

## Data Flow Summary

### Session Lifecycle

1. **Start Session**: BDR → Frontend → Convex (create session, check consent) → LiveKit (create room) → Agent joins room
2. **Conversation Loop**: BDR audio → LiveKit → Agent (STT → LLM → TTS) → LiveKit → BDR + Avatar
3. **Real-time Events**: Agent → Convex (whispers, state updates) → Frontend (subscriptions)
4. **End Session**: Agent → Convex (final transcript, calculate score) → Frontend (show scorecard)

### Intelligence Modules

| Module | Location | Data Flow |
|--------|----------|-----------|
| M1 (Difficulty) | Agent | Conversation context → difficulty adjustment → prompt modification |
| M2 (Whispers) | Agent → Convex → Frontend | Trigger detection → Convex mutation → real-time subscription |
| M3 (Emotional) | Agent | Conversation analysis → state machine → TTS tone adjustment |
| M4 (Branching) | Agent | Critical moment detection → branch recording → prompt injection |
| M6 (Voice) | Frontend + Agent | Web Audio features → Agent aggregation → score contribution |
| M7 (Coach) | Convex Cron | Weekly batch → Claude Sonnet analysis → coaching plan |

## Key Implementation Decisions

### 1. Agent Authentication
- LiveKit room token (JWT) generated by Convex contains `userId` + `sessionId`
- Agent validates token and extracts identity
- Agent → Convex communication via `AGENT_SERVICE_TOKEN` env var and internal actions

### 2. State Management
- **Volatile (Agent Memory)**: emotional state, difficulty level, conversation buffer, pending whispers
- **Persistent (Convex)**: session record, checkpoints (60s interval), transcripts, scores
- **Recovery**: On agent crash, reload last checkpoint from Convex

### 3. Consent Enforcement
- Pre-session consent check in Convex mutation
- Evaluation mode rejects if `audio_recording` or `transcript_storage` missing
- Free Practice allows no-score mode if consents declined

### 4. Latency Optimization
- Streaming output from Claude (don't wait for complete response)
- Pre-warm connections at session start (Anthropic, Cartesia, Simli)
- Limit conversation history to 10 turns in context window
- Circuit breaker for avatar with warm fallback

## Risk Mitigations

| Risk | Mitigation | Fallback |
|------|------------|----------|
| Avatar service down | Circuit breaker (3 failures) | Auto-switch to D-ID |
| High latency (>1000ms P95) | Pre-warming, streaming, monitoring | Notify user, allow continue/exit |
| Agent crash mid-session | 60s checkpoints to Convex | Reload checkpoint on reconnect |
| Consent violation | Pre-check in Convex mutation | Block session start |
| Certificate fraud | HMAC signature + admin review | Revocation capability |

## Next Steps

1. **Phase 0**: Generate `research.md` with integration patterns for LiveKit, Deepgram, Cartesia, Simli
2. **Phase 1**: Generate `data-model.md` with Convex schema additions
3. **Phase 1**: Generate `contracts/` with Convex function signatures
4. **Phase 1**: Generate `quickstart.md` with local development setup
5. **Phase 2**: Generate `tasks.md` via `/speckit.tasks` command
