# Tasks: Knowledge Base - Notion-like Collaborative Documentation Platform

**Input**: Design documents from `/specs/004-knowledge-base/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: NOT explicitly requested - test tasks excluded per template rules.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 0: Potion Template Extraction (Source Code Adaptation)

**Purpose**: Extract and adapt components from the purchased Plate Pro Potion template to our LMS stack (Clerk auth, Convex backend, existing design system)

**⚠️ CRITICAL**: This phase must complete BEFORE any other implementation. The Potion template provides ~40 hours of saved development time but requires adaptation from its stack (better-auth, Prisma, tRPC) to our stack (Clerk, Convex).

**Cost Savings**: ~$150/month saved by using self-hosted Hocuspocus instead of Liveblocks Cloud; ~$10-20/month for Hocuspocus hosting (Railway/Render/Fly.io)

### Template Analysis & Setup

- [ ] T000a Clone Potion template to `/potion-source/` for reference extraction (DO NOT commit - add to .gitignore)
- [ ] T000b Audit Potion component inventory: document all editor components, sidebar components, collaboration hooks, and utilities
- [ ] T000c Map Potion dependencies to project dependencies: identify conflicts and version mismatches

### Auth Adaptation (better-auth → Clerk)

- [ ] T000d Extract and adapt auth patterns: replace better-auth session checks with Clerk `useAuth()` / `getAuth()`
- [ ] T000e Update user context patterns: replace Potion's `useSession()` with project's existing Clerk patterns

### Database Adaptation (Prisma → Convex)

- [ ] T000f Map Prisma models to Convex schema: document equivalent table structures
- [ ] T000g Extract query patterns: convert Prisma queries to Convex query syntax
- [ ] T000h Extract mutation patterns: convert Prisma mutations to Convex mutation syntax

### API Adaptation (tRPC → Convex)

- [ ] T000i Map tRPC router structure to Convex function organization
- [ ] T000j Convert tRPC procedure patterns to Convex query/mutation/action patterns

### Editor Component Extraction

- [ ] T000k Extract core editor wrapper component (adapt styles to project design system)
- [ ] T000l Extract toolbar components (adapt to shadcn/ui patterns)
- [ ] T000m Extract slash command menu (adapt to existing command patterns)
- [ ] T000n Extract block components (headings, lists, tables, callouts, etc.)

### Collaboration Component Extraction

- [ ] T000o Extract Hocuspocus client configuration (adapt connection settings for self-hosted)
- [ ] T000p Extract cursor presence components (adapt user color/avatar display)
- [ ] T000q Extract awareness/typing indicator components

**Checkpoint**: All Potion components extracted and adapted to project stack - ready for Phase 1 integration

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and base configuration using Potion-extracted components with Hocuspocus self-hosted collaboration

- [ ] T001 Install Plate.js dependencies: `pnpm add @platejs/core @platejs/yjs @platejs/ai @platejs/dnd platejs` (use versions from Potion template package.json)
- [ ] T002 [P] Install Hocuspocus dependencies: `pnpm add @hocuspocus/provider @hocuspocus/server yjs y-protocols` (self-hosted YJS server - replaces Liveblocks)
- [ ] T003 [P] Install AI dependencies: `pnpm add openai @anthropic-ai/sdk`
- [ ] T004 Configure environment variables in `.env.local` (HOCUSPOCUS_URL, HOCUSPOCUS_SECRET, ANTHROPIC_API_KEY, OPENAI_API_KEY)
- [ ] T005 [P] Create Plate.js configuration in `src/lib/knowledge/plate-config.ts` (based on Potion extraction T000k-T000n)
- [ ] T006 [P] Create Hocuspocus client configuration in `src/lib/knowledge/hocuspocus-config.ts` (based on Potion extraction T000o)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 Add Knowledge Base schema tables to `convex/schema.ts` (kbWorkspaces, kbFolders, kbDocuments, kbDocumentContent)
- [ ] T008 Add permission schema to `convex/schema.ts` (kbResourcePermissions, kbAuditLogs)
- [ ] T009 Add engagement schema to `convex/schema.ts` (kbUserFavorites, kbUserRecents)
- [ ] T010 [P] Create KB auth helper in `convex/lib/kbAuth.ts` (checkPermission, requireKBAuth, getEffectivePermission)
- [ ] T011 [P] Create permission utility functions in `convex/knowledge/permissionHelpers.ts` (inheritPermission, getParentResource)
- [ ] T011a [S] Implement 1000 items per container validation in `convex/lib/kbValidation.ts` (checkContainerLimit helper for createDocument, createFolder mutations; clear error message when limit reached)
- [ ] T012 Run `npx convex dev` to validate schema and generate types

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Create and Edit Documents (Priority: P1) 🎯 MVP

**Goal**: Users can create, edit, and publish rich-text documents with auto-save

**Independent Test**: Create a document, add various content blocks (headings, lists, tables), and publish. Verify auto-save works.

### Backend: Convex Functions

- [ ] T013 [P] [US1] Create workspace queries in `convex/knowledge/workspaces.ts` (list, get, getBySlug)
- [ ] T014 [P] [US1] Create workspace mutations in `convex/knowledge/workspaces.ts` (create, update, archive, restore, transferOwnership)
- [ ] T015 [P] [US1] Create folder queries in `convex/knowledge/folders.ts` (list, get, getTree, getBreadcrumbs)
- [ ] T016 [P] [US1] Create folder mutations in `convex/knowledge/folders.ts` (create, update, move, reorder, archive, restore)
- [ ] T017 [P] [US1] Create document queries in `convex/knowledge/documents.ts` (list, get, getContent, getBreadcrumbs)
- [ ] T018 [P] [US1] Create document mutations in `convex/knowledge/documents.ts` (create, update, updateContent, publish, unpublish, move, archive)
- [ ] T019 [US1] Create content management in `convex/knowledge/content.ts` (updateContent with 10MB size validation, extractPlainText)

### Frontend: Editor Components (Potion Template Integration)

- [ ] T020 [US1] Integrate Potion editor wrapper in `src/components/knowledge/document-editor/index.tsx` (adapt from T000k extraction, connect to Convex)
- [ ] T021 [P] [US1] Integrate Potion toolbar in `src/components/knowledge/document-editor/toolbar.tsx` (adapt from T000l extraction, style to design system)
- [ ] T022 [P] [US1] Integrate Potion slash command menu in `src/components/knowledge/document-editor/slash-commands.tsx` (adapt from T000m extraction)
- [ ] T023 [P] [US1] Create custom LMS block components in `src/components/knowledge/document-editor/blocks/` (course-embed, lesson-embed, ai-block, integration-blocks); use Potion-extracted blocks (T000n) for standard blocks (heading, paragraph, list, table, callout, code, quote, divider, etc.)
- [ ] T024 [US1] Create auto-save hook in `src/hooks/knowledge/use-auto-save.ts` (5-second debounce, integrate with Potion patterns)
- [ ] T025 [US1] Create document hook in `src/hooks/knowledge/use-document.ts` (load document, track changes, integrate with Potion editor state)

### Frontend: Pages

- [ ] T026 [US1] Create KB layout in `src/app/(dashboard)/knowledge/layout.tsx`
- [ ] T027 [US1] Create KB home page in `src/app/(dashboard)/knowledge/page.tsx` (recent, favorites)
- [ ] T028 [US1] Create workspace page in `src/app/(dashboard)/knowledge/[workspaceId]/page.tsx`
- [ ] T029 [US1] Create folder page in `src/app/(dashboard)/knowledge/[workspaceId]/[folderId]/page.tsx`
- [ ] T030 [US1] Create document page in `src/app/(dashboard)/knowledge/doc/[documentId]/page.tsx`
- [ ] T031 [US1] Create document editor client component in `src/app/(dashboard)/knowledge/doc/[documentId]/editor.tsx`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Navigate and Organize Documents (Priority: P1) 🎯 MVP

**Goal**: Users can navigate hierarchical structure, star favorites, and view recent documents

**Independent Test**: Create workspace with folders, navigate via sidebar, star documents, view recents.

### Backend: Convex Functions

- [ ] T032 [P] [US2] Add favorites mutations in `convex/knowledge/documents.ts` (addFavorite, removeFavorite, recordAccess)
- [ ] T033 [P] [US2] Add favorites/recents queries in `convex/knowledge/documents.ts` (getFavorites, getRecent)
- [ ] T034 [US2] Add document reorder mutation in `convex/knowledge/documents.ts` (reorder with displayOrder)

### Frontend: Navigation Components (Potion Sidebar Integration)

- [ ] T035 [US2] Integrate Potion sidebar patterns in `src/components/knowledge/workspace-sidebar.tsx` (adapt Potion sidebar structure, connect to Convex queries)
- [ ] T036 [P] [US2] Integrate Potion document tree in `src/components/knowledge/document-tree.tsx` (adapt Potion tree component, style to design system)
- [ ] T037 [P] [US2] Create breadcrumbs component in `src/components/knowledge/breadcrumbs.tsx` (use Potion patterns if available)
- [ ] T038 [P] [US2] Create favorites section in `src/components/knowledge/favorites-section.tsx` (follow Potion sidebar section patterns)
- [ ] T039 [P] [US2] Create recents section in `src/components/knowledge/recents-section.tsx` (follow Potion sidebar section patterns)
- [ ] T040 [US2] Integrate Potion drag-and-drop tree reordering in `src/components/knowledge/document-tree.tsx` (adapt Potion DnD implementation)

**Checkpoint**: User Stories 1 AND 2 should both work independently - MVP complete!

---

## Phase 5: User Story 3 - Real-Time Collaboration (Priority: P2)

**Goal**: Multiple users can edit documents simultaneously with visible cursors and auto-sync

**Independent Test**: Open document in two browsers, verify changes sync in <100ms with visible cursors.

**Architecture**: Self-hosted Hocuspocus server (YJS over WebSocket) - adapted from Potion template

### Hocuspocus Server Setup

- [ ] T041 [US3] Create Hocuspocus server configuration in `hocuspocus/server.ts` (YJS document persistence, authentication, logging)
- [ ] T041a [US3] Create Hocuspocus Docker configuration in `hocuspocus/Dockerfile` and `docker-compose.yml` for local development
- [ ] T041b [US3] Configure Hocuspocus deployment to Railway/Render/Fly.io (~$10-20/month vs $150/month Liveblocks)

### Schema Update

- [ ] T042 [US3] Add collaboration schema to `convex/schema.ts` (kbDocumentCollaborators - for presence tracking, kbCollaborationSessions)

### Backend: Convex Functions

- [ ] T043 [P] [US3] Create collaboration queries in `convex/knowledge/collaboration.ts` (getRoom, getCollaborators, getEditingStatus)
- [ ] T044 [P] [US3] Create collaboration mutations in `convex/knowledge/collaboration.ts` (joinSession, leaveSession, updateCursor, updateSelection, setTyping)
- [ ] T045 [US3] Create Hocuspocus auth action in `convex/actions/hocuspocus.ts` (getHocuspocusToken with permission validation + 25-editor limit check); Architecture: Plate.js YjsPlugin → @hocuspocus/provider → Self-hosted Hocuspocus server

### Frontend: Collaboration Components (Potion Integration)

- [ ] T046 [US3] Integrate YjsPlugin with @hocuspocus/provider in `src/components/knowledge/document-editor/index.tsx` (adapt from Potion extraction T000o; Plate.js YjsPlugin → HocuspocusProvider → Self-hosted server)
- [ ] T047 [P] [US3] Integrate Potion cursor overlay in `src/components/knowledge/collaboration/cursors.tsx` (adapt from T000p extraction)
- [ ] T048 [P] [US3] Integrate Potion presence indicator in `src/components/knowledge/collaboration/presence.tsx` (adapt from T000p extraction)
- [ ] T049 [P] [US3] Integrate Potion awareness component in `src/components/knowledge/collaboration/awareness.tsx` (adapt from T000q extraction)
- [ ] T050 [US3] Create collaboration hook in `src/hooks/knowledge/use-collaboration.ts` (room join via Hocuspocus, presence updates, cursor color assignment algorithm - adapt Potion patterns)
- [ ] T050a [US3] Add 25 concurrent editor limit check in `src/hooks/knowledge/use-collaboration.ts` (Hocuspocus room connection limit)

**Checkpoint**: Real-time collaboration fully functional with cursor presence (self-hosted Hocuspocus)

---

## Phase 6: User Story 4 - Comment and Discuss (Priority: P2)

**Goal**: Users can add page-level and inline comments with threading and @mentions

**Independent Test**: Add comment on selection, reply to create thread, @mention user, resolve thread.

### Schema Update

- [ ] T051 [US4] Add comment schema to `convex/schema.ts` (kbDocumentComments, kbCommentMentions, kbCommentReactions)

### Backend: Convex Functions

- [ ] T052 [P] [US4] Create comment queries in `convex/knowledge/comments.ts` (list, get, getInline, getUnreadMentions)
- [ ] T053 [P] [US4] Create comment mutations in `convex/knowledge/comments.ts` (create, update, deleteComment, resolve, unresolve)
- [ ] T054 [US4] Create reaction mutations in `convex/knowledge/comments.ts` (addReaction, removeReaction)
- [ ] T055 [US4] Create mention handling in `convex/knowledge/comments.ts` (extractMentions, notifyMentionedUsers, markMentionRead)

### Frontend: Comment Components

- [ ] T056 [US4] Create comment thread component in `src/components/knowledge/comments/comment-thread.tsx`
- [ ] T057 [P] [US4] Create inline comment marker in `src/components/knowledge/comments/inline-comment.tsx`
- [ ] T058 [P] [US4] Create comment input with mentions in `src/components/knowledge/comments/comment-input.tsx`
- [ ] T059 [P] [US4] Create comment sidebar panel in `src/components/knowledge/comments/comment-sidebar.tsx`
- [ ] T060 [US4] Create comment hook in `src/hooks/knowledge/use-comments.ts`

**Checkpoint**: Comments and discussions fully functional

---

## Phase 7: User Story 5 - Search Documents (Priority: P2)

**Goal**: Users can search by keyword and natural language with Cmd+K command palette

**Independent Test**: Press Cmd+K, search by keyword, toggle AI mode for semantic search, verify results.

### Schema Update

- [ ] T061 [US5] Add search schema to `convex/schema.ts` (kbDocumentEmbeddings with vector index, kbSearchHistory)

### Backend: Convex Functions

- [ ] T062 [P] [US5] Create search queries in `convex/knowledge/search.ts` (documents, quick, global, suggestions, getRecent)
- [ ] T063 [P] [US5] Create search mutations in `convex/knowledge/search.ts` (recordSearch, clearHistory)
- [ ] T064 [US5] Create embedding action in `convex/actions/embeddings.ts` (generateEmbedding with OpenAI text-embedding-3-small)
- [ ] T065 [US5] Create semantic search in `convex/knowledge/search.ts` (vectorSearch, askAI)

### Frontend: Search Components

- [ ] T066 [US5] Create command palette in `src/components/knowledge/ai/search-modal.tsx`
- [ ] T067 [P] [US5] Create search results component in `src/components/knowledge/search-results.tsx`
- [ ] T068 [P] [US5] Create search filters in `src/components/knowledge/search-filters.tsx`
- [ ] T069 [US5] Create search page in `src/app/(dashboard)/knowledge/search/page.tsx`
- [ ] T070 [US5] Create search hook in `src/hooks/knowledge/use-search.ts`
- [ ] T070a [P3] [US5] Implement message search integration in `convex/knowledge/search.ts` (searchMessages, mergeMultiSourceResults) - Phase 2 enhancement after MVP

**Checkpoint**: Full-text and semantic search operational (documents + courses MVP; messages P3)

---

## Phase 8: User Story 6 - Manage Permissions (Priority: P2)

**Goal**: Admins can control access with RBAC, inheritance, and overrides

**Independent Test**: Set workspace default, add team permission, override on folder, verify access enforcement.

### Backend: Convex Functions

- [ ] T071 [P] [US6] Create permission queries in `convex/knowledge/permissions.ts` (check, getEffective, list, getAccessList, searchGrantees)
- [ ] T072 [P] [US6] Create permission mutations in `convex/knowledge/permissions.ts` (grant, update, revoke, setDefault)
- [ ] T073 [US6] Create inheritance mutations in `convex/knowledge/permissions.ts` (breakInheritance, restoreInheritance)
- [ ] T074 [US6] Create audit logging in `convex/knowledge/permissions.ts` (logPermissionChange with kbAuditLogs)

### Frontend: Permission Components

- [ ] T075 [US6] Create permission dialog in `src/components/knowledge/permissions/permission-dialog.tsx`
- [ ] T076 [P] [US6] Create permission badge in `src/components/knowledge/permissions/permission-badge.tsx`
- [ ] T077 [P] [US6] Create access list component in `src/components/knowledge/permissions/access-list.tsx`
- [ ] T078 [US6] Create permission hook in `src/hooks/knowledge/use-permissions.ts`

**Checkpoint**: RBAC permissions fully functional with inheritance

---

## Phase 9: User Story 7 - Version History (Priority: P3)

**Goal**: Users can view version history, preview, and restore previous versions

**Independent Test**: Edit document over time, view version list, preview old version, restore it.

### Schema Update

- [ ] T079 [US7] Add version schema to `convex/schema.ts` (kbDocumentVersions)

### Backend: Convex Functions

- [ ] T080 [P] [US7] Create version queries in `convex/knowledge/versions.ts` (list, get, compare)
- [ ] T081 [P] [US7] Create version mutations in `convex/knowledge/versions.ts` (create, restore, updateDescription, protect)
- [ ] T082 [US7] Create auto-versioning internal in `convex/knowledge/versions.ts` (createAutoVersion - every 5 min)
- [ ] T083 [M] [US7] Create version retention system in `convex/crons.ts` and `convex/knowledge/versions.ts`: auto-snapshot every 5 min if changes; retention policy: 7 days full history → 30 days 1/day snapshots → protected versions retained indefinitely; cron job for cleanup; "protect version" mutation for UI action

### Frontend: Version Components

- [ ] T084 [US7] Create version history page in `src/app/(dashboard)/knowledge/doc/[documentId]/history/page.tsx`
- [ ] T085 [P] [US7] Create version list component in `src/components/knowledge/versions/version-list.tsx`
- [ ] T086 [P] [US7] Create version preview component in `src/components/knowledge/versions/version-preview.tsx`
- [ ] T087 [US7] Create version hook in `src/hooks/knowledge/use-versions.ts`

**Checkpoint**: Version history with restore fully operational

---

## Phase 10: User Story 8 - AI Editor Commands (Priority: P3)

**Goal**: Users can summarize, translate, rephrase, and expand selected text

**Independent Test**: Select text, choose AI command, verify streaming response, accept/reject result.

### Schema Update

- [ ] T088 [US8] Add AI usage schema to `convex/schema.ts` (kbAIUsage for rate limiting)

### Backend: Convex Functions

- [ ] T089 [P] [US8] Create AI queries in `convex/knowledge/ai.ts` (getUsage, checkAvailability)
- [ ] T090 [US8] Create AI command action in `convex/actions/aiCommands.ts` (executeCommand with Claude Haiku)
- [ ] T091 [US8] Create rate limiting in `convex/knowledge/ai.ts` (checkRateLimit, incrementUsage - 100 commands/month)
- [ ] T092 [US8] Create AI result mutations in `convex/knowledge/ai.ts` (acceptResult, rejectResult - for tracking)

### Frontend: AI Components

- [ ] T093 [US8] Create AI menu component in `src/components/knowledge/ai/ai-menu.tsx`
- [ ] T094 [P] [US8] Create AI response component in `src/components/knowledge/ai/ai-response.tsx`
- [ ] T095 [US8] Create AI commands hook in `src/hooks/knowledge/use-ai-commands.ts`

**Checkpoint**: AI editor commands operational with rate limiting

---

## Phase 11: User Story 9 - AI Content Generation (Priority: P3)

**Goal**: Users can generate content from prompts via /ai command

**Independent Test**: Type /ai, enter prompt, verify streaming content, insert into document.

### Backend: Convex Functions

- [ ] T096 [US9] Create content generation action in `convex/actions/aiCommands.ts` (generateContent with Claude Sonnet)
- [ ] T097 [US9] Add generation rate limiting in `convex/knowledge/ai.ts` (50 generations/month)

### Frontend: AI Components

- [ ] T098 [US9] Create AI generation prompt in `src/components/knowledge/ai/ai-prompt.tsx`
- [ ] T099 [US9] Add /ai slash command in `src/components/knowledge/document-editor/slash-commands.tsx`
- [ ] T100 [US9] Create AI generation hook in `src/hooks/knowledge/use-ai-generation.ts`

**Checkpoint**: AI content generation operational

---

## Phase 12: User Story 10 - Embed External Content (Priority: P3)

**Goal**: Users can embed YouTube, Figma, and Google Docs via URL paste

**Independent Test**: Paste YouTube URL, verify video embed. Paste Figma URL, verify preview.

### Backend: Convex Functions

- [ ] T101 [P] [US10] Create embed detection in `convex/knowledge/integrations.ts` (detectEmbed - provider URL patterns)
- [ ] T102 [US10] Create oEmbed fetch action in `convex/actions/integrations.ts` (fetchOEmbed for YouTube, Vimeo, Loom)

### Frontend: Embed Blocks

- [ ] T103 [P] [US10] Create YouTube embed block in `src/components/knowledge/document-editor/blocks/youtube-embed.tsx`
- [ ] T104 [P] [US10] Create Figma embed block in `src/components/knowledge/document-editor/blocks/figma-embed.tsx`
- [ ] T105 [P] [US10] Create Google Docs embed block in `src/components/knowledge/document-editor/blocks/google-embed.tsx`
- [ ] T106 [US10] Add URL paste handler in `src/components/knowledge/document-editor/index.tsx`

**Checkpoint**: External embeds operational

---

## Phase 13: User Story 11 - Link Documents to LMS Content (Priority: P3)

**Goal**: Users can link documents to courses/lessons with bidirectional display

**Independent Test**: Link document to course, verify link appears on both document and course page.

### Schema Update

- [ ] T107 [US11] Add LMS link schema to `convex/schema.ts` (kbDocumentLinks)

### Backend: Convex Functions

- [ ] T108 [P] [US11] Create link queries in `convex/knowledge/integrations.ts` (getDocumentLinks, getCourseDocuments, getLessonDocuments, searchLMSContent)
- [ ] T109 [US11] Create link mutations in `convex/knowledge/integrations.ts` (createDocumentLink, updateDocumentLink, removeDocumentLink)

### Frontend: LMS Integration Components

- [ ] T110 [US11] Create link dialog in `src/components/knowledge/integrations/link-dialog.tsx`
- [ ] T111 [P] [US11] Create linked documents section in `src/components/knowledge/integrations/linked-documents.tsx`
- [ ] T112 [US11] Add @course/@lesson mention in `src/components/knowledge/document-editor/slash-commands.tsx`

**Checkpoint**: LMS integration operational

---

## Phase 14: User Story 12 - Advanced Integrations (Priority: P4)

**Goal**: Admins can connect GitHub/Jira/Linear/MS365 for live data embeds

**Independent Test**: Connect GitHub via OAuth, embed issue, verify live status display.

### Dependencies

- [ ] T113 [US12] Install Nango dependency: `pnpm add @nangohq/node`

### Schema Update

- [ ] T114 [US12] Add external connection schema to `convex/schema.ts` (kbExternalConnections)

### Backend: Convex Functions

- [ ] T115 [P] [US12] Create OAuth queries in `convex/knowledge/integrations.ts` (getConnections, getOAuthUrl)
- [ ] T116 [P] [US12] Create OAuth mutations in `convex/knowledge/integrations.ts` (completeOAuth, disconnectIntegration)
- [ ] T117 [US12] Create GitHub fetch action in `convex/actions/integrations.ts` (fetchGitHubIssue via Nango)
- [ ] T118 [US12] Create Jira fetch action in `convex/actions/integrations.ts` (fetchJiraIssue via Nango)
- [ ] T119 [US12] Create Linear fetch action in `convex/actions/integrations.ts` (fetchLinearIssue via Nango)

### Frontend: Integration Components

- [ ] T120 [US12] Create OAuth callback page in `src/app/(dashboard)/knowledge/integrations/callback/page.tsx`
- [ ] T121 [P] [US12] Create GitHub issue embed in `src/components/knowledge/document-editor/blocks/github-embed.tsx`
- [ ] T122 [P] [US12] Create Jira issue embed in `src/components/knowledge/document-editor/blocks/jira-embed.tsx`
- [ ] T123 [P] [US12] Create Linear issue embed in `src/components/knowledge/document-editor/blocks/linear-embed.tsx`
- [ ] T124 [US12] Create integrations settings page in `src/app/(dashboard)/settings/integrations/page.tsx`

**Checkpoint**: External integrations operational

---

## Phase 15: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T125 [P] Add loading skeletons in `src/components/knowledge/skeletons/` (document-skeleton.tsx, sidebar-skeleton.tsx)
- [ ] T126 [P] Add error boundaries and toast notifications throughout KB components
- [ ] T127 [P] Add keyboard shortcuts in `src/components/knowledge/keyboard-shortcuts.tsx`
- [ ] T128 Security hardening: validate all permission checks in Convex functions
- [ ] T129 Add AI budget tracking alerts in `convex/knowledge/ai.ts` (80% warning, 95% hard stop)
- [ ] T130 Verify document size validation exists in T019 (8MB warning, 10MB hard stop) - no duplicate implementation needed
- [ ] T131 Add archive cleanup cron in `convex/crons.ts` (permanent delete after 90 days)
- [ ] T132 Run `pnpm typecheck` and fix any TypeScript errors
- [ ] T133 Run `pnpm lint` and fix any ESLint issues
- [ ] T134 Validate against quickstart.md quality gates

---

## Dependencies & Execution Order

### Phase Dependencies

- **Potion Extraction (Phase 0)**: No dependencies - can start immediately; BLOCKS all other phases
- **Setup (Phase 1)**: Depends on Phase 0 completion - uses extracted Potion components
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 + US2 (P1) form the MVP - complete these first
  - US3-US6 (P2) can proceed in parallel after US1+US2
  - US7-US11 (P3) can proceed in parallel after foundation
  - US12 (P4) is optional/future scope
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Priority | Depends On | Can Start After |
|-------|----------|------------|-----------------|
| US1 - Create & Edit | P1 | Foundation | Phase 2 |
| US2 - Navigate & Organize | P1 | US1 (partial) | Phase 2 |
| US3 - Real-Time Collaboration | P2 | US1 | Phase 3 |
| US4 - Comments | P2 | US1 | Phase 3 |
| US5 - Search | P2 | US1 | Phase 3 |
| US6 - Permissions | P2 | US1 | Phase 3 |
| US7 - Version History | P3 | US1 | Phase 3 |
| US8 - AI Commands | P3 | US1 | Phase 3 |
| US9 - AI Generation | P3 | US8 | Phase 10 |
| US10 - Embeds | P3 | US1 | Phase 3 |
| US11 - LMS Links | P3 | US1 | Phase 3 |
| US12 - Integrations | P4 | US1, US10 | Phase 12 |

### Parallel Opportunities

**After Phase 2 (Foundation), these can run in parallel:**
- US3 (Collaboration) + US4 (Comments) + US5 (Search) + US6 (Permissions)
- US7 (Versions) + US8 (AI Commands) + US10 (Embeds) + US11 (LMS Links)

**Within each story:**
- All tasks marked [P] can run in parallel
- Backend tasks can run in parallel with other backend tasks
- Frontend tasks can run in parallel with other frontend tasks

---

## Parallel Example: User Story 1

```bash
# Launch all backend tasks in parallel:
Task: "Create workspace queries in convex/knowledge/workspaces.ts"
Task: "Create workspace mutations in convex/knowledge/workspaces.ts"
Task: "Create folder queries in convex/knowledge/folders.ts"
Task: "Create folder mutations in convex/knowledge/folders.ts"
Task: "Create document queries in convex/knowledge/documents.ts"
Task: "Create document mutations in convex/knowledge/documents.ts"

