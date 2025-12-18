# Implementation Plan: BDR Messaging — Slack-like Communication Platform

**Branch**: `001-slack-messaging` | **Date**: 2025-12-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-slack-messaging/spec.md`

## Summary

Build a comprehensive real-time messaging system for the existing LMS with:
- **Channels**: Public, private, and course-linked discussion channels with auto-enrollment
- **Direct Messages**: 1:1 and group DMs (up to 8 participants) with typing indicators
- **Voice Messages**: Audio recording with AI transcription (OpenAI Whisper), waveform visualization
- **Rich Interactions**: Threaded replies, emoji reactions, @mentions, pinning, bookmarking
- **Search & Discovery**: Full-text search across messages and voice transcripts
- **Presence System**: Online/away/offline status with custom status messages

Technical approach: Extend existing Convex schema with new tables for channels, enhanced messages, and real-time features. Leverage Convex's built-in real-time subscriptions for instant message delivery. Use OpenAI Whisper API for voice transcription and WaveSurfer.js for audio visualization.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 15.5
**Primary Dependencies**: Convex (backend/real-time), Clerk (auth), OpenAI Whisper (transcription), WaveSurfer.js (audio), @emoji-mart/react (emoji picker), Plate.js (rich text)
**Storage**: Convex Database + Convex Storage (voice files)
**Testing**: Vitest (unit), Playwright (E2E), Testing Library (components)
**Target Platform**: Web (desktop + mobile responsive), modern browsers (Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (monorepo with Convex backend + Next.js frontend)
**Performance Goals**: <1s message delivery, <500ms search, <30s transcription for 1-min audio
**Constraints**: 50MB file limit, 5-min voice limit, 4000 char message limit, 30 msg/min rate limit
**Scale/Scope**: 500 concurrent users initially, scaling to 10,000+

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | ✅ PASS | TypeScript strict mode, explicit return types, SRP components, <200 line files |
| II. Testing Standards | ✅ PASS | TDD workflow, unit tests for business logic, E2E for critical flows |
| III. User Experience | ✅ PASS | Mobile-first design, loading states, actionable errors, 3-click navigation |
| IV. Accessibility | ✅ PASS | WCAG 2.1 AA, keyboard navigation, ARIA labels, focus indicators |
| V. Security | ✅ PASS | Input validation, XSS sanitization (rich text), RBAC (admin/channel roles) |
| VI. Performance | ✅ PASS | Lazy loading for heavy components, bundle optimization, Core Web Vitals |
| VII. Documentation | ✅ PASS | JSDoc for exports, feature README, self-documenting types |
| VIII. Git Workflow | ✅ PASS | Conventional commits, feature branch, PR required |
| IX. File Conventions | ✅ PASS | kebab-case files, PascalCase components, camelCase functions |

**Pre-implementation notes**:
- Rich text content will use Plate.js with existing sanitization patterns
- Voice transcription will validate audio format and duration before processing
- Channel/DM access will integrate with existing RBAC patterns (requireAuth, requireAdmin)

## Project Structure

### Documentation (this feature)

```text
specs/001-slack-messaging/
├── plan.md              # This file
├── research.md          # Phase 0 output - technical decisions
├── data-model.md        # Phase 1 output - Convex schema design
├── quickstart.md        # Phase 1 output - setup guide
├── contracts/           # Phase 1 output - API signatures
│   ├── channels.ts      # Channel queries/mutations
│   ├── messages.ts      # Message queries/mutations
│   ├── voice.ts         # Voice message handling
│   ├── search.ts        # Search functionality
│   └── presence.ts      # Presence & status
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
convex/
├── schema.ts                    # Extended with messaging tables
├── channels.ts                  # Channel CRUD, membership
├── directMessages.ts            # DM conversations
├── messages.ts                  # Enhanced message handling (extended)
├── threads.ts                   # Thread management
├── reactions.ts                 # Emoji reactions
├── mentions.ts                  # @mention parsing & notifications
├── voiceMessages.ts             # Voice recording, transcription
├── search.ts                    # Full-text search
├── presence.ts                  # User presence & status
├── pins.ts                      # Message pinning
├── bookmarks.ts                 # Personal bookmarks
├── notifications.ts             # Push notification delivery
├── rateLimits.ts                # Rate limiting logic
├── retention.ts                 # GDPR & message retention
├── crons.ts                     # Scheduled jobs configuration
└── lib/
    ├── auth.ts                  # Extended auth helpers
    ├── permissions.ts           # Channel permission checks
    ├── transcription.ts         # Whisper API integration
    └── costControl.ts           # Transcription budget tracking

