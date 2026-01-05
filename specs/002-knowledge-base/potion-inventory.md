# Potion Template Inventory

**Analysis Date**: 2026-01-03
**Template Location**: `/Users/alexisdupre/potion-template/`
**Project Code Size**: ~16,600 TypeScript lines across 426 files
**Target Integration**: Onboarding BDR v2 Knowledge Base

---

## Executive Summary

The Potion template provides a **production-ready collaborative documentation platform** with:
- ✅ 52 editor plugins (50+ block types)
- ✅ 104 UI components
- ✅ Self-hosted Hocuspocus + YJS collaboration
- ✅ Version history system
- ✅ Export functionality (PDF/HTML/Markdown)
- ✅ AI integration framework

**Estimated Savings**: ~40 hours of development time
**Migration Effort**: ~85 hours to adapt auth/database layers

---

## 1. Technology Stack Comparison

| Layer | Potion Template | Our Stack | Adaptation Required |
|-------|-----------------|-----------|---------------------|
| **Framework** | Next.js 16, React 19 | Next.js 15, React 19 | Minor version differences |
| **Auth** | better-auth | Clerk | ⚠️ Full replacement |
| **Database** | Prisma + PostgreSQL | Convex | ⚠️ Full replacement |
| **API** | tRPC | Convex functions | ⚠️ Full replacement |
| **Editor** | Plate Pro 52 | Plate Pro 52 | ✅ Compatible |
| **Collaboration** | Hocuspocus + YJS | Hocuspocus + YJS | ✅ Compatible |
| **UI** | shadcn/ui + Radix | shadcn/ui + Radix | ✅ Compatible |
| **Styling** | Tailwind CSS 4 | Tailwind CSS 4 | ✅ Compatible |
| **State** | Jotai + Zustand + React Query | Jotai + Convex hooks | 🔄 Partial adaptation |

---

## 2. Prisma Schema → Convex Mapping

### Current Prisma Models

| Prisma Model | Fields | Convex Equivalent |
|--------------|--------|-------------------|
| **User** | id, email, name, image, role, username | Use existing `users` table |
| **Session** | id, token, expiresAt, userId | Clerk handles sessions |
| **Account** | OAuth tokens, provider info | Clerk handles OAuth |
| **Document** | id, title, content, contentRich, yjsSnapshot, isPublished, isArchived, parentDocumentId | `kbDocuments` |
| **DocumentVersion** | id, documentId, title, contentRich | `kbDocumentVersions` |
| **Discussion** | id, documentId, documentContent, isResolved | `kbDocumentComments` (type: discussion) |
| **Comment** | id, discussionId, content, contentRich | `kbDocumentComments` (type: reply) |
| **File** | id, url, size, type, documentId | `kbFiles` or existing file storage |

### Enums
- `UserRole`: USER | ADMIN | SUPERADMIN → Use Clerk roles
- `TextStyle`: DEFAULT | SERIF | MONO → Store in document settings

---

## 3. Editor Components (52 Plugins + 104 UI)

### 3.1 Plugin Kits (52 total)

**Path**: `/potion-template/src/registry/components/editor/plugins/`

#### Basic Content (6 plugins)
| Plugin | Purpose | Extract Priority |
|--------|---------|------------------|
| `basic-blocks-kit.tsx` | Paragraph, heading, blockquote | P1 |
| `basic-marks-kit.tsx` | Bold, italic, underline, strikethrough | P1 |
| `basic-nodes-kit.tsx` | Heading levels | P1 |
| `paragraph-kit.tsx` | Paragraph blocks | P1 |
| `heading-kit.tsx` | H1-H6 headings | P1 |
| `font-kit.tsx` | Font family, size, color | P2 |

#### Block Elements (10 plugins)
| Plugin | Purpose | Extract Priority |
|--------|---------|------------------|
| `list-kit.tsx` | Ordered/unordered lists | P1 |
| `table-kit.tsx` | Tables with cell editing | P1 |
| `code-block-kit.tsx` | Code with syntax highlighting | P1 |
| `callout-kit.tsx` | Info/warning/success callouts | P1 |
| `toggle-kit.tsx` | Collapsible blocks | P2 |
| `column-kit.tsx` | Two-column layouts | P2 |
| `blockquote-kit.tsx` | Block quotes | P1 |
| `horizontal-rule-kit.tsx` | Dividers | P1 |
| `indent-kit.tsx` | Block indentation | P1 |
| `exit-break-kit.tsx` | Smart block exit | P1 |

