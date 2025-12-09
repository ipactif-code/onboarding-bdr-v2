# Implementation Plan: Onboarding BDR Team v2 LMS

**Branch**: `001-bdr-lms` | **Date**: 2025-12-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-bdr-lms/spec.md`

## Summary

Build an enterprise Learning Management System for BDR sales team training. The system enables administrators to create courses with multiple lesson types (text, video embeds, quizzes, files), organize users into teams, and track learning progress through comprehensive analytics. Users can consume courses, take quizzes, exchange messages, and engage through comments. The application uses Convex for real-time reactive data, Clerk for authentication, and Next.js 15 for the frontend.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled per constitution)
**Framework**: Next.js 15.5.7 with React 19.2.1 (patched for CVE-2025-66478 and CVE-2025-55182), App Router, Turbopack
**Backend**: Convex (reactive database, real-time subscriptions, TypeScript functions)
**Authentication**: Clerk (SSO, MFA, Organizations, webhook sync to Convex)
**UI Components**: Tailwind CSS 4.x, shadcn/ui, Plate.js v52+, Lucide React
**State Management**: Convex queries (server state), React Hook Form + Zod (forms)
**Data Tables**: TanStack Table v8
**Drag & Drop**: @dnd-kit
**Charts**: Recharts
**Testing**: Vitest + convex-test (unit/integration), Playwright (E2E), axe-core (accessibility)
**Test Coverage Target**: 80% minimum (per constitution requirement II)
**File Storage**: Convex built-in file storage
**Real-time**: Convex reactive queries (built-in, no separate WebSocket setup)
**Deployment**: Vercel (frontend) + Convex Cloud (backend)
**Performance Goals**: LCP < 2.5s, FID < 100ms, CLS < 0.1, Initial JS < 150KB gzipped
**Constraints**: 500 concurrent users, 50MB max file upload, WCAG 2.1 AA compliance
**Scale/Scope**: ~500 users, ~50 courses, ~20 teams initially

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| I. Code Quality | TypeScript strict, no `any`, explicit returns, SRP, <200 lines/file | PASS | Next.js + TypeScript strict mode, Convex is TypeScript-native |
| II. Testing Standards | 80% coverage, integration tests, E2E, TDD | PASS | Vitest + Playwright |
| III. User Experience | Mobile-first, loading states, actionable errors, 3-click max | PASS | Convex provides optimistic updates, Sonner for toasts |
| IV. Accessibility | WCAG 2.1 AA, keyboard nav, ARIA, 4.5:1 contrast, focus indicators | PASS | shadcn/ui built on Radix primitives |
| V. Security | Input validation, XSS prevention, RBAC, no client secrets, MFA | PASS | Clerk handles MFA, Convex validates on server |
| VI. Performance | LCP <2.5s, FID <100ms, CLS <0.1, <150KB bundle, lazy load | PASS | Turbopack, server components, lazy loading |
| VII. Documentation | JSDoc exports, README per feature, types as docs | PASS | TypeScript-native throughout |
| VIII. Git Workflow | Conventional Commits, feature branches, PRs required | PASS | Already on feature branch |
| IX. File Conventions | English, kebab-case files, PascalCase components, camelCase functions | PASS | Standard React/Next.js conventions |

**Gate Status**: PASS - All constitution principles satisfied

## Project Structure

### Documentation (this feature)

```text
specs/001-bdr-lms/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (Convex schema)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (Convex function contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth routes (sign-in, sign-up via Clerk)
│   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── admin/         # Admin-only pages
│   │   │   ├── analytics/
│   │   │   ├── courses/
│   │   │   ├── teams/
│   │   │   └── users/
│   │   ├── courses/       # Course viewing/learning
│   │   ├── messages/      # Messaging interface
│   │   └── profile/       # User profile
│   └── layout.tsx         # Root layout with providers
├── components/
│   ├── ui/                # shadcn/ui base components
│   ├── courses/           # Course-related components
│   ├── lessons/           # Lesson type components
│   ├── editor/            # Plate.js editor components
│   ├── messaging/         # Chat/messaging components
│   ├── comments/          # Comment thread components
│   ├── analytics/         # Charts and metrics (Recharts)
│   └── layout/            # Navigation, sidebar, breadcrumbs
├── lib/
│   ├── utils.ts           # General utilities (cn, etc.)
│   └── validators/        # Zod schemas for form validation
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript type definitions
└── styles/                # Global styles, Tailwind config

convex/
├── schema.ts              # Convex database schema
├── auth.ts                # Clerk webhook handlers
├── users.ts               # User queries/mutations
├── teams.ts               # Team queries/mutations
├── courses.ts             # Course queries/mutations
├── sections.ts            # Section queries/mutations
├── lessons.ts             # Lesson queries/mutations
├── progress.ts            # Progress tracking
├── quizzes.ts             # Quiz attempts
├── messages.ts            # Messaging system
├── comments.ts            # Comments system
├── analytics.ts           # Analytics queries
├── files.ts               # File upload/storage
└── _generated/            # Convex generated types

tests/
├── unit/                  # Vitest unit tests
└── e2e/                   # Playwright E2E tests
```

**Structure Decision**: Next.js 15 App Router with Convex backend. This structure:
- Separates frontend (src/) from backend (convex/)
- Uses Convex's TypeScript-native functions for type safety end-to-end
- Leverages Convex's built-in real-time for messaging, comments, presence
- Clerk handles all auth complexity (SSO, MFA, Organizations)
- No separate API routes needed - Convex functions replace REST endpoints

## UI Component Installation

After project initialization, install all UI components in this order:

### Phase 1: Base Setup

```bash
# Initialize shadcn/ui
npx shadcn@latest init

# Install dependencies
pnpm add @tanstack/react-table next-themes @better-upload/server @better-upload/client recharts @dnd-kit/core @dnd-kit/sortable react-hook-form @hookform/resolvers zod
```

### Phase 2: shadcn/ui Components

```bash
npx shadcn@latest add accordion alert-dialog alert aspect-ratio avatar badge breadcrumb button-group button calendar card carousel chart checkbox collapsible command context-menu table dialog drawer dropdown-menu empty field form hover-card input-group input-otp input item kbd label menubar native-select navigation-menu pagination popover progress radio-group resizable scroll-area select separator sheet skeleton slider sonner spinner switch tabs textarea toggle-group toggle tooltip
```

### Phase 3: shadcn/ui Blocks

```bash
npx shadcn@latest add sidebar-07 login-04 otp-04 calendar-20 calendar-27
```

### Phase 4: Third-party Integrations

```bash
# AI Elements
npx ai-elements@latest
npx assistant-ui init
npx shadcn@latest add @assistant-ui/assistant-modal

# Clerk authentication
npx shadcn@latest add @clerk/nextjs-quickstart

# UI Tripled components
npx shadcn@latest add @uitripled/comment-thread @uitripled/draggable-list
```

### Phase 5: Plate.js Editor Kits

```bash
# Core editor
npx shadcn@latest add https://platejs.org/r/editor-base-kit
npx shadcn@latest add https://platejs.org/r/editor

# AI features
npx shadcn@latest add https://platejs.org/r/editor-ai
npx shadcn@latest add https://platejs.org/r/ai-kit
npx shadcn@latest add https://platejs.org/r/copilot-demo

# Collaboration features
npx shadcn@latest add https://platejs.org/r/discussion-kit
npx shadcn@latest add https://platejs.org/r/suggestion-kit
npx shadcn@latest add https://platejs.org/r/comment-kit
npx shadcn@latest add https://platejs.org/r/collaboration-demo

# Block types
npx shadcn@latest add https://platejs.org/r/basic-blocks-kit
npx shadcn@latest add https://platejs.org/r/callout-kit
npx shadcn@latest add https://platejs.org/r/code-block-kit
npx shadcn@latest add https://platejs.org/r/column-kit
npx shadcn@latest add https://platejs.org/r/date-kit
npx shadcn@latest add https://platejs.org/r/link-kit
npx shadcn@latest add https://platejs.org/r/media-kit
npx shadcn@latest add https://platejs.org/r/mention-kit
npx shadcn@latest add https://platejs.org/r/table-kit
npx shadcn@latest add https://platejs.org/r/toc-kit
npx shadcn@latest add https://platejs.org/r/toggle-kit

# Text formatting
npx shadcn@latest add https://platejs.org/r/basic-marks-kit
npx shadcn@latest add https://platejs.org/r/font-kit
npx shadcn@latest add https://platejs.org/r/line-height-kit
npx shadcn@latest add https://platejs.org/r/align-kit
npx shadcn@latest add https://platejs.org/r/indent-kit
npx shadcn@latest add https://platejs.org/r/list-kit

# Editor behavior
npx shadcn@latest add https://platejs.org/r/exit-break-kit
npx shadcn@latest add https://platejs.org/r/autoformat-kit
npx shadcn@latest add https://platejs.org/r/block-menu-kit
npx shadcn@latest add https://platejs.org/r/block-placeholder-kit
npx shadcn@latest add https://platejs.org/r/block-selection-kit
npx shadcn@latest add https://platejs.org/r/emoji-kit
npx shadcn@latest add https://platejs.org/r/slash-kit
npx shadcn@latest add https://platejs.org/r/cursor-overlay-kit
npx shadcn@latest add https://platejs.org/r/dnd-kit
npx shadcn@latest add https://platejs.org/r/tabbable-kit
npx shadcn@latest add https://platejs.org/r/fixed-toolbar-kit

# Import/Export
npx shadcn@latest add https://platejs.org/r/docx-kit
npx shadcn@latest add https://platejs.org/r/markdown-to-slate-demo
npx shadcn@latest add https://platejs.org/r/select-editor-demo
```

### Phase 6: Plate.js Toolbar Components

```bash
# AI toolbar
npx shadcn@latest add https://platejs.org/r/ai-menu
npx shadcn@latest add https://platejs.org/r/ai-toolbar-button

# Block controls
npx shadcn@latest add https://platejs.org/r/block-context-menu
npx shadcn@latest add https://platejs.org/r/block-selection
npx shadcn@latest add https://platejs.org/r/block-draggable
npx shadcn@latest add https://platejs.org/r/block-discussion

# Formatting toolbar buttons
npx shadcn@latest add https://platejs.org/r/align-toolbar-button
npx shadcn@latest add https://platejs.org/r/font-color-toolbar-button
npx shadcn@latest add https://platejs.org/r/font-size-toolbar-button
npx shadcn@latest add https://platejs.org/r/line-height-toolbar-button
npx shadcn@latest add https://platejs.org/r/mark-toolbar-button
npx shadcn@latest add https://platejs.org/r/indent-toolbar-button

# Insert toolbar buttons
npx shadcn@latest add https://platejs.org/r/insert-toolbar-button
npx shadcn@latest add https://platejs.org/r/table-toolbar-button
npx shadcn@latest add https://platejs.org/r/link-toolbar-button
npx shadcn@latest add https://platejs.org/r/media-toolbar-button
npx shadcn@latest add https://platejs.org/r/emoji-toolbar-button
npx shadcn@latest add https://platejs.org/r/comment-toolbar-button
npx shadcn@latest add https://platejs.org/r/suggestion-toolbar-button

# List toolbar buttons
npx shadcn@latest add https://platejs.org/r/list-toolbar-button
npx shadcn@latest add https://platejs.org/r/list-classic-toolbar-button
npx shadcn@latest add https://platejs.org/r/toggle-toolbar-button
npx shadcn@latest add https://platejs.org/r/turn-into-toolbar-button

# Utility toolbar buttons
npx shadcn@latest add https://platejs.org/r/history-toolbar-button
npx shadcn@latest add https://platejs.org/r/mode-toolbar-button
npx shadcn@latest add https://platejs.org/r/more-toolbar-button
npx shadcn@latest add https://platejs.org/r/import-toolbar-button
npx shadcn@latest add https://platejs.org/r/export-toolbar-button

# Toolbars
npx shadcn@latest add https://platejs.org/r/toolbar
npx shadcn@latest add https://platejs.org/r/fixed-toolbar
npx shadcn@latest add https://platejs.org/r/fixed-toolbar-buttons
npx shadcn@latest add https://platejs.org/r/floating-toolbar
npx shadcn@latest add https://platejs.org/r/floating-toolbar-buttons
npx shadcn@latest add https://platejs.org/r/link-toolbar
npx shadcn@latest add https://platejs.org/r/media-toolbar

# Other toolbar components
npx shadcn@latest add https://platejs.org/r/caption
npx shadcn@latest add https://platejs.org/r/cursor-overlay
npx shadcn@latest add https://platejs.org/r/ghost-text
npx shadcn@latest add https://platejs.org/r/inline-combobox
npx shadcn@latest add https://platejs.org/r/media-upload-toast
npx shadcn@latest add https://platejs.org/r/resize-handle
npx shadcn@latest add https://platejs.org/r/remote-cursor-overlay
```

### Phase 7: Plate.js Node Components

```bash
# AI nodes
npx shadcn@latest add https://platejs.org/r/ai-node

# Block nodes
npx shadcn@latest add https://platejs.org/r/block-list
npx shadcn@latest add https://platejs.org/r/blockquote-node
npx shadcn@latest add https://platejs.org/r/callout-node
npx shadcn@latest add https://platejs.org/r/code-block-node
npx shadcn@latest add https://platejs.org/r/column-node
npx shadcn@latest add https://platejs.org/r/heading-node
npx shadcn@latest add https://platejs.org/r/paragraph-node
npx shadcn@latest add https://platejs.org/r/hr-node
npx shadcn@latest add https://platejs.org/r/toggle-node
npx shadcn@latest add https://platejs.org/r/toc-node

# Inline nodes
npx shadcn@latest add https://platejs.org/r/code-node
npx shadcn@latest add https://platejs.org/r/link-node
npx shadcn@latest add https://platejs.org/r/mention-node
npx shadcn@latest add https://platejs.org/r/date-node
npx shadcn@latest add https://platejs.org/r/emoji-node
npx shadcn@latest add https://platejs.org/r/kbd-node
npx shadcn@latest add https://platejs.org/r/tag-node
npx shadcn@latest add https://platejs.org/r/highlight-node

# Media nodes
npx shadcn@latest add https://platejs.org/r/media-image-node
npx shadcn@latest add https://platejs.org/r/media-video-node
npx shadcn@latest add https://platejs.org/r/media-audio-node
npx shadcn@latest add https://platejs.org/r/media-embed-node
npx shadcn@latest add https://platejs.org/r/media-file-node
npx shadcn@latest add https://platejs.org/r/media-placeholder-node
npx shadcn@latest add https://platejs.org/r/media-preview-dialog
npx shadcn@latest add https://platejs.org/r/excalidraw-node

# Table nodes
npx shadcn@latest add https://platejs.org/r/table-node

# Collaboration nodes
npx shadcn@latest add https://platejs.org/r/comment-node
npx shadcn@latest add https://platejs.org/r/suggestion-node

# Other nodes
npx shadcn@latest add https://platejs.org/r/slash-node
npx shadcn@latest add https://platejs.org/r/search-highlight-node
```

## Testing Strategy

Per constitution requirement II (Testing Standards), this project implements comprehensive testing:

### Unit Tests (Vitest + convex-test)

- All Convex functions tested with convex-test
- Target: 80% code coverage minimum
- Run on every PR via GitHub Actions
- Test files located in `tests/unit/`

### Integration Tests

Key workflows tested end-to-end at backend level:

- User signup → Clerk webhook → Convex user created
- Course publish workflow (draft → sections → lessons → publish)
- Quiz attempt flow (start → answer → submit → score → progress)
- Real-time messaging (send → receive → read receipts)

### E2E Tests (Playwright)

- User story acceptance tests for all 7 user stories
- Cross-browser: Chrome, Firefox, Safari
- Mobile viewport testing (320px, 768px, 1440px)
- Accessibility testing with axe-core integration
- Test files located in `tests/e2e/`

### Accessibility Testing

- axe-core integration for automated WCAG 2.1 AA compliance
- Keyboard navigation verification
- Screen reader compatibility testing (VoiceOver, NVDA)
- Color contrast verification (4.5:1 minimum)

### Test Infrastructure

- CI pipeline runs all tests on PR (GitHub Actions)
- Coverage reports via Codecov or similar
- Test seed data generators for reproducible tests
- Authenticated user fixtures for E2E tests

## Complexity Tracking

> No constitution violations requiring justification. All principles satisfied with standard patterns.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |
