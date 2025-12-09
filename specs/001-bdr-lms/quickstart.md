# Quickstart: Onboarding BDR Team v2 LMS

**Date**: 2025-12-06
**Branch**: `001-bdr-lms`

## Prerequisites

- Node.js 20.x LTS
- pnpm 8+ (package manager)
- Convex account (free tier available)
- Clerk account (free tier available)

## Initial Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd onboarding-bdr-v2
git checkout 001-bdr-lms
pnpm install
```

### 2. Set Up Convex

```bash
# Install Convex CLI globally (if not already installed)
pnpm add -g convex

# Initialize Convex (creates convex/ directory if needed)
npx convex dev

# This will:
# - Create a new Convex project (or link to existing)
# - Generate convex/_generated/ types
# - Start the dev server watching for changes
```

### 3. Set Up Clerk

1. Create a Clerk application at https://dashboard.clerk.com
2. Enable Email/Password authentication
3. (Optional) Enable MFA under "Multi-factor" settings
4. Copy the API keys

### 4. Environment Configuration

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=prod:your-deploy-key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Clerk URLs (for redirects)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

### 5. Configure Clerk Webhook

1. In Clerk Dashboard, go to "Webhooks"
2. Add endpoint: `https://your-convex-url.convex.site/clerk-webhook`
3. Select events: `user.created`, `user.updated`, `user.deleted`
4. Copy the signing secret to `CLERK_WEBHOOK_SECRET`

### 6. Install UI Components

Run these commands in order to install all required UI components.

> **Design System**: Before initializing shadcn/ui, review the theme configuration in [design-system.md](./design-system.md). Apply the CSS variables to `src/app/globals.css` after initialization.

#### Phase 1: Base Setup

```bash
# Initialize shadcn/ui (apply theme from design-system.md during setup)
npx shadcn@latest init

# Install dependencies
pnpm add @tanstack/react-table next-themes @better-upload/server @better-upload/client recharts @dnd-kit/core @dnd-kit/sortable react-hook-form @hookform/resolvers zod
```

#### Phase 2: shadcn/ui Components

```bash
npx shadcn@latest add accordion alert-dialog alert aspect-ratio avatar badge breadcrumb button-group button calendar card carousel chart checkbox collapsible command context-menu table dialog drawer dropdown-menu empty field form hover-card input-group input-otp input item kbd label menubar native-select navigation-menu pagination popover progress radio-group resizable scroll-area select separator sheet skeleton slider sonner spinner switch tabs textarea toggle-group toggle tooltip
```

#### Phase 3: shadcn/ui Blocks

```bash
npx shadcn@latest add sidebar-07 login-04 otp-04 calendar-20 calendar-27
```

#### Phase 4: Third-party Integrations

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

#### Phase 5: Plate.js Editor Kits

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

#### Phase 6: Plate.js Toolbar Components

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

#### Phase 7: Plate.js Node Components

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

### 7. Start Development Server

```bash
# Terminal 1: Start Convex dev server
npx convex dev

# Terminal 2: Start Next.js dev server
pnpm dev
```

Application runs at `http://localhost:3000`

## Development Workflow

### Running Tests

```bash
# Unit tests (Vitest)
pnpm test

# Unit tests with watch mode
pnpm test:watch

# E2E tests (Playwright)
pnpm test:e2e

# E2E tests with UI
pnpm test:e2e:ui

# All tests with coverage
pnpm test:coverage
```

### Code Quality

```bash
# Lint
pnpm lint

# Type check
pnpm typecheck

# Format
pnpm format
```

### Convex Operations

```bash
# Start dev server (watches for changes)
npx convex dev

# Deploy to production
npx convex deploy

# View Convex dashboard
npx convex dashboard

# Generate types after schema changes
npx convex dev  # Types auto-generate

# Run a function manually
npx convex run users:list
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Clerk auth routes (sign-in, sign-up)
│   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── admin/         # Admin-only pages
│   │   ├── courses/       # Course viewing
│   │   ├── messages/      # Messaging
│   │   └── profile/       # User profile
│   └── layout.tsx         # Root layout with providers
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── courses/          # Course components
│   ├── editor/           # Plate.js editor
│   └── ...
├── lib/                   # Utilities
│   ├── utils.ts          # General utilities (cn, etc.)
│   └── validators/       # Zod schemas
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript definitions

convex/
├── schema.ts              # Database schema
├── auth.ts                # Clerk webhook handlers
├── users.ts               # User functions
├── teams.ts               # Team functions
├── courses.ts             # Course functions
├── sections.ts            # Section functions
├── lessons.ts             # Lesson functions
├── progress.ts            # Progress tracking
├── quizzes.ts             # Quiz attempts
├── messages.ts            # Messaging
├── comments.ts            # Comments
├── analytics.ts           # Analytics
├── files.ts               # File storage
├── http.ts                # HTTP routes (webhooks)
└── _generated/            # Auto-generated types

tests/
├── unit/                  # Vitest unit tests
└── e2e/                   # Playwright E2E tests
```

## Key Technologies

| Category | Technology | Purpose |
|----------|------------|---------|
| Framework | Next.js 15.5.7 | Full-stack React 19.2.1 with App Router (patched for CVE-2025-66478) |
| Backend | Convex | Real-time database + serverless functions |
| Auth | Clerk | Authentication, MFA, SSO |
| Styling | Tailwind CSS 4.x + shadcn/ui | UI components |
| Rich Text | Plate.js v52+ | Course content editor |
| Tables | TanStack Table v8 | Data tables with sorting/filtering |
| Drag & Drop | @dnd-kit | Section/lesson reordering |
| Charts | Recharts | Analytics visualizations |
| Testing | Vitest + Playwright | Unit + E2E tests |
| File Storage | Convex built-in | File uploads (max 50MB) |

## Quick Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js development server |
| `npx convex dev` | Start Convex development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript checks |
| `npx convex dashboard` | Open Convex dashboard |
| `npx convex deploy` | Deploy Convex to production |

## Default Accounts (Development)

After seeding (see below):

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | Admin123! | Administrator |
| user@example.com | User123! | User |

### Seeding Development Data

```bash
# Seed initial data (run after Convex is set up)
npx convex run seed:run
```

## Troubleshooting

### Convex Connection Issues

```bash
# Check Convex status
npx convex status

# Re-link to project
npx convex dev --once

# Clear and regenerate types
rm -rf convex/_generated
npx convex dev
```

### Clerk Webhook Not Working

1. Verify webhook URL is correct: `https://your-project.convex.site/clerk-webhook`
2. Check webhook secret matches `CLERK_WEBHOOK_SECRET`
3. Verify events are selected: `user.created`, `user.updated`, `user.deleted`
4. Check Convex logs: `npx convex logs`

### Type Errors After Schema Changes

```bash
# Convex types are auto-generated, just restart dev server
npx convex dev
```

### Real-time Not Working

- Ensure both Convex and Next.js dev servers are running
- Check browser console for WebSocket errors
- Verify `NEXT_PUBLIC_CONVEX_URL` is set correctly

### Build Errors

```bash
# Clear cache and rebuild
rm -rf .next node_modules
pnpm install
pnpm build
```

## Deployment

### Vercel (Frontend)

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

### Convex (Backend)

```bash
# Deploy to production
npx convex deploy
```

## Next Steps

1. Review [spec.md](./spec.md) for feature requirements
2. Review [data-model.md](./data-model.md) for Convex schema
3. Review [contracts/](./contracts/) for Convex function contracts
4. Run `/speckit.tasks` to generate implementation tasks