#### Media & Embeds (8 plugins)
| Plugin | Purpose | Extract Priority |
|--------|---------|------------------|
| `media-kit.tsx` | Images, videos, audio, embeds | P1 |
| `emoji-kit.tsx` | Emoji picker | P2 |
| `date-kit.tsx` | Inline dates | P3 |
| `math-kit.tsx` | LaTeX equations | P3 |
| `link-kit.tsx` | URL links with toolbar | P1 |
| `mention-kit.tsx` | @mentions | P2 |
| `media-placeholder-kit.tsx` | Upload placeholders | P1 |
| `media-embed-kit.tsx` | External embeds | P2 |

#### Editing Features (15 plugins)
| Plugin | Purpose | Extract Priority |
|--------|---------|------------------|
| `slash-kit.tsx` | Slash command menu | P1 |
| `block-menu-kit.tsx` | Block insertion menu | P1 |
| `block-selection-kit.tsx` | Multi-block selection | P1 |
| `block-placeholder-kit.tsx` | Empty state prompts | P1 |
| `autoformat-kit.tsx` | Markdown shortcuts | P1 |
| `markdown-kit.tsx` | MD parsing/export | P2 |
| `docx-kit.tsx` | DOCX import/export | P3 |
| `floating-toolbar-kit.tsx` | Context toolbar | P1 |
| `dnd-kit.tsx` | Drag-and-drop | P1 |
| `cursor-overlay-kit.tsx` | Remote cursors | P1 |
| `selection-kit.tsx` | Selection utilities | P1 |
| `toc-kit.tsx` | Table of contents | P2 |
| `copilot-kit.tsx` | IDE autocomplete | P3 |
| `reset-node-kit.tsx` | Reset block type | P1 |
| `soft-break-kit.tsx` | Soft line breaks | P1 |

#### Collaboration & Comments (8 plugins)
| Plugin | Purpose | Extract Priority |
|--------|---------|------------------|
| `comment-kit.tsx` | Inline comments | P2 |
| `discussion-kit.tsx` | Discussion threads | P2 |
| `suggestion-kit.tsx` | Tracked changes | P3 |
| `ai-kit.tsx` | AI commands | P3 |

### 3.2 UI Components (104 total)

**Path**: `/potion-template/src/registry/ui/`

#### Node Components (16)
- `paragraph-node.tsx`, `heading-node.tsx`, `blockquote-node.tsx`
- `code-block-node.tsx`, `list-node.tsx`, `table-node.tsx`
- `callout-node.tsx`, `toggle-node.tsx`, `horizontal-rule-node.tsx`
- `column-node.tsx`, `date-node.tsx`, `link-node.tsx`
- `mention-node.tsx`, `emoji-node.tsx`, `equation-node.tsx`, `code-node.tsx`

#### Media Nodes (8)
- `media-image-node.tsx`, `media-video-node.tsx`, `media-audio-node.tsx`
- `media-file-node.tsx`, `media-embed-node.tsx`, `media-placeholder-node.tsx`
- `media-preview-dialog.tsx`, `media-upload-toast.tsx`

#### Collaboration UI (12)
- `comment-node.tsx`, `comment.tsx`, `comment-toolbar-button.tsx`
- `block-discussion.tsx`, `floating-discussion.tsx`
- `block-suggestion.tsx`, `suggestion-node.tsx`, `suggestion-toolbar-button.tsx`
- `remote-cursor-overlay.tsx`, `cursor-overlay.tsx`
- `ai-node.tsx`, `ai-menu.tsx`

#### Menus & Toolbars (8)
- `toolbar.tsx`, `floating-toolbar.tsx`, `link-toolbar.tsx`
- `media-toolbar.tsx`, `block-context-menu.tsx`, `block-menu.tsx`
- `block-draggable.tsx`, `block-selection.tsx`

#### Static Versions (16)
- All node components have `-static.tsx` versions for read-only mode

---

## 4. Sidebar & Navigation Components

**Path**: `/potion-template/src/components/sidebar/`

| Component | Purpose | Adaptation Needed |
|-----------|---------|-------------------|
| `sidebar.tsx` | Main navigation panel | Replace tRPC with Convex |
| `document-list.tsx` | Recursive document tree | Replace Prisma queries |
| `nav-item.tsx` | Single nav item | Minor styling |
| `sidebar-switcher.tsx` | User/workspace switcher | Replace with Clerk user menu |
| `trash-box.tsx` | Archived documents | Replace tRPC mutations |

---

## 5. Navbar & Document Toolbar

**Path**: `/potion-template/src/components/navbar/`

| Component | Purpose | Adaptation Needed |
|-----------|---------|-------------------|
| `navbar.tsx` | Top navigation | Replace auth checks |
| `document-menu.tsx` | Settings dropdown | Minor changes |
| `document-toolbar.tsx` | Edit/view controls | Replace mutations |
| `document-share.tsx` | Share dialog | Replace with Convex |
| `document-banner.tsx` | Draft/published status | Minor changes |
| `nav-title.tsx` | Title editor | Replace mutation |
| `export-dialog.tsx` | PDF/HTML export | Keep Hono routes |
| `import-dialog.tsx` | Document import | Replace with Convex |

