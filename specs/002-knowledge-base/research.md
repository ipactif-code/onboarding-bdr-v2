# Research: Knowledge Base - Technology Decisions

**Feature Branch**: `004-knowledge-base`
**Date**: 2026-01-02
**Status**: Complete

## Executive Summary

All major technology decisions have been validated. The recommended stack is:

| Component | Technology | Decision | Rationale |
|-----------|------------|----------|-----------|
| Rich-text Editor | Plate.js (Potion template) | **Plate Pro (Potion)** | Purchased template with editor, sidebar, collaboration components (~40 hours saved) |
| Real-time Sync | Plate YjsPlugin + Hocuspocus | **Hocuspocus (self-hosted)** | YJS CRDT server; ~$10-20/month vs $150/month Liveblocks |
| AI Text Commands | Claude Haiku | **Claude Haiku** | Fast, low-cost for summarize/translate/rephrase |
| AI Content Generation | Claude Sonnet | **Claude Sonnet** | Higher quality for longer content generation |
| Semantic Search | OpenAI text-embedding-3-small | **OpenAI** | Best cost/quality ratio for embeddings |
| External Integrations | Nango Cloud | **Nango** | Unified OAuth + token refresh for 4 providers |

**Potion Template**: Purchased Plate Pro Potion template provides pre-built components for editor, sidebar, and real-time collaboration. Requires adaptation from better-auth/Prisma/tRPC to Clerk/Convex.

## 1. Rich-Text Editor: Plate.js

### Decision: Use Plate.js with YjsPlugin

**Why Plate.js over alternatives:**

| Feature | Plate.js | TipTap | Lexical |
|---------|----------|--------|---------|
| React-first | Yes (core design) | Adapter | Yes |
| shadcn/ui Integration | Native | Manual | Manual |
| Block Types | 50+ plugins | ~30 | ~15 |
| Yjs Integration | Built-in YjsPlugin | Extension | Community |
| AI-ready | Yes (AI kit) | Manual | Manual |
| Accessibility | WCAG 2.1 AA | Partial | Partial |
| Commercial License | Optional (Pro) | Required | N/A |

### Plate.js Components Needed

From Context7 research:

```typescript
// Core installation
npx shadcn@latest add @plate/ai-kit      // AI features
npx shadcn@latest add @plate/dnd-kit     // Drag and drop
npx shadcn@latest add @plate/ai-menu     // AI menu component
npx shadcn@latest add @plate/ai-api      // Server-side AI handlers
```

### Plate Pro vs Open Source

| Feature | Open Source | Plate Pro |
|---------|-------------|-----------|
| Basic blocks (text, headings, lists) | Yes | Yes |
| Code blocks, tables, columns | Yes | Yes |
| AI integration | Yes | Enhanced |
| Comments plugin | Yes | Enhanced |
| Priority support | No | Yes |
| Commercial license clarity | MIT | Commercial |

**Decision**: Use **Plate Pro Potion template** (purchased). The Potion template provides:
- Pre-built editor wrapper with complete configuration
- Sidebar with document tree navigation
- Real-time collaboration with Hocuspocus
- ~40 hours of development time saved

**Adaptation Required**: Potion uses better-auth/Prisma/tRPC → adapt to Clerk/Convex in Phase 0.

## 2. Real-Time Collaboration: Hocuspocus (Self-Hosted YJS)

### Decision: Use Plate YjsPlugin with Self-Hosted Hocuspocus Server

**Changed from Liveblocks**: Using self-hosted Hocuspocus server (~$10-20/month) instead of Liveblocks Cloud (~$150/month). The Potion template includes Hocuspocus client configuration.

Plate.js has native Yjs support via `@platejs/yjs` which works with Hocuspocus:

```typescript
import { YjsPlugin } from '@platejs/yjs/react';
import { HocuspocusProvider } from '@hocuspocus/provider';

// Hocuspocus provider configuration (from Potion template)
const provider = new HocuspocusProvider({
  url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL!,
  name: `document-${documentId}`,
  token: await getHocuspocusToken(), // JWT from Convex action
});

YjsPlugin.configure({
  options: {
    cursors: {
      data: { name: userName, color: userColor },
    },
    providers: [provider],
  },
  render: {
    afterEditable: RemoteCursorOverlay,
  },
});
```