# Then, frontend components in parallel:
Task: "Create editor toolbar in src/components/knowledge/document-editor/toolbar.tsx"
Task: "Create slash command menu in src/components/knowledge/document-editor/slash-commands.tsx"
Task: "Create block components in src/components/knowledge/document-editor/blocks/"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 0: Potion Template Extraction (CRITICAL - blocks all other phases)
2. Complete Phase 1: Setup (using extracted Potion components + Hocuspocus deps)
3. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
4. Complete Phase 3: User Story 1 - Create & Edit Documents
5. Complete Phase 4: User Story 2 - Navigate & Organize
6. **STOP and VALIDATE**: Test US1 + US2 independently
7. Deploy/demo if ready - **this is a functional documentation platform!**

### Incremental Delivery After MVP

1. **Iteration 2**: Add US3 (Collaboration) + US4 (Comments) → Deploy
2. **Iteration 3**: Add US5 (Search) + US6 (Permissions) → Deploy
3. **Iteration 4**: Add US7 (Versions) + US8-9 (AI) → Deploy
4. **Iteration 5**: Add US10-11 (Embeds + LMS) → Deploy
5. **Future**: US12 (External Integrations) when business need arises

### Parallel Team Strategy

With multiple developers after Foundation complete:

- **Developer A**: US1 → US3 → US5
- **Developer B**: US2 → US4 → US6
- **Developer C**: US7 → US8/9 → US10/11

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after completion
- Run `npx convex dev` after schema changes to regenerate types
- AI features require valid API keys in `.env.local`
- **Potion Template**: Purchased Plate Pro template - extract components in Phase 0 before implementation
- **Hocuspocus (Self-hosted)**: Replaces Liveblocks Cloud; ~$10-20/month hosting vs $150/month subscription
- **Stack Adaptation Required**: Potion uses better-auth/Prisma/tRPC → adapt to Clerk/Convex
- Total AI budget ceiling: 150 EUR/month

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 156 |
| **Phase 0 Tasks (Potion Extraction)** | 17 (T000a-T000q) |
| **Setup Tasks** | 6 |
| **Foundational Tasks** | 7 (includes T011a item limit validation) |
| **US1 Tasks** | 19 |
| **US2 Tasks** | 9 |
| **US3 Tasks** | 13 (includes Hocuspocus server setup T041-T041b, T050a) |
| **US4 Tasks** | 10 |
| **US5 Tasks** | 10 (includes T070a message search P3) |
| **US6 Tasks** | 8 |
| **US7 Tasks** | 9 |
| **US8 Tasks** | 8 |
| **US9 Tasks** | 5 |
| **US10 Tasks** | 6 |
| **US11 Tasks** | 6 |
| **US12 Tasks** | 12 |
| **Polish Tasks** | 10 |
| **Parallel Tasks [P]** | 57 (~37%) |

**Phase 0 (Potion Extraction)**: 17 tasks - MUST complete before all other phases
**MVP Scope**: Phases 0-4 (Potion + US1 + US2) = 58 tasks
**P2 Features**: Phases 5-8 = 40 tasks (includes Hocuspocus self-hosted collaboration)
**P3 Features**: Phases 9-13 = 44 tasks (includes message search enhancement)
**P4 Features**: Phase 14 = 12 tasks

**Cost Comparison**:
- Liveblocks Cloud: ~$150/month subscription
- Hocuspocus Self-hosted: ~$10-20/month (Railway/Render/Fly.io)
- **Savings**: ~$130/month + ~40 hours dev time from Potion template