---

## 6. Collaboration Infrastructure

### 6.1 Hocuspocus Server

**Path**: `/potion-template/src/server/yjs/`

| File | Purpose | Adaptation |
|------|---------|------------|
| `server.ts` | Server config (port 4444) | Deploy to Railway/Render |
| `auth.ts` | Auth from headers | Replace with Clerk JWT |
| `document.ts` | YJS snapshot load/save | Replace Prisma with Convex |
| `types.ts` | TypeScript types | Keep as-is |

**Current Stack**:
- Redis for Hocuspocus state persistence
- PostgreSQL for YJS snapshots (via Prisma)
- Debounce: 2000ms, max: 10000ms

**Target Stack**:
- Redis for Hocuspocus state (keep)
- Convex for YJS snapshots
- Same debounce settings

### 6.2 Collaboration UI

| Component | Path | Adaptation |
|-----------|------|------------|
| `remote-cursor-overlay.tsx` | `/registry/ui/` | Compatible |
| `floating-discussion.tsx` | `/registry/ui/` | Replace tRPC |
| `block-discussion.tsx` | `/registry/ui/` | Replace tRPC |
| `comment.tsx` | `/registry/ui/` | Replace tRPC |

---

## 7. Version History System

**Path**: `/potion-template/src/components/editor/version-history/`

| Component | Purpose |
|-----------|---------|
| `version-history-panel.tsx` | Version list with timestamps |
| `version-history-modal.tsx` | Full-screen version viewer |
| `version-plate.tsx` | Read-only editor for version |
| `diff-plate.tsx` | Side-by-side diff |
| `diff-plugin.ts` | Diff highlighting |
| `chunk-node.tsx` | Unchanged chunks |
| `diff-node.tsx` | Changed chunks |

---

## 8. AI Integration

**Path**: `/potion-template/src/server/hono/routes/ai.ts`

| Command | Model | Purpose |
|---------|-------|---------|
| `edit` | Claude Sonnet | Rephrase, shorten, expand |
| `generate` | Claude Sonnet | Content from prompt |
| `comment` | Claude Haiku | Summarize selection |
| `complete` | Claude Haiku | Autocomplete |

**Keep**: Hono routes with AI SDK
**Add**: Clerk auth middleware
**Add**: Convex rate limiting

---

## 9. tRPC → Convex Migration Map

### Document Router
| tRPC Procedure | Convex Function |
|----------------|-----------------|
| `documents.useQuery()` | `useQuery(api.knowledge.documents.list)` |
| `byId.useQuery()` | `useQuery(api.knowledge.documents.get)` |
| `create.useMutation()` | `useMutation(api.knowledge.documents.create)` |
| `update.useMutation()` | `useMutation(api.knowledge.documents.update)` |
| `updateContent.useMutation()` | `useMutation(api.knowledge.documents.updateContent)` |
| `archive.useMutation()` | `useMutation(api.knowledge.documents.archive)` |
| `restore.useMutation()` | `useMutation(api.knowledge.documents.restore)` |
| `publish.useMutation()` | `useMutation(api.knowledge.documents.publish)` |

### Comment Router
| tRPC Procedure | Convex Function |
|----------------|-----------------|
| `comments.useQuery()` | `useQuery(api.knowledge.comments.list)` |
| `createDiscussion.useMutation()` | `useMutation(api.knowledge.comments.createDiscussion)` |
| `createComment.useMutation()` | `useMutation(api.knowledge.comments.create)` |
| `editComment.useMutation()` | `useMutation(api.knowledge.comments.update)` |
| `deleteComment.useMutation()` | `useMutation(api.knowledge.comments.remove)` |

### Version Router
| tRPC Procedure | Convex Function |
|----------------|-----------------|
| `versions.useQuery()` | `useQuery(api.knowledge.versions.list)` |
| `createVersion.useMutation()` | `useMutation(api.knowledge.versions.create)` |
| `restoreVersion.useMutation()` | `useMutation(api.knowledge.versions.restore)` |

---

## 10. Auth Migration Map

### better-auth → Clerk

| better-auth Pattern | Clerk Replacement |
|---------------------|-------------------|
| `useSession()` | `useUser()` + `useAuth()` |
| `getAuthUser()` (RSC) | `auth()` from `@clerk/nextjs/server` |
| `session.user.id` | `user.id` from Clerk |
| `session.user.role` | `user.publicMetadata.role` or Clerk Organizations |
| `protectedProcedure` | Convex `requireAuth()` pattern |

