# Potion Template Structure Analysis

## Overview

**Template Location:** `/Users/alexisdupre/potion-template/`
**Template Version:** 0.1.0
**Package Manager:** Bun 1.3.3
**Total TypeScript/TSX Files:** 423

## Gitignore Verification

The `/potion-source/` directory is correctly listed in our project's `.gitignore`:
```
# Potion template source (reference only - DO NOT COMMIT)
/potion-source/
```

## Top-Level Directory Structure

```
potion-template/
├── .claude/                    # Claude Code configuration
├── .github/                    # GitHub workflows/actions
├── .vscode/                    # VS Code settings
├── prisma/                     # Database schema & migrations
│   └── schema.prisma           # PostgreSQL schema (7 tables)
├── public/                     # Static assets
├── src/                        # Source code (main focus)
├── tooling/                    # Build/sync scripts
├── .env.example                # Environment variables template
├── Dockerfile                  # Container definition
├── docker-compose.yml          # Local development services
├── biome.jsonc                 # Biome linter/formatter config
├── eslint.config.mjs           # ESLint configuration
├── mprocs.yaml                 # Multi-process runner config
├── next.config.mjs             # Next.js configuration
├── package.json                # Dependencies & scripts
├── postcss.config.mjs          # PostCSS configuration
├── prisma.config.ts            # Prisma configuration
└── tsconfig.json               # TypeScript configuration
```

## Source Directory Structure (`src/`)

```
src/
├── app/                        # Next.js App Router
│   ├── (dynamic)/             # Dynamic routes (main app)
│   │   ├── (export)/          # PDF/Print export routes
│   │   │   └── print/[documentId]/
│   │   ├── (public)/          # Public preview routes
│   │   │   └── preview/[documentId]/
│   │   └── (main)/            # Main application routes
│   │       ├── (protected)/[documentId]/  # Protected doc editor
│   │       └── (auth)/login/              # Authentication
│   ├── (dev)/                 # Development-only routes
│   │   └── chat/              # AI chat development
│   ├── api/                   # API routes
│   │   ├── auth/[...all]/     # Better-Auth handlers
│   │   ├── trpc/[trpc]/       # tRPC handlers
│   │   ├── uploadthing/       # File upload handlers
│   │   └── [[...route]]/      # Hono catch-all route
│   └── editor/                # Standalone editor page
│
├── components/                 # React components
│   ├── editor/                # [HIGH PRIORITY] Rich text editor
│   │   ├── plugins/           # Custom Plate.js plugins (8 files)
│   │   ├── ui/                # Editor-specific UI (12 files)
│   │   ├── utils/             # Editor utilities (9 files)
│   │   └── version-history/   # Version history feature (8 files)
│   ├── sidebar/               # [HIGH PRIORITY] Navigation sidebar (5 files)
│   ├── ui/                    # Base UI components (12 files)
│   ├── cover/                 # Document cover/icon (4 files)
│   ├── navbar/                # Top navigation (9 files)
│   ├── context-panel/         # Right sidebar panel (3 files)
│   ├── modals/                # Modal dialogs (6 files)
│   ├── search/                # Search functionality (2 files)
│   ├── settings/              # Settings modal (2 files)
│   ├── auth/                  # Authentication components (10 files)
│   │   └── rsc/               # React Server Components
│   ├── providers/             # Context providers (5 files)
│   ├── screens/               # Full-page layouts (3 files)
│   ├── layouts/               # Layout components (1 file)
│   ├── icons/                 # Custom icons (4 files)
│   ├── analytics/             # Analytics integration (1 file)
│   └── dev/                   # Development tools (4 files)
│
├── registry/                   # [HIGH PRIORITY] Plate.js UI registry
│   ├── components/editor/     # Core editor setup
│   │   └── plugins/           # Plugin configurations (57 files)
│   ├── ui/                    # [CRITICAL] Plate.js UI components (98 files)
│   ├── examples/values/       # Demo content/values (29 files)
│   ├── hooks/                 # Utility hooks (8 files)
│   ├── lib/                   # Utility functions (3 files)
│   └── app/api/               # API route examples
│
├── server/                     # [HIGH PRIORITY] Backend code
│   ├── yjs/                   # [CRITICAL] Real-time collaboration (4 files)
│   │   ├── server.ts          # Hocuspocus server
│   │   ├── document.ts        # Y.doc ↔ Slate conversion
│   │   ├── auth.ts            # YJS authentication
│   │   └── types.ts           # TypeScript types
│   ├── api/                   # tRPC API layer
│   │   ├── routers/           # tRPC routers (6 files)
│   │   ├── middlewares/       # Auth/rate-limit (6 files)
│   │   └── utils/             # API utilities (2 files)
│   ├── hono/                  # Hono HTTP framework
│   │   ├── routes/            # API routes (4 files)
│   │   ├── middlewares/       # HTTP middlewares (3 files)
│   │   └── utils/             # Hono utilities (1 file)
│   ├── auth/                  # Better-Auth setup (3 files)
│   ├── db.ts                  # Prisma client
│   ├── pg.ts                  # PostgreSQL driver
│   ├── redis.ts               # Redis client
│   └── ratelimit.ts           # Rate limiting
│
├── trpc/                       # tRPC client setup
│   ├── hooks/                 # React Query hooks
│   ├── query-client.ts        # Query client config
│   ├── react.tsx              # React tRPC client
│   └── server.ts              # Server tRPC client
│
├── hooks/                      # Shared React hooks (8 files)
│
└── lib/                        # Shared utilities
    ├── date/                  # Date formatting
    ├── url/                   # URL utilities
    ├── storage/               # Storage abstractions
    └── utils.ts               # General utilities
```

