# Implementation Plan: Knowledge Base - Notion-like Collaborative Documentation Platform

**Branch**: `004-knowledge-base` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-knowledge-base/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a Notion-like collaborative documentation platform for DiliTrust's BDR/Sales training materials, company wiki, and shared knowledge base. The platform will feature:

- **Rich-text editing** via Plate Pro (Potion template) with 50+ block types, slash commands, and drag-and-drop
- **Real-time collaboration** via self-hosted Hocuspocus (YJS) with cursors, presence, and CRDT conflict resolution (~$10-20/month vs $150/month Liveblocks)
- **Hierarchical organization**: Workspaces > Folders > Documents with unlimited nesting
- **AI-powered features**: Summarize, translate, rephrase, expand (Claude Haiku/Sonnet), semantic search (OpenAI embeddings)
- **Granular permissions**: RBAC with inheritance and overrides at workspace/folder/document levels
- **Version history**: Auto-save, manual versions, restore capability
- **LMS integration**: Bidirectional links between documents and courses/lessons
- **Third-party integrations**: GitHub, Jira, Linear, MS365 via Nango Cloud (P4)

**Potion Template**: Using purchased Plate Pro Potion template - provides editor, sidebar, collaboration code (~40 hours saved). Requires adaptation from better-auth/Prisma/tRPC to Clerk/Convex.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 15.5.7 (App Router), React 19, Convex ^1.0, Clerk ^6.36.0, Plate Pro ^52 (Potion template), @hocuspocus/provider, @hocuspocus/server, Tailwind CSS 4, shadcn/ui
**Collaboration Stack**: Hocuspocus (self-hosted YJS server) - replaces Liveblocks Cloud
**Storage**: Convex (real-time serverless database) with file storage
**Testing**: Vitest 3.2.4 (unit/integration), Playwright 1.57+ (E2E), React Testing Library
**Target Platform**: Web (desktop-first, responsive)
**Project Type**: Web application (Next.js frontend + Convex backend + Hocuspocus server)
**Performance Goals**: 100 concurrent users, 100ms sync latency, 200ms search response
**Constraints**: 150 EUR/month AI budget ceiling, 10MB max document size, 25 concurrent editors/document
**Scale/Scope**: ~1000 users, ~10,000 documents, 7 priority phases
**Template Source**: Plate Pro Potion template (purchased) - requires adaptation from better-auth/Prisma/tRPC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Based on existing project constitution patterns:

- [x] **TypeScript strict mode**: All code in strict TypeScript
- [x] **Convex patterns**: requireAuth() on first line, .withIndex() not .filter(), returns validators
- [x] **React patterns**: Server Components by default, "use client" only when needed
- [x] **UI patterns**: shadcn/ui + Radix primitives, Tailwind CSS 4, loading/error states
- [x] **Security**: RBAC via Clerk roles, input validation via Zod, XSS prevention
- [x] **Testing**: Unit + integration + E2E coverage required
- [x] **Performance**: LCP < 2.5s, FID < 100ms, CLS < 0.1, bundle < 150KB gzipped

## Project Structure

### Documentation (this feature)

```text
specs/004-knowledge-base/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── workspaces.ts    # Workspace API contracts
│   ├── folders.ts       # Folder API contracts
│   ├── documents.ts     # Document API contracts
│   ├── collaboration.ts # Real-time collaboration contracts
│   ├── comments.ts      # Comments API contracts
│   ├── search.ts        # Search API contracts
│   ├── permissions.ts   # Permission API contracts
│   ├── versions.ts      # Version history API contracts
│   ├── ai.ts            # AI features API contracts
│   └── integrations.ts  # LMS & external integrations contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Frontend (Next.js 15 App Router)
src/
├── app/
│   └── (dashboard)/
│       └── knowledge/              # Knowledge base routes
│           ├── page.tsx            # KB home (recent, favorites)
│           ├── layout.tsx          # KB layout with sidebar
│           ├── [workspaceId]/
│           │   ├── page.tsx        # Workspace view
│           │   └── [folderId]/
│           │       └── page.tsx    # Folder view
│           ├── doc/
│           │   └── [documentId]/
│           │       ├── page.tsx    # Document view/edit
│           │       ├── editor.tsx  # Plate.js editor component
│           │       └── history/
│           │           └── page.tsx # Version history
│           └── search/
│               └── page.tsx        # Search results
├── components/
│   └── knowledge/                  # KB-specific components
│       ├── workspace-sidebar.tsx   # Navigation sidebar
│       ├── document-tree.tsx       # Hierarchical tree
│       ├── breadcrumbs.tsx         # Navigation breadcrumbs
│       ├── document-editor/        # Plate.js editor wrapper
│       │   ├── index.tsx
│       │   ├── toolbar.tsx
│       │   ├── slash-commands.tsx
│       │   └── blocks/             # Custom block components
│       ├── collaboration/          # Real-time components
│       │   ├── cursors.tsx
│       │   ├── presence.tsx
│       │   └── awareness.tsx
│       ├── comments/               # Comment components
│       │   ├── comment-thread.tsx
│       │   ├── inline-comment.tsx
│       │   └── comment-input.tsx
│       ├── permissions/            # Permission UI
│       │   ├── permission-dialog.tsx
│       │   └── permission-badge.tsx
│       └── ai/                     # AI feature components
│           ├── ai-menu.tsx
│           ├── ai-response.tsx
│           └── search-modal.tsx
├── hooks/
│   └── knowledge/                  # KB-specific hooks
│       ├── use-document.ts
│       ├── use-collaboration.ts
│       ├── use-permissions.ts
│       └── use-ai-commands.ts
└── lib/
    └── knowledge/                  # KB utilities
        ├── plate-config.ts
        └── hocuspocus-config.ts    # Hocuspocus client config (replaces Liveblocks)

# Hocuspocus Server (Self-hosted)
hocuspocus/
├── server.ts                       # Hocuspocus server configuration
├── Dockerfile                      # Container for deployment
└── docker-compose.yml              # Local development setup

# Backend (Convex)
convex/
├── schema.ts                       # Extended with KB tables
├── knowledge/                      # KB domain functions
│   ├── workspaces.ts               # Workspace CRUD
│   ├── folders.ts                  # Folder CRUD
│   ├── documents.ts                # Document CRUD
│   ├── content.ts                  # Document content (separated)
│   ├── permissions.ts              # Permission management
│   ├── comments.ts                 # Comment threads
│   ├── versions.ts                 # Version history
│   ├── search.ts                   # Full-text + semantic search
│   └── ai.ts                       # AI command handlers
├── actions/
│   ├── aiCommands.ts               # Claude API calls
│   ├── embeddings.ts               # OpenAI embedding generation
│   └── integrations.ts             # Nango Cloud integrations
└── lib/
    └── kbAuth.ts                   # KB-specific auth helpers

# Tests
tests/
├── unit/
│   ├── convex/
│   │   └── knowledge/              # Convex function tests
│   └── components/
│       └── knowledge/              # Component tests
├── integration/
│   └── knowledge/                  # Integration tests
└── e2e/
    └── knowledge/                  # Playwright E2E tests
```