### Auth Hooks to Replace

| Current File | Current Hook | Replacement |
|--------------|--------------|-------------|
| `useSession.ts` | `useSession()` | `useUser()` |
| `useCurrentUser.ts` | `useCurrentUser()` | `useUser()` |
| `useAuthGuard.ts` | `useAuthGuard()` | Clerk middleware |
| `getAuthUser.ts` | `getAuthUser()` | `auth()` |

---

## 11. Extraction Checklist

### Phase 0b Tasks

#### T000k: Editor Core (P1)
- [ ] Copy `plate-editor.tsx` → `src/components/knowledge/editor/`
- [ ] Copy `plate-provider.tsx` → `src/components/knowledge/editor/`
- [ ] Copy `editor-kit-app.tsx` → `src/components/knowledge/editor/`
- [ ] Remove tRPC/Prisma dependencies

#### T000l: Toolbar (P1)
- [ ] Copy `toolbar.tsx` → `src/components/knowledge/editor/`
- [ ] Copy `floating-toolbar.tsx` → `src/components/knowledge/editor/`
- [ ] Adapt to design system

#### T000m: Slash Commands (P1)
- [ ] Copy `slash-kit.tsx` → `src/components/knowledge/editor/plugins/`
- [ ] Copy `block-menu.tsx` → `src/components/knowledge/editor/`
- [ ] Adapt command list for LMS context

#### T000n: Block Components (P1)
- [ ] Copy all 16 node components → `src/registry/ui/`
- [ ] Copy all 8 media components → `src/registry/ui/`
- [ ] Update imports to use project paths

#### T000o: Hocuspocus Client (P1)
- [ ] Copy `hocuspocus-config.ts` → `src/lib/knowledge/`
- [ ] Update server URL from env
- [ ] Add Clerk token for auth

#### T000p: Cursor Presence (P2)
- [ ] Copy `remote-cursor-overlay.tsx` → `src/components/knowledge/collaboration/`
- [ ] Copy `cursor-overlay.tsx` → `src/components/knowledge/collaboration/`
- [ ] Integrate with Clerk user info

#### T000q: Awareness Components (P2)
- [ ] Copy `floating-discussion.tsx` → `src/components/knowledge/collaboration/`
- [ ] Replace tRPC with Convex subscriptions

---

## 12. Dependency Decisions

### Keep (No Changes)
```
✅ @platejs/* (editor core)
✅ @hocuspocus/provider (client)
✅ yjs, y-protocols (CRDT)
✅ @radix-ui/* (primitives)
✅ lucide-react (icons)
✅ cmdk (command palette)
✅ jotai (local state)
✅ ai, @ai-sdk/react (AI)
✅ puppeteer (PDF export)
```

### Replace
```
❌ better-auth → Clerk
❌ @prisma/client → Convex
❌ @trpc/react-query → Convex hooks
❌ @tanstack/react-query → Convex real-time
```

### Add
```
➕ @clerk/nextjs (auth)
➕ convex (backend)
```

---

## 13. File Statistics

| Category | File Count | Lines of Code |
|----------|------------|---------------|
| Editor plugins | 52 | ~4,500 |
| UI components | 104 | ~4,000 |
| App components | 50 | ~3,200 |
| Server functions | 20+ | ~2,500 |
| Pages & layouts | 15 | ~1,200 |
| Hooks | 30+ | ~1,500 |
| **TOTAL** | **426** | **~16,600** |

---

## 14. Migration Timeline

| Task | Effort | Priority |
|------|--------|----------|
| Auth adaptation (better-auth → Clerk) | 20 hours | P1 |
| Database migration (Prisma → Convex) | 30 hours | P1 |
| API migration (tRPC → Convex) | 25 hours | P1 |
| State migration (React Query → Convex) | 10 hours | P2 |
| **Total** | **85 hours** | — |

---

## 15. Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Editor compatibility | LOW | Plate Pro is independent of auth/DB |
| Hocuspocus setup | LOW | Well-documented, Docker-ready |
| Auth migration | MEDIUM | Clerk patterns differ from better-auth |
| Real-time sync | MEDIUM | Need Convex snapshots for YJS |
| Version conflicts | LOW | Both projects use similar React/TS versions |

---

## Next Steps

1. **T000c**: Map dependencies and identify version conflicts
2. **T000d-e**: Extract and adapt auth patterns
3. **T000f-h**: Create Convex schema and query adapters
4. **T000i-j**: Convert tRPC procedures to Convex functions
5. **T000k-q**: Extract and integrate editor components

---

*Generated by Explore Agent | Phase 0 Analysis*