## Architecture Highlights

### 1. Technology Stack Differences

| Layer | Potion Template | Our Project (BDR LMS) |
|-------|----------------|----------------------|
| **Framework** | Next.js 16 | Next.js 15.5.7 |
| **Database** | PostgreSQL + Prisma | Convex |
| **API** | tRPC + Hono | Convex functions |
| **Auth** | Better-Auth | Clerk |
| **Real-time** | Hocuspocus + YJS | Convex subscriptions |
| **State** | Jotai + Zustand | React Context |
| **Package Manager** | Bun | pnpm |

### 2. Collaboration Architecture (Potion)

```
┌─────────────────────────────────────────────────────────────────┐
│                        HOCUSPOCUS SERVER                         │
│                    (Separate Node.js process)                    │
├─────────────────────────────────────────────────────────────────┤
│  WebSocket connections ─────────────────────────────────────┐   │
│                                                              │   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │   │
│  │   Client A   │    │   Client B   │    │   Client C   │  │   │
│  │  (Browser)   │    │  (Browser)   │    │  (Browser)   │  │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │   │
│         │                   │                   │          │   │
│         └───────────────────┼───────────────────┘          │   │
│                             ▼                              │   │
│                   ┌─────────────────┐                      │   │
│                   │   Y.js Doc      │                      │   │
│                   │  (CRDT State)   │                      │   │
│                   └────────┬────────┘                      │   │
│                            │                               │   │
│  ┌─────────────────────────┼─────────────────────────────┐ │   │
│  │           REDIS (pub/sub + persistence)               │ │   │
│  └─────────────────────────┼─────────────────────────────┘ │   │
│                            │                               │   │
│                   ┌────────┴────────┐                      │   │
│                   │   PostgreSQL    │                      │   │
│                   │  (yjsSnapshot)  │                      │   │
│                   └─────────────────┘                      │   │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Data Model (Prisma Schema)

| Table | Purpose | BDR Equivalent |
|-------|---------|----------------|
| `User` | User accounts | `users` table |
| `Session` | Auth sessions | Clerk handles |
| `Account` | OAuth accounts | Clerk handles |
| `Verification` | Email verification | Clerk handles |
| `Document` | Knowledge base pages | NEW: `pages` table |
| `DocumentVersion` | Version history | NEW: `pageVersions` table |
| `Discussion` | Comments on blocks | `comments` table |
| `Comment` | Discussion replies | `comments` table |
| `File` | Uploaded files | `files` table |

### 4. Key Document Fields

```typescript
// Potion Document model - key fields for Knowledge Base
{
  id: string;
  templateId?: string;           // For template-based docs
  parentDocumentId?: string;     // For page hierarchy
  
  title?: string;
  content?: string;              // Plain text (for search)
  contentRich?: Json;            // Plate.js Value (JSON)
  yjsSnapshot?: Buffer;          // Binary Y.js state
  
  coverImage?: string;
  icon?: string;
  
  isPublished: boolean;          // Public visibility
  isArchived: boolean;           // Soft delete
  lockPage: boolean;             // Prevent editing
  
  textStyle: 'DEFAULT' | 'SERIF' | 'MONO';
  smallText: boolean;
  fullWidth: boolean;
  toc: boolean;                  // Show table of contents
}
```

## Files to Extract (Priority Order)

### Critical (Must Have)
1. `/src/registry/ui/*` - All 98 Plate.js UI components
2. `/src/registry/components/editor/*` - Editor kit & plugins
3. `/src/components/editor/plate-provider.tsx` - YJS integration
4. `/src/server/yjs/*` - Collaboration server logic

### High Priority
5. `/src/components/sidebar/*` - Document tree navigation
6. `/src/components/navbar/*` - Document actions
7. `/src/components/cover/*` - Cover image & icons
8. `/src/components/context-panel/*` - Right panel

### Medium Priority
9. `/src/components/search/*` - Document search
10. `/src/components/modals/*` - Modal system
11. `/src/registry/hooks/*` - Utility hooks
12. `/src/registry/lib/*` - Utility functions

### Adaptation Required
13. `/src/server/api/routers/*` - tRPC → Convex functions
14. `/src/components/auth/*` - Better-Auth → Clerk
15. `/prisma/schema.prisma` - Prisma → Convex schema

## Next Steps

1. **T000b**: Create detailed component inventory with dependencies
2. **T000c**: Compare package.json dependencies
3. **T001**: Extract and adapt Plate.js UI components
4. **T002**: Design Convex schema for Knowledge Base
5. **T003**: Adapt YJS collaboration to Convex (or keep Hocuspocus)