**Structure Decision**: Following existing project patterns with:
- Feature-based organization under `src/app/(dashboard)/knowledge/`
- Domain-grouped Convex functions under `convex/knowledge/`
- Colocated tests mirroring source structure
- Shared utilities in `src/lib/knowledge/` and `convex/lib/`

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Hocuspocus (self-hosted YJS) | Real-time collaboration with CRDT conflict resolution; ~$10-20/month vs $150/month Liveblocks | Liveblocks Cloud is expensive; self-hosted gives control + cost savings |
| Potion Template (Plate Pro commercial) | Pre-built editor, sidebar, collaboration components (~40 hours saved); 50+ block types, slash commands, mobile support, accessibility | Building from scratch takes 3x longer; open-source alternatives lack features |
| Template Stack Adaptation | Potion uses better-auth/Prisma/tRPC; our stack is Clerk/Convex | Must adapt to maintain consistency with existing project |
| Claude + OpenAI dual integration | Claude excels at text generation, OpenAI has best embedding model cost/quality ratio | Single provider cannot cover both use cases optimally |
| Nango Cloud | OAuth + token refresh + unified API for 4 different providers | Building 4 separate integrations increases maintenance burden significantly |

## Phase Breakdown

### Phase 0a: Research (this command)
- Resolve technology decisions (Plate Pro Potion template, Hocuspocus hosting)
- Validate Convex schema design with existing patterns
- Confirm AI budget allocation per feature

### Phase 0b: Potion Template Extraction (CRITICAL - blocks all other phases)
1. Clone Potion template to local reference directory
2. Audit component inventory (editor, sidebar, collaboration)
3. Adapt auth patterns (better-auth → Clerk)
4. Adapt database patterns (Prisma → Convex)
5. Adapt API patterns (tRPC → Convex functions)
6. Extract and adapt editor, toolbar, slash commands, blocks
7. Extract and adapt Hocuspocus client configuration

### Phase 1: Core Foundation (P1 User Stories)
1. Convex schema: workspaces, folders, documents, documentContent, resourcePermissions
2. Basic CRUD: Create/read/update workspace, folder, document
3. Plate Pro integration: Editor with basic blocks, auto-save (using Potion extraction)
4. Navigation: Sidebar tree, breadcrumbs, favorites, recents (using Potion extraction)
5. Publishing: Draft → Published workflow

### Phase 2: Real-Time Collaboration (P2 Story 3)
1. Hocuspocus server setup: YJS server, Docker config, deployment to Railway/Render/Fly.io
2. Hocuspocus client integration: Connect Plate.js YjsPlugin to self-hosted server
3. Cursor presence: Colored cursors with names (using Potion extraction)
4. Selection sharing: See what others are selecting
5. Conflict resolution: CRDT-based auto-merge via YJS

### Phase 3: Comments & Discussions (P2 Story 4)
1. Page-level comments
2. Inline comments on selections
3. Threading and @mentions
4. Resolve/archive comments
5. Emoji reactions

### Phase 4: Search (P2 Story 5)
1. Full-text search via Convex search index
2. Semantic search via OpenAI embeddings
3. Permission-filtered results
4. Search filters (workspace, date, author)

### Phase 5: Permissions (P2 Story 6)
1. RBAC implementation: read/write/admin
2. Permission inheritance
3. Override capabilities
4. Team-based grants
5. Draft isolation

### Phase 6: Version History (P3 Story 7)
1. Auto-versioning (every 5 min)
2. Manual version save
3. Version preview
4. Non-destructive restore

### Phase 7: AI Features (P3 Stories 8-9)
1. Summarize, translate, rephrase, expand commands
2. Content generation from prompts
3. Rate limiting and budget tracking
4. Streaming responses

### Phase 8: Embeds & Integrations (P3-P4 Stories 10-12)
1. YouTube, Vimeo, Loom embeds
2. Figma, Google Docs embeds
3. LMS bidirectional links
4. GitHub, Jira, Linear integrations (P4)