src/
├── app/(dashboard)/
│   ├── messages/
│   │   ├── page.tsx             # Main messaging view
│   │   ├── layout.tsx           # Messages layout with sidebar
│   │   ├── [channelId]/
│   │   │   └── page.tsx         # Channel view
│   │   └── dm/
│   │       └── [conversationId]/
│   │           └── page.tsx     # DM view
│   └── settings/
│       └── notifications/
│           └── page.tsx         # Notification preferences
├── components/
│   ├── messaging/
│   │   ├── channel-list.tsx
│   │   ├── channel-header.tsx
│   │   ├── channel-settings.tsx
│   │   ├── dm-list.tsx
│   │   ├── message-list.tsx
│   │   ├── message-item.tsx
│   │   ├── message-input.tsx
│   │   ├── message-actions.tsx
│   │   ├── thread-view.tsx
│   │   ├── thread-panel.tsx
│   │   ├── voice-recorder.tsx
│   │   ├── voice-player.tsx
│   │   ├── waveform-display.tsx
│   │   ├── emoji-picker.tsx
│   │   ├── reaction-bar.tsx
│   │   ├── mention-autocomplete.tsx
│   │   ├── typing-indicator.tsx
│   │   ├── unread-badge.tsx
│   │   ├── search-bar.tsx
│   │   ├── search-results.tsx
│   │   ├── pinned-messages.tsx
│   │   └── bookmarks-list.tsx
│   ├── presence/
│   │   ├── status-indicator.tsx
│   │   ├── status-selector.tsx
│   │   └── presence-provider.tsx
│   └── notifications/
│       ├── notification-bell.tsx
│       └── notification-settings.tsx
├── hooks/
│   ├── use-channel.ts
│   ├── use-messages.ts
│   ├── use-threads.ts
│   ├── use-voice-recorder.ts
│   ├── use-typing-indicator.ts
│   ├── use-presence.ts
│   ├── use-unread-count.ts
│   └── use-message-search.ts
└── lib/
    ├── audio-utils.ts           # Audio recording/encoding
    ├── waveform.ts              # Waveform generation
    └── mention-parser.ts        # @mention parsing

tests/
├── unit/
│   ├── convex/
│   │   ├── channels.test.ts
│   │   ├── messages.test.ts
│   │   └── permissions.test.ts
│   └── components/
│       └── messaging/
├── integration/
│   ├── channel-flow.test.ts
│   ├── dm-flow.test.ts
│   └── voice-message.test.ts
└── e2e/
    ├── messaging.spec.ts
    └── search.spec.ts
```

**Structure Decision**: Web application structure extending the existing Next.js + Convex monorepo. New messaging components in `src/components/messaging/`, Convex functions split by domain (channels, messages, voice, etc.). Tests organized by type following existing patterns.

## Complexity Tracking

> No constitution violations identified. Implementation follows existing patterns.

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| Separate channels.ts and directMessages.ts | Clear separation of concerns for different message container types | Single messages.ts would exceed 200 lines and mix concerns |
| Convex Storage for voice files | Consistent with existing file patterns, no external service config needed | UploadThing could work but adds complexity for audio streaming |
| OpenAI Whisper API | Industry-standard accuracy, cost-effective, auto language detection | Deepgram/AssemblyAI similar quality but Whisper better documented |

## Implementation Phases

### Phase 1: Core Infrastructure (P1 Features)
1. Database schema extensions for channels, enhanced messages
2. Channel CRUD operations and membership management
3. Basic message sending/receiving with real-time updates
4. DM conversations (1:1 and group)
5. Unread tracking with viewport detection

### Phase 2: Course Integration (P2 Features)
1. Course-linked channel auto-creation on publish
2. Lesson discussion threads
3. Threaded replies in all channels
4. Rich text message formatting

### Phase 3: Engagement Features (P3 Features)
1. Emoji reactions
2. @mentions with notifications
3. Voice messages with recording
4. Voice transcription (Whisper integration)
5. Full-text search
6. Presence system

### Phase 4: Management & Polish (P4 Features)
1. Message pinning and bookmarking
2. File attachments
3. Channel administration
4. Export functionality
5. Notification preferences

## Key Technical Decisions

### Real-time Architecture
- Use Convex's native reactive queries for message updates
- Implement optimistic updates for instant UI feedback
- Use `useQuery` subscriptions for channel/DM lists
- Typing indicators via short-lived Convex documents with TTL

### Voice Message Flow
1. Client records audio using MediaRecorder API
2. Encode as WebM/Opus (MP4/AAC for Safari)
3. Upload to Convex Storage
4. Trigger server action to call Whisper API
5. Store transcription result in message record
6. Render with WaveSurfer.js for playback visualization

### Search Implementation
- Leverage Convex's text search capabilities
- Index message content and voice transcriptions
- Filter by user's accessible channels/DMs at query time
- Implement faceted search with filters

### Rate Limiting
- Implement in Convex mutations using user-specific counters
- Use sliding window algorithm for message rate (30/min)
- Track voice message count hourly (20/hr)
- Return clear error messages when limits exceeded

## Dependencies to Add

```json
{
  "dependencies": {
    "@emoji-mart/data": "^1.2.1",
    "@emoji-mart/react": "^1.1.1",
    "wavesurfer.js": "^7.8.0",
    "openai": "^4.x"
  }
}
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Whisper API latency | Medium | Show audio immediately, transcription async with loading state |
| Message volume scaling | High | Implement pagination, archive old messages, optimize indices |
| Browser audio compatibility | Medium | Feature detection, Safari fallback to MP4/AAC |
| Rate limit circumvention | Low | Server-side enforcement, client-side is UX only |

## Success Metrics Mapping

| Success Criteria | Implementation |
|-----------------|----------------|
| SC-001: <1s message delivery | Convex real-time subscriptions |
| SC-002: <30s transcription | Whisper API with progress indicator |
| SC-003: <500ms search | Convex text search with proper indexing |
| SC-004: 500 concurrent users | Convex auto-scales, optimize queries |
| SC-010: Accurate unread counts | Viewport intersection observer + lastReadAt |