### Hocuspocus Architecture

**Self-hosted YJS server** provides:

1. **WebSocket-based sync**: Real-time document synchronization
2. **YJS CRDT**: Conflict-free replicated data types for collaborative editing
3. **Awareness protocol**: Cursor positions, selections, presence indicators
4. **Authentication**: JWT-based auth validated against Convex

**Server-side setup** (from Potion template):

```typescript
// hocuspocus/server.ts
import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';

const server = new Server({
  port: 1234,
  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        // Load document from Convex
      },
      store: async ({ documentName, state }) => {
        // Persist to Convex
      },
    }),
  ],
  onAuthenticate: async ({ token }) => {
    // Validate JWT against Convex
  },
});
```

### Hocuspocus Hosting Options

| Provider | Monthly Cost | Pros | Cons |
|----------|-------------|------|------|
| Railway | ~$5-10 | Easy deploy, auto-scaling | WebSocket limits on free tier |
| Render | ~$7-15 | Background workers | Cold starts |
| Fly.io | ~$5-20 | Edge deployment, low latency | More complex setup |
| Self-hosted (VPS) | ~$10-20 | Full control | Maintenance overhead |

**Recommendation**: Deploy to Railway or Fly.io for ~$10-20/month. This saves ~$130/month compared to Liveblocks Pro tier.

### Cost Comparison

| Solution | Monthly Cost | MAU Limit | Notes |
|----------|-------------|-----------|-------|
| Liveblocks Free | $0 | 50 | Not sufficient for production |
| Liveblocks Pro | $99 | 500 | Previous recommendation |
| Liveblocks Business | $399 | 2000 | Scales with users |
| **Hocuspocus (self-hosted)** | **~$10-20** | **Unlimited** | **Selected: 10-20x cheaper** |

**Decision**: Use self-hosted Hocuspocus. The Potion template includes Hocuspocus configuration, making migration straightforward.

## 3. AI Features: Claude + OpenAI

### Claude for Text Commands

| Command | Model | Est. Cost/Call | Rationale |
|---------|-------|----------------|-----------|
| Summarize | Haiku | ~$0.001 | Fast, concise output |
| Translate | Haiku | ~$0.002 | Simple transformation |
| Rephrase | Haiku | ~$0.001 | Style adaptation |
| Expand | Haiku | ~$0.002 | Add detail |
| Generate (prompt) | Sonnet | ~$0.01 | Higher quality for creation |

### OpenAI for Embeddings

| Model | Dimensions | Cost per 1M tokens | Quality |
|-------|------------|-------------------|---------|
| text-embedding-3-small | 1536 | $0.02 | Good |
| text-embedding-3-large | 3072 | $0.13 | Better |
| text-embedding-ada-002 | 1536 | $0.10 | Legacy |

**Decision**: Use `text-embedding-3-small` for best cost/quality ratio.

### Budget Allocation (150 EUR/month)

| Feature | Allocation | Est. Usage |
|---------|------------|------------|
| Text commands (Haiku) | 40 EUR | ~40,000 commands |
| Content generation (Sonnet) | 60 EUR | ~6,000 generations |
| Embeddings (OpenAI) | 30 EUR | ~1.5M tokens |
| Buffer | 20 EUR | Overflow protection |

Rate limits from spec:
- 100 commands/user/month
- 50 generations/user/month
- 500 searches/user/month

## 4. External Integrations: Nango Cloud

### Decision: Use Nango Cloud for OAuth Management

Nango provides:
- Pre-built OAuth flows for GitHub, Jira, Linear, MS365
- Automatic token refresh
- Unified API wrapper
- Webhook for sync events

### Integration Priority (P4)

| Provider | Use Case | Nango Integration |
|----------|----------|-------------------|
| GitHub | Embed issues/PRs | `github` |
| Jira | Embed tickets | `jira` |
| Linear | Embed issues | `linear` |
| MS365 | Embed docs | `microsoft-graph` |

**Recommendation**: Defer to Phase 8 (P4). Core KB features don't depend on integrations.

## 5. Convex Schema Design

### New Tables Required

Based on spec analysis, these tables extend the existing schema:

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `kbWorkspaces` | Top-level containers | Owner (user) |
| `kbFolders` | Hierarchical containers | Parent (folder), Workspace |
| `kbDocuments` | Document metadata | Folder, Creator |
| `kbDocumentContent` | Separated content (Plate JSON) | Document |
| `kbDocumentVersions` | Version snapshots | Document |
| `kbResourcePermissions` | RBAC grants | Resource, User/Team |
| `kbDocumentComments` | Comment threads | Document, Author |
| `kbDocumentLinks` | LMS associations | Document, Course/Lesson |
| `kbDocumentEmbeddings` | Vector search | Document |
| `kbAuditLogs` | Permission/lifecycle events | Resource, Actor |

### Naming Convention

Prefix all KB tables with `kb` to avoid conflicts with existing tables (e.g., `comments` already exists for courses/lessons).

### Content Separation Strategy

Store document content separately from metadata for:
- Faster metadata queries (list, search results)
- Efficient versioning (content snapshots)
- Large content handling (10MB limit)

```typescript
// Document metadata (fast queries)
kbDocuments: defineTable({
  title: v.string(),
  folderId: v.id("kbFolders"),
  status: v.union(v.literal("draft"), v.literal("published")),
  // ... other metadata
})

// Document content (separate for performance)
kbDocumentContent: defineTable({
  documentId: v.id("kbDocuments"),
  content: v.any(), // Plate.js JSON
  contentSize: v.number(), // For 10MB limit enforcement
})
```

## 6. Search Architecture

### Two-Tier Search Strategy

1. **Full-text search**: Convex search index on document title + extracted text
2. **Semantic search**: OpenAI embeddings stored in `kbDocumentEmbeddings`

### Search Flow

```
User Query
    │
    ├─► [Keyword Mode] ──► Convex .search() ──► Results
    │
    └─► [AI Mode] ──► Generate Embedding ──► Vector Similarity ──► Results
```

### Embedding Update Strategy

- Generate embeddings on document publish (not draft saves)
- Update embeddings on content change (debounced)
- Store embeddings in Convex (no external vector DB needed for scale)

## 7. Permission Model

### RBAC Levels

| Level | Can Read | Can Edit | Can Manage | Can Delete |
|-------|----------|----------|------------|------------|
| None | No | No | No | No |
| Read | Yes | No | No | No |
| Write | Yes | Yes | No | No |
| Admin | Yes | Yes | Yes | Yes |

### Inheritance Rules

```
Workspace Permission (default for all children)
    │
    └─► Folder Permission (overrides workspace)
            │
            └─► Document Permission (overrides folder)
```

### Draft Visibility

Drafts are ONLY visible to:
1. Document creator
2. System admins (for support)

Published documents follow normal permission rules.

## 8. Unresolved Items

All items from spec have been clarified in `/speckit.clarify` session:

| Question | Answer | Source |
|----------|--------|--------|
| Max document size | 10MB | Clarification session |
| Archive retention | 90 days | Clarification session |
| Max items per container | 1000 | Clarification session |
| Max concurrent editors | 25 | Clarification session |
| Audit logging scope | Permissions + lifecycle | Clarification session |

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hocuspocus server downtime | Low | High | Health checks, auto-restart, Railway/Fly.io managed infra |
| Potion template adaptation complexity | Medium | Medium | Phase 0 dedicated to extraction; rollback to OSS Plate.js if needed |
| AI budget exceeded | Medium | Low | Hard caps at 95%, alerts at 80% |
| Plate.js breaking changes | Low | High | Pin versions from Potion template, comprehensive tests |
| Search performance degradation | Low | Medium | Index optimization, pagination |

## 10. Recommendations

1. **Complete Phase 0 (Potion extraction) first** - blocks all other phases
2. **Use Plate Pro Potion template** - purchased, provides ~40 hours of saved dev time
3. **Deploy Hocuspocus to Railway/Fly.io** - ~$10-20/month, 10x cheaper than Liveblocks
4. **Adapt Potion stack carefully** - better-auth → Clerk, Prisma → Convex, tRPC → Convex
5. **Implement budget tracking** before enabling AI features
6. **Defer P4 integrations** to Phase 8 or post-MVP

---

**Research Status**: COMPLETE (Updated for Potion/Hocuspocus migration)
**Ready for**: Phase 0 Potion Template Extraction, then Phase 1 Data Model Design
