# Fix Report: Document Embeddings Generation

**Date**: 2026-01-11
**Branch**: 002-knowledge-base
**Agent**: ai-engineer

---

## Problem Statement

AI Search returns "No documents found" because the `kbDocumentEmbeddings` table has **0 rows**.
The semantic search action generates a query embedding but has no document embeddings to compare against.

---

## Investigation

| Check | Status | Details |
|-------|--------|---------|
| Existing trigger | YES | `updateContent` mutation already calls `scheduler.runAfter` for embedding generation |
| generateDocumentEmbeddings action | EXISTS | Properly implemented with retry logic, chunking, error handling |
| Why 0 embeddings? | No backfill | Auto-trigger only works for NEW saves, not existing documents |

**Root Cause**: Auto-trigger exists for future saves, but existing documents were created before the trigger was added, so they have no embeddings.

---

## Changes Made

### 1. New Internal Queries

**File**: `convex/knowledge/documents.ts`
```typescript
export const listAllForEmbedding = internalQuery({
  // Returns all non-archived document IDs for backfill
});
```

**File**: `convex/knowledge/embeddings.ts`
```typescript
export const listDocumentIdsWithEmbeddings = internalQuery({
  // Returns document IDs that already have embeddings (deduplication)
});
```

### 2. Backfill Action

**File**: `convex/actions/embeddings.ts`
```typescript
export const backfillAllDocuments = action({
  // One-time backfill for all existing documents
  // Returns: { processed, skipped, errors }
});
```

### 3. Verified Auto-Trigger (Already Exists)

**File**: `convex/knowledge/documents.ts` (lines 616-622)
```typescript
// In updateContent mutation:
await ctx.scheduler.runAfter(
  0,
  internalApi.actions.embeddings.generateDocumentEmbeddings,
  { documentId: args.documentId }
);
```

---

## How to Run Backfill

### Option 1: Via Convex CLI
```bash
npx convex run actions/embeddings:backfillAllDocuments
```

### Option 2: Via Convex Dashboard
1. Go to https://dashboard.convex.dev
2. Navigate to Functions > actions/embeddings > backfillAllDocuments
3. Click "Run"

### Prerequisites
- `OPENAI_API_KEY` must be set in Convex environment variables
- User must be authenticated

---

## Expected Backfill Output

```json
{
  "processed": 5,   // Documents that got embeddings
  "skipped": 0,     // Documents that already had embeddings
  "errors": 0       // Failed documents
}
```

---

## Verification Checklist

After running backfill:

- [ ] `kbDocumentEmbeddings` table has rows (check Convex Dashboard > Data)
- [ ] AI Search for "CLM" returns results
- [ ] AI Search for "gains du module contrat" returns results
- [ ] AI Search for "ROI" returns results
- [ ] `pnpm typecheck` passes

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     EMBEDDING PIPELINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  NEW DOCUMENTS (Auto-trigger):                                  │
│  ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐ │
│  │ updateContent│────▶│ scheduler.run   │────▶│ generateDoc  │ │
│  │ mutation     │     │ After(0, ...)   │     │ Embeddings   │ │
│  └──────────────┘     └─────────────────┘     └──────────────┘ │
│                                                                 │
│  EXISTING DOCUMENTS (Backfill):                                 │
│  ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐ │
│  │ backfillAll  │────▶│ For each doc    │────▶│ generateDoc  │ │
│  │ Documents    │     │ without embed   │     │ Embeddings   │ │
│  └──────────────┘     └─────────────────┘     └──────────────┘ │
│                                                                 │
│  EMBEDDING STORAGE:                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ kbDocumentEmbeddings                                     │  │
│  │ - documentId: Id<"kbDocuments">                          │  │
│  │ - chunkIndex: number (0, 1, 2... for long docs)          │  │
│  │ - content: string (chunk text)                           │  │
│  │ - embedding: float64[1536] (text-embedding-3-small)      │  │
│  │ - createdAt: number                                      │  │
│  │                                                          │  │
│  │ Indexes:                                                 │  │
│  │ - by_document (for lookup/delete)                        │  │
│  │ - by_embedding (vectorIndex for semantic search)         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quality Gates Verified

- [x] API keys via `process.env.OPENAI_API_KEY` only
- [x] `internalAction` used for `generateDocumentEmbeddings`
- [x] `internalQuery` used for helper functions (no public exposure)
- [x] Error handling with retry + request_id logging
- [x] No personal data in logs
- [x] Strict TypeScript types (no `any`)
- [x] Convex codegen passes

---

## Next Steps

1. **Run backfill**: `npx convex run actions/embeddings:backfillAllDocuments`
2. **Verify in dashboard**: Check `kbDocumentEmbeddings` table has rows
3. **Test AI Search**: Search for "CLM", "ROI", or "gains du module contrat"
4. **Confirm working**: User should see relevant documents in search results
