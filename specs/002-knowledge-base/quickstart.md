# Quickstart: Knowledge Base Feature

**Feature Branch**: `004-knowledge-base`
**Date**: 2026-01-02

## Overview

This document provides a quick reference for developers implementing the Knowledge Base feature. It summarizes key patterns, dependencies, and implementation guidance.

## Quick Links

| Document | Purpose |
|----------|---------|
| [spec.md](./spec.md) | Requirements and user stories |
| [plan.md](./plan.md) | Implementation plan and phases |
| [research.md](./research.md) | Technology decisions |
| [data-model.md](./data-model.md) | Convex schema definitions |
| [contracts/](./contracts/) | API function signatures |

## Key Technologies

| Component | Library | Version | Documentation |
|-----------|---------|---------|---------------|
| Rich-text Editor | Plate.js (Potion template) | ^52 | [platejs.org](https://platejs.org) |
| Real-time Sync | Hocuspocus (self-hosted) + Yjs | Latest | [hocuspocus.dev](https://hocuspocus.dev) |
| AI Commands | Claude Haiku/Sonnet | Latest | [anthropic.com](https://anthropic.com) |
| Semantic Search | OpenAI Embeddings | text-embedding-3-small | [openai.com](https://openai.com) |
| External Integrations | Nango Cloud | Latest | [nango.dev](https://nango.dev) |

**Source**: Using purchased Plate Pro Potion template. Requires adaptation from better-auth/Prisma/tRPC to Clerk/Convex.

## Installation

```bash
# Core dependencies (use versions from Potion template package.json)
pnpm add @platejs/core @platejs/yjs @platejs/ai @platejs/dnd platejs

# Hocuspocus (self-hosted YJS server - replaces Liveblocks)
pnpm add @hocuspocus/provider @hocuspocus/server yjs y-protocols

# Plate.js plugins
npx shadcn@latest add @plate/ai-kit
npx shadcn@latest add @plate/dnd-kit

# AI/Embeddings
pnpm add openai @anthropic-ai/sdk

# Optional: External integrations (P4)
pnpm add @nangohq/node
```

**Note**: Extract components from Potion template in Phase 0 before installing dependencies. Use exact versions from Potion's package.json for compatibility.

## Environment Variables

Add to `.env.local`:

```env
# Hocuspocus (self-hosted YJS server)
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://your-hocuspocus-server.railway.app
HOCUSPOCUS_SECRET=your-jwt-secret-for-auth

# AI Services
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# External Integrations (P4)
NANGO_SECRET_KEY=...
```

**Hocuspocus Deployment**: Deploy Hocuspocus server to Railway/Render/Fly.io (~$10-20/month).

## File Structure

```
src/app/(dashboard)/knowledge/
├── page.tsx                    # KB home (recent, favorites)
├── layout.tsx                  # KB layout with sidebar
├── [workspaceId]/
│   └── page.tsx                # Workspace view
└── doc/[documentId]/
    └── page.tsx                # Document editor

src/components/knowledge/
├── workspace-sidebar.tsx       # Navigation
├── document-editor/            # Plate.js wrapper
│   ├── index.tsx
│   └── plugins.ts              # Plugin configuration
└── collaboration/
    ├── cursors.tsx             # Remote cursor overlay
    └── presence.tsx            # User presence

convex/knowledge/
├── workspaces.ts               # Workspace CRUD
├── folders.ts                  # Folder CRUD
├── documents.ts                # Document CRUD
├── permissions.ts              # RBAC logic
└── search.ts                   # Search queries

convex/actions/
├── aiCommands.ts               # Claude API integration
└── embeddings.ts               # OpenAI embeddings
```

## Common Patterns

### 1. Plate.js Editor Setup (Hocuspocus Integration)

```typescript
// src/components/knowledge/document-editor/index.tsx
// Adapted from Potion template (Phase 0 extraction)
"use client";

import { Plate, usePlateEditor } from 'platejs/react';
import { YjsPlugin } from '@platejs/yjs/react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { EditorKit } from '@/components/editor/editor-kit';
import { RemoteCursorOverlay } from '@/components/ui/remote-cursor-overlay';

export function DocumentEditor({
  documentId,
  roomId,
  userName,
  userColor,
  hocuspocusToken, // JWT from Convex action
}: Props) {
  // Hocuspocus provider (self-hosted YJS server)
  const provider = new HocuspocusProvider({
    url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL!,
    name: roomId,
    token: hocuspocusToken,
  });

  const editor = usePlateEditor({
    plugins: [
      ...EditorKit,
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
      }),
    ],
    skipInitialization: true,
  }, [roomId]);

  // ... initialization and cleanup
}
```

### 2. Permission Check Hook

```typescript
// src/hooks/knowledge/use-permissions.ts
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function useDocumentPermission(documentId: Id<"kbDocuments">) {
  const permission = useQuery(
    api.knowledge.permissions.getEffective,
    { resourceType: "document", resourceId: documentId }
  );

  return {
    permission,
    canRead: permission !== "none",
    canWrite: permission === "write" || permission === "admin",
    canAdmin: permission === "admin",
    isLoading: permission === undefined,
  };
}
```

### 3. AI Command with Rate Limiting

```typescript
// src/hooks/knowledge/use-ai-commands.ts
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function useAICommand() {
  const usage = useQuery(api.knowledge.ai.getUsage);
  const executeCommand = useMutation(api.knowledge.ai.executeCommand);

  const summarize = async (documentId: Id<"kbDocuments">, text: string) => {
    if (usage && usage.commandsUsed >= usage.commandsLimit) {
      throw new Error("Monthly AI command limit reached");
    }

    return executeCommand({
      documentId,
      command: "summarize",
      selectedText: text,
    });
  };

  return {
    summarize,
    // ... other commands
    usage,
    isLimitReached: usage ? usage.commandsUsed >= usage.commandsLimit : false,
  };
}
```

### 4. Convex Mutation with RBAC

```typescript
// convex/knowledge/documents.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { checkPermission } from "./permissions";

export const update = mutation({
  args: {
    documentId: v.id("kbDocuments"),
    title: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check write permission
    const hasPermission = await checkPermission(
      ctx,
      user._id,
      "document",
      args.documentId,
      "write"
    );
    if (!hasPermission) {
      throw new Error("Insufficient permissions");
    }

    await ctx.db.patch(args.documentId, {
      ...(args.title && { title: args.title }),
      ...(args.icon && { icon: args.icon }),
      updatedAt: Date.now(),
      lastEditedBy: user._id,
    });

    return null;
  },
});
```

### 5. Permission Inheritance

```typescript
// convex/knowledge/permissions.ts
export async function getEffectivePermission(
  ctx: QueryCtx,
  userId: Id<"users">,
  resourceType: "workspace" | "folder" | "document",
  resourceId: string
): Promise<PermissionLevel> {
  // 1. Check direct permission
  const directPerm = await getDirectPermission(ctx, userId, resourceType, resourceId);
  if (directPerm) return directPerm;

  // 2. Check team permissions
  const teamPerm = await getTeamPermission(ctx, userId, resourceType, resourceId);
  if (teamPerm) return teamPerm;

  // 3. Check inherited from parent
  const parent = await getParentResource(ctx, resourceType, resourceId);
  if (parent) {
    return getEffectivePermission(ctx, userId, parent.type, parent.id);
  }

  // 4. Return workspace default
  const workspace = await getWorkspaceForResource(ctx, resourceType, resourceId);
  return workspace.defaultPermission;
}
```

## Quality Gates

Before marking implementation complete:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] Loading skeletons implemented
- [ ] Error toasts for failures
- [ ] Permission checks on all mutations
- [ ] AI rate limits enforced
- [ ] 10MB document size limit checked
- [ ] 25 concurrent editor limit enforced
- [ ] Audit logs for permission changes

## Testing

```typescript
// tests/unit/convex/knowledge/documents.test.ts
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";

describe("documents.create", () => {
  test("creates document in draft status", async () => {
    const t = convexTest(schema);

    // Setup: create user, workspace, folder
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { /* ... */ });
    });

    const documentId = await t.mutation(api.knowledge.documents.create, {
      folderId,
      title: "Test Document",
    }, { auth: { userId } });

    const document = await t.query(api.knowledge.documents.get, {
      documentId,
    }, { auth: { userId } });

    expect(document.status).toBe("draft");
    expect(document.creatorId).toBe(userId);
  });
});
```

## Common Issues & Solutions

### Issue: Plate.js imports failing

```bash
# Solution: Ensure proper module resolution
pnpm add -D @types/node
```

Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

### Issue: Hocuspocus connection not syncing

Ensure the Hocuspocus server is running and accessible:
```typescript
// Use document ID as room ID
const roomId = `kb-doc-${documentId}`;

// Verify WebSocket connection
const provider = new HocuspocusProvider({
  url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL!,
  name: roomId,
  token: hocuspocusToken,
  onConnect: () => console.log('Connected to Hocuspocus'),
  onDisconnect: () => console.log('Disconnected from Hocuspocus'),
});
```

Check server logs on Railway/Fly.io for authentication or connection errors.

### Issue: Embeddings not generating

Check OpenAI API key and model availability:
```typescript
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: text,
});
```

### Issue: Permission denied after folder move

Clear permission cache after move operations:
```typescript
await ctx.db.delete(existingPermission._id);
// Recalculate from new parent
```

## Phase Checklist

### Phase 0: Potion Template Extraction (CRITICAL)
- [ ] Clone Potion template to reference directory
- [ ] Audit component inventory (editor, sidebar, collaboration)
- [ ] Adapt auth patterns (better-auth → Clerk)
- [ ] Adapt database patterns (Prisma → Convex)
- [ ] Adapt API patterns (tRPC → Convex)
- [ ] Extract editor components
- [ ] Extract Hocuspocus client configuration

### Phase 1: Core (P1)
- [ ] Convex schema migration
- [ ] Workspace CRUD
- [ ] Folder CRUD
- [ ] Document CRUD
- [ ] Plate.js editor integration (from Potion extraction)
- [ ] Navigation sidebar (from Potion extraction)
- [ ] Draft/Publish workflow

### Phase 2: Collaboration (P2)
- [ ] Hocuspocus server setup (Docker, deployment)
- [ ] Hocuspocus client integration (from Potion extraction)
- [ ] Remote cursors
- [ ] Presence indicators
- [ ] Auto-save

### Phase 3: Comments (P2)
- [ ] Page-level comments
- [ ] Inline comments
- [ ] Threading
- [ ] @mentions

### Phase 4: Search (P2)
- [ ] Full-text search
- [ ] Semantic search
- [ ] Search filters
- [ ] Cmd+K palette

### Phase 5: Permissions (P2)
- [ ] RBAC implementation
- [ ] Inheritance
- [ ] Permission UI
- [ ] Audit logging

### Phase 6: Versions (P3)
- [ ] Auto-versioning
- [ ] Manual saves
- [ ] Version preview
- [ ] Restore

### Phase 7: AI (P3)
- [ ] Claude commands
- [ ] Content generation
- [ ] Rate limiting
- [ ] Budget tracking

### Phase 8: Integrations (P3-P4)
- [ ] Video embeds
- [ ] Figma embeds
- [ ] LMS links
- [ ] External tools (P4)

---

**Ready to implement?** Run `/speckit.tasks` to generate the task breakdown.
