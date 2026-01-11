# KB Comments & Discussions System - Full Architectural Audit

**Document Version:** 1.0  
**Audit Date:** 2024-01-10  
**Status:** Complete Architectural Analysis

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Component Diagram](#2-component-diagram)
3. [ID Systems](#3-id-systems)
4. [State Locations](#4-state-locations)
5. [Scenario A: Creating a New Inline Comment](#5-scenario-a-creating-a-new-inline-comment)
6. [Scenario B: Page Refresh with Existing Comments](#6-scenario-b-page-refresh-with-existing-comments)
7. [Scenario C: Real-time Sync (Another User's Comment)](#7-scenario-c-real-time-sync)
8. [Sync Points](#8-sync-points)
9. [Current Bugs - Root Cause Analysis](#9-current-bugs---root-cause-analysis)
10. [Recommended Fix](#10-recommended-fix)
11. [Quality Gates Verification](#11-quality-gates-verification)

---

## 1. Executive Summary

The KB Comments system uses a **dual-source architecture** where:
- **Convex** is the source of truth for comment data (content, metadata, users)
- **Yjs/Hocuspocus** is the source of truth for editor content (including comment marks)

The fundamental problem is that these two sources are **not atomically synchronized**, leading to:
1. First comment creation failing visually (mark not visible)
2. ID mismatches between editor marks and Convex discussion IDs after refresh

---

## 2. Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                        DocumentEditorClient                                  │    │
│  │                src/app/(dashboard)/knowledge/doc/[documentId]/editor.tsx     │    │
│  │                              (lines 201-428)                                 │    │
│  └────────────────────────────────────┬────────────────────────────────────────┘    │
│                                       │                                             │
│                                       ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                         DiscussionProvider                                    │   │
│  │          src/components/knowledge/discussions/discussion-provider.tsx         │   │
│  │                              (lines 197-266)                                  │   │
│  │                                                                               │   │
│  │  ┌─────────────────┐  ┌───────────────────┐  ┌─────────────────────────┐     │   │
│  │  │ useCurrentUser  │  │ useKBDiscussions  │  │ useKBCommentMutations   │     │   │
│  │  │ (Clerk + Convex)│  │ (Convex queries)  │  │ (Convex mutations)      │     │   │
│  │  └─────────────────┘  └───────────────────┘  └─────────────────────────┘     │   │
│  └────────────────────────────────────┬─────────────────────────────────────────┘   │
│                                       │                                             │
│                 ┌─────────────────────┼─────────────────────┐                       │
│                 ▼                     ▼                     ▼                       │
│  ┌─────────────────────┐  ┌───────────────────┐  ┌──────────────────────────┐      │
│  │ useHocuspocusProvider│  │ useDiscussionPluginSync │ │  Plate.js Editor      │      │
│  │ (Yjs + WebSocket)   │  │ (Context → Plugin)      │ │  + Plugins            │      │
│  │ :100-391            │  │ :252-341                │ │                       │      │
│  └──────────┬──────────┘  └───────────┬─────────────┘  └───────────────────────┘      │
│             │                         │                                             │
│             │                         ▼                                             │
│             │             ┌─────────────────────────────────────────────────────┐   │
│             │             │              discussionPlugin                        │   │
│             │             │  src/components/editor/plugins/discussion-kit.tsx    │   │
│             │             │                 (lines 359-384)                      │   │
│             │             │                                                      │   │
│             │             │  Options:                                            │   │
│             │             │  - currentUserId: string                             │   │
│             │             │  - discussions: TDiscussion[]                        │   │
│             │             │  - users: Record<string, PlateUser>                  │   │
│             │             │  - marksInjectedAt: number (trigger for re-render)   │   │
│             │             └─────────────────────────────────────────────────────┘   │
│             │                                                                       │
│             ▼                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                          commentPlugin                                        │   │
│  │           src/components/editor/plugins/comment-kit.tsx                       │   │
│  │                         (lines 28-146)                                        │   │
│  │                                                                               │   │
│  │  Options:                                                                     │   │
│  │  - activeId: string | null                                                    │   │
│  │  - commentingBlock: Path | null                                               │   │
│  │  - hoverId: string | null                                                     │   │
│  │  - uniquePathMap: Map<string, Path>  ◄── Maps discussionId → block path       │   │
│  │  - updateTimestamp: number | null                                             │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                          UI Components                                       │    │
│  │                                                                              │    │
│  │  BlockDiscussion (block-discussion.tsx:48-497)                               │    │
│  │    └─► Renders comment icon next to blocks with comment marks               │    │
│  │    └─► Uses api.comment.nodes() to find marks                                │    │
│  │    └─► Filters discussions by uniquePathMap                                  │    │
│  │                                                                              │    │
│  │  CommentLeaf (comment-node.tsx:15-44)                                        │    │
│  │    └─► Renders highlighted text for comment marks                           │    │
│  │                                                                              │    │
│  │  CommentCreateForm (comment.tsx:533-908)                                     │    │
│  │    └─► Handles new comment creation                                         │    │
│  │    └─► Calls ctx.createComment() for Convex persistence                     │    │
│  │    └─► Applies marks to editor after Convex returns ID                      │    │
│  │                                                                              │    │
│  │  FloatingDiscussion (floating-discussion.tsx:57-1092)                        │    │
│  │    └─► Alternative display mode (currently disabled, isOverlapWithEditor=true)│    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ WebSocket (Yjs)
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                            Hocuspocus Server (Railway)                                │
│                                                                                      │
│  - Maintains Yjs document state                                                      │
│  - Broadcasts changes to all connected clients                                       │
│  - Persists editor content (including marks) to database                             │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                  CONVEX BACKEND                                       │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  convex/knowledge/comments.ts                                                        │
│                                                                                      │
│  QUERIES:                                                                            │
│  - getInline(documentId) → Returns inline comments with selectionStart/End           │
│    (lines 502-583)                                                                   │
│  - getReplies(parentId) → Returns reply comments                                     │
│    (lines 434-491)                                                                   │
│                                                                                      │
│  MUTATIONS:                                                                          │
│  - create({documentId, type, content, selectionStart, selectionEnd, selectedText})  │
│    (lines 704-837) → Returns new comment ID (Convex ID format)                       │
│  - resolve(commentId) → Mark as resolved                                             │
│    (lines 1032-1081)                                                                 │
│  - update(commentId, content) → Edit comment                                         │
│    (lines 849-935)                                                                   │
│  - deleteComment(commentId) → Delete comment                                         │
│    (lines 946-1022)                                                                  │
│                                                                                      │
│  DATABASE TABLES:                                                                    │
│  - kbDocumentComments: {                                                             │
│      documentId, type, parentId?, content, authorId,                                 │
│      isResolved, resolvedAt?, isEdited, editedAt?,                                   │
│      selectionStart?, selectionEnd?, selectedText?,                                  │
│      createdAt, updatedAt                                                            │
│    }                                                                                 │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. ID Systems

### 3.1 ID Types and Formats

| ID Type | Format | Example | Where Generated | Where Used |
|---------|--------|---------|-----------------|------------|
| **Convex ID** | `k...` / `j...` / etc. | `k576789abc12345` | Convex `ctx.db.insert()` | Convex queries, mutations, DB relations |
| **nanoid** | 21-char alphanumeric | `V1StGXR8_Z5jdHi6B-myT` | `nanoid()` from platejs | Temporary local IDs (problematic!) |
| **Comment Key** | `comment_{id}` | `comment_k576789abc12345` | `getCommentKey(id)` from @platejs/comment | Text node marks in editor |
| **Draft Key** | `comment_draft` | `comment_draft` | `getDraftCommentKey()` from @platejs/comment | Temporary mark during comment creation |

### 3.2 ID Lifecycle During Comment Creation

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          ID TRANSFORMATION FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  STEP 1: User selects text                                                           │
│  ────────────────────────                                                            │
│  Mark: comment_draft = true                                                          │
│  ID: getDraftCommentKey() = "comment_draft"                                          │
│                                                                                      │
│  STEP 2: User presses Enter (comment.tsx:571-855)                                   │
│  ──────────────────────────                                                          │
│  1. Create temp discussion with `temp_${nanoid()}` (line 697)                        │
│  2. Add to local discussions array (optimistic UI, line 717)                         │
│  3. Call ctx.createComment() (line 725)                                              │
│  4. Convex returns REAL ID: `k576789abc12345`                                        │
│  5. Replace draft mark with `comment_k576789abc12345` (lines 737-778)                │
│  6. Update local discussions with Convex ID (lines 796-803)                          │
│                                                                                      │
│  STEP 3: Mark syncs to Yjs                                                           │
│  ────────────────────────                                                            │
│  Editor content with `comment_k576789abc12345` mark syncs to Hocuspocus              │
│                                                                                      │
│  STEP 4: Page refresh                                                                │
│  ─────────────────────                                                               │
│  1. Yjs loads content with `comment_k576789abc12345` mark                            │
│  2. Convex loads discussion with ID `k576789abc12345`                                │
│  3. injectCommentMarks() runs if needed (discussion-kit.tsx:62-216)                  │
│  4. BlockDiscussion finds marks and matches to discussions                           │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 ID Format Detection (from block-discussion.tsx:423-437)

```javascript
// Analysis in useResolvedDiscussion hook
idAnalysis: [...commentsWithMarks].map(id => ({
  id,
  length: id.length,
  isNanoidFormat: id.length === 21 && /^[A-Za-z0-9_-]+$/.test(id) && !id.startsWith('q'),
  isConvexFormat: id.startsWith('q') || id.startsWith('k') || id.startsWith('j'),
})),
```

---

## 4. State Locations

### 4.1 State Overview

| State | Location | Type | Persistence | Sync Method |
|-------|----------|------|-------------|-------------|
| Editor Content + Marks | `editor.children` | Yjs-managed | Hocuspocus server | Real-time WebSocket |
| Discussion Data | `discussionPlugin.options.discussions` | React state | Convex DB | useQuery subscription |
| User Data | `discussionPlugin.options.users` | React state | Convex DB | useQuery subscription |
| Active Comment ID | `commentPlugin.options.activeId` | React state | None | Local only |
| Unique Path Map | `commentPlugin.options.uniquePathMap` | Map<string, Path> | None | Built from editor marks |
| Marks Injected Timestamp | `discussionPlugin.options.marksInjectedAt` | number | None | Trigger for re-render |
| Loading State | `DiscussionContext.isLoading` | boolean | None | Derived from queries |

### 4.2 State Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               STATE SYNCHRONIZATION                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌───────────────────┐                    ┌───────────────────────────────────────┐ │
│  │                   │                    │                                       │ │
│  │   CONVEX DB       │◄──── Mutations ────┤  useKBCommentMutations               │ │
│  │                   │                    │  (use-kb-comment-mutations.ts)        │ │
│  │ kbDocumentComments│                    │                                       │ │
│  │                   │                    └───────────────────────────────────────┘ │
│  │                   │                                                              │
│  └────────┬──────────┘                                                              │
│           │                                                                         │
│           │ useQuery (real-time subscription)                                       │
│           ▼                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                                │ │
│  │   useKBDiscussions (use-kb-discussions.ts:248-413)                            │ │
│  │   - Transforms Convex data to TDiscussion[] format                            │ │
│  │   - Fetches inline comments + replies                                          │ │
│  │                                                                                │ │
│  └────────┬──────────────────────────────────────────────────────────────────────┘ │
│           │                                                                         │
│           ▼                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                                │ │
│  │   DiscussionContext (discussion-provider.tsx:38-72)                           │ │
│  │   - currentUserId, currentUser                                                 │ │
│  │   - users: UsersRecord                                                         │ │
│  │   - discussions: TDiscussion[]                                                 │ │
│  │   - Mutation callbacks                                                         │ │
│  │                                                                                │ │
│  └────────┬──────────────────────────────────────────────────────────────────────┘ │
│           │                                                                         │
│           │ useDiscussionPluginSync (discussion-kit.tsx:252-341)                   │
│           ▼                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                                │ │
│  │   discussionPlugin.options (discussion-kit.tsx:361-374)                       │ │
│  │   - currentUserId                                                              │ │
│  │   - discussions                                                                │ │
│  │   - users                                                                      │ │
│  │   - marksInjectedAt                                                            │ │
│  │                                                                                │ │
│  └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                                │ │
│  │   HOCUSPOCUS ◄───── WebSocket ────► editor.children (Yjs-managed)             │ │
│  │   (SQLite on Railway)                                                          │ │
│  │                                                                                │ │
│  │   Contains: Document text with comment marks (comment_{id}: true)              │ │
│  │                                                                                │ │
│  └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Scenario A: Creating a New Inline Comment

### 5.1 Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: User selects text                                                           │
│  ─────────────────────────                                                           │
│                                                                                      │
│  File: comment-kit.tsx (lines 83-95)                                                 │
│  Trigger: Keyboard shortcut (mod+shift+m) or block menu                              │
│                                                                                      │
│  Action:                                                                             │
│  1. commentPlugin.extendTransforms.setDraft() is called                              │
│  2. If selection is collapsed → expand to full block                                 │
│  3. Apply draft mark: editor content gets `comment_draft: true` on selected nodes    │
│  4. Set activeId = getDraftCommentKey() = "comment_draft"                            │
│  5. Set commentingBlock = path to current block                                      │
│                                                                                      │
│  Result: Text is highlighted with draft styling                                      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: User types comment and presses Enter                                        │
│  ─────────────────────────────────────────────                                       │
│                                                                                      │
│  File: comment.tsx (lines 571-856)                                                   │
│  Function: onAddComment()                                                            │
│                                                                                      │
│  2a. Check if discussionId exists (line 576)                                         │
│      → For new inline comment: discussionId is undefined                             │
│                                                                                      │
│  2b. Get draft comment nodes (lines 663-667)                                         │
│      const commentsNodeEntry = editor.getApi(CommentPlugin)                          │
│        .comment.nodes({ at: [], isDraft: true });                                    │
│                                                                                      │
│  2c. Extract selected text and positions (lines 669-679)                             │
│      documentContent = nodes.map(n => n.text).join('');                              │
│      selectionStart = getCharacterOffsetFromPath(editor, firstPath);                 │
│      selectionEnd = selectionStart + documentContent.length;                         │
│                                                                                      │
│  2d. Store draft node paths BEFORE async call (line 683)                             │
│      const draftNodePaths = commentsNodeEntry.map(([, path]) => [...path]);          │
│      ◄── CRITICAL: Paths may change during async operation                          │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Create temp discussion for optimistic UI                                    │
│  ─────────────────────────────────────────────                                       │
│                                                                                      │
│  File: comment.tsx (lines 697-720)                                                   │
│                                                                                      │
│  const tempId = `temp_${nanoid()}`;    // e.g., "temp_V1StGXR8_Z5jdHi6B-myT"         │
│                                                                                      │
│  const newDiscussion: TDiscussion = {                                                │
│    id: tempId,                                                                       │
│    comments: [{ id: nanoid(), contentRich, ... }],                                   │
│    createdAt: new Date(),                                                            │
│    documentContent,                                                                  │
│    isResolved: false,                                                                │
│    userId: currentUserId,                                                            │
│  };                                                                                  │
│                                                                                      │
│  editor.setOption(discussionPlugin, 'discussions', [...discussions, newDiscussion]); │
│                                                                                      │
│  Note: This is BEFORE calling Convex - provides immediate feedback                   │
│  Note: The temp discussion has NO mark in the editor yet                             │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: Call Convex mutation                                                        │
│  ───────────────────────────                                                         │
│                                                                                      │
│  File: comment.tsx (lines 723-730)                                                   │
│                                                                                      │
│  const convexId = await ctx.createComment({                                          │
│    type: 'inline',                                                                   │
│    content: commentValue,                                                            │
│    selectedText: documentContent,                                                    │
│    selectionStart,                                                                   │
│    selectionEnd,                                                                     │
│  });                                                                                 │
│                                                                                      │
│  ctx.createComment calls: use-kb-comment-mutations.ts (lines 241-270)                │
│    → Serializes Value to text                                                        │
│    → Calls createMutation() with Convex args                                         │
│    → Returns: Convex ID (e.g., "k576789abc12345")                                    │
│                                                                                      │
│  Convex backend: convex/knowledge/comments.ts (lines 704-837)                        │
│    → Validates document access                                                       │
│    → Inserts into kbDocumentComments table                                           │
│    → Returns new document._id                                                        │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: Apply mark with Convex ID                                                   │
│  ──────────────────────────────────                                                  │
│                                                                                      │
│  File: comment.tsx (lines 737-778)                                                   │
│                                                                                      │
│  const markKey = getCommentKey(convexId);  // "comment_k576789abc12345"              │
│                                                                                      │
│  editor.tf.withMerging(() => {                                                       │
│    // Try to apply mark at stored paths                                              │
│    for (const path of draftNodePaths) {                                              │
│      const currentNode = editor.api.node({ at: path });                              │
│      if (currentNode && getDraftCommentKey() in currentNode[0]) {                    │
│        editor.tf.unsetNodes([getDraftCommentKey()], { at: path });                   │
│        editor.tf.setNodes({ [markKey]: true }, { at: path, split: true });           │
│      }                                                                               │
│    }                                                                                 │
│                                                                                      │
│    // Fallback: find any remaining draft nodes                                       │
│    const remainingDraftNodes = Array.from(editor.api.nodes({                         │
│      at: [],                                                                         │
│      match: (node) => getDraftCommentKey() in node && node[getDraftCommentKey()],    │
│    }));                                                                              │
│    for (const [, path] of remainingDraftNodes) {                                     │
│      editor.tf.unsetNodes([getDraftCommentKey()], { at: path });                     │
│      editor.tf.setNodes({ [markKey]: true }, { at: path, split: true });             │
│    }                                                                                 │
│  });                                                                                 │
│                                                                                      │
│  ◄── PROBLEM: If this fails silently, mark is NOT applied but comment IS saved      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: Update local discussions with Convex ID                                     │
│  ───────────────────────────────────────────────                                     │
│                                                                                      │
│  File: comment.tsx (lines 796-803)                                                   │
│                                                                                      │
│  const currentDiscussions = editor.getOption(discussionPlugin, 'discussions');       │
│  const updatedDiscussions = currentDiscussions.map((d: TDiscussion) =>               │
│    d.id === tempId                                                                   │
│      ? { ...d, id: convexId, comments: d.comments.map(c => ({...c, discussionId: convexId})) }│
│      : d                                                                             │
│  );                                                                                  │
│  editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);              │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 7: Yjs syncs mark to Hocuspocus                                                │
│  ────────────────────────────────────                                                │
│                                                                                      │
│  The editor.tf.setNodes() call in Step 5 modifies editor.children                    │
│  Yjs automatically detects this change and syncs to Hocuspocus server                │
│  Mark with `comment_k576789abc12345` is now persisted in Yjs document               │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 8: BlockDiscussion renders comment icon                                        │
│  ─────────────────────────────────────────────                                       │
│                                                                                      │
│  File: block-discussion.tsx (lines 48-101)                                           │
│                                                                                      │
│  BlockDiscussion.render.aboveNodes is called for each block                          │
│                                                                                      │
│  1. Get comment nodes at this block path (line 62)                                   │
│     const commentNodes = [...api.comment.nodes({ at: blockPath })];                  │
│                                                                                      │
│  2. useResolvedDiscussion filters discussions (lines 359-497)                        │
│     - Builds set of IDs from marks: commentsWithMarks                                │
│     - Filters discussions where:                                                     │
│       a) discussion.isResolved === false                                             │
│       b) commentsWithMarks.has(discussion.id) === true  ◄── ID must match exactly   │
│                                                                                      │
│  3. If discussions found, render trigger button (lines 289-317)                      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Why First Comment Sometimes Fails

The issue is in **Step 5** (comment.tsx lines 739-778):

```
PROBLEM: Path Invalidation During Async

Timeline:
1. T0: Store draftNodePaths = [[0, 1]]  (path to draft node)
2. T1: Call Convex (async, takes ~200ms)
3. T2: Another user edits document via Yjs
4. T3: Yjs changes editor content, paths shift: [[0, 1]] is now different node
5. T4: Convex returns, try to apply mark at stored path [[0, 1]]
6. T5: Path is wrong → getDraftCommentKey() NOT in node → skip
7. T6: Fallback finds remaining drafts → but if Yjs cleared them, empty
8. T7: Mark NOT applied, but comment IS in Convex
```

Additionally, even without Yjs interference:

```
PROBLEM: Draft Mark Clearing Race Condition

1. setDraft() applies comment_draft mark
2. User submits comment
3. onAddComment() starts async operation
4. Meanwhile, BlockDiscussion re-renders
5. If popover closes, it calls editor.tf.unsetNodes(getDraftCommentKey(), ...)
   (block-discussion.tsx line 225)
6. Draft mark is removed BEFORE Step 5 can replace it
7. Mark not applied
```

---

## 6. Scenario B: Page Refresh with Existing Comments

### 6.1 Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Page loads, Convex queries execute                                          │
│  ───────────────────────────────────────────                                         │
│                                                                                      │
│  File: use-kb-discussions.ts (lines 248-413)                                         │
│                                                                                      │
│  useQuery(api.knowledge.comments.getInline, { documentId, includeResolved: false }); │
│                                                                                      │
│  Returns: CommentListItem[] with:                                                    │
│  - _id: Convex ID (e.g., "k576789abc12345")                                          │
│  - selectionStart: number (character offset)                                         │
│  - selectionEnd: number (character offset)                                           │
│  - selectedText: string                                                              │
│                                                                                      │
│  Transforms to TDiscussion[]:                                                        │
│  - id: comment._id.toString()  // Convex ID                                          │
│  - selectionStart, selectionEnd copied from comment                                  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Yjs connects and syncs editor content                                       │
│  ─────────────────────────────────────────────                                       │
│                                                                                      │
│  File: use-hocuspocus-provider.ts (lines 136-249)                                    │
│                                                                                      │
│  1. usePlateEditor() creates editor with YjsPlugin                                   │
│  2. skipInitialization: true → Yjs manages content                                   │
│  3. editor.api.yjs.init() connects to Hocuspocus                                     │
│  4. onSyncChange fires when Yjs document is synced (line 208)                        │
│  5. If synced and editor has children → setIsEditorReady(true)                       │
│                                                                                      │
│  Content from Hocuspocus includes marks:                                             │
│  - Properly created comments: `comment_k576789abc12345: true`                        │
│  - If nanoid was used (old bug): `comment_V1StGXR8_Z5jdHi6B-myT: true`               │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: DiscussionProvider hydrates context                                         │
│  ───────────────────────────────────────────                                         │
│                                                                                      │
│  File: discussion-provider.tsx (lines 197-266)                                       │
│                                                                                      │
│  Provides to children:                                                               │
│  - discussions: TDiscussion[] from useKBDiscussions                                  │
│  - users: UsersRecord                                                                │
│  - currentUserId: string                                                             │
│  - Mutation callbacks                                                                │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: useDiscussionPluginSync runs                                                │
│  ─────────────────────────────────────                                               │
│                                                                                      │
│  File: discussion-kit.tsx (lines 252-341)                                            │
│                                                                                      │
│  4a. Sync context to plugin options (lines 263-268)                                  │
│      editor.setOption(discussionPlugin, 'currentUserId', ctx.currentUserId);         │
│      editor.setOption(discussionPlugin, 'discussions', ctx.discussions);             │
│      editor.setOption(discussionPlugin, 'users', ctx.users);                         │
│                                                                                      │
│  4b. Wait for editor ready (lines 273-284)                                           │
│      - Check isEditorReady (from Yjs sync)                                           │
│      - Check ctx.isLoading === false                                                 │
│      - Check editor.children.length > 0                                              │
│      - Check NOT default empty paragraph                                             │
│                                                                                      │
│  4c. Inject comment marks (line 330)                                                 │
│      injectCommentMarks(editor, ctx.discussions, injectedIdsRef.current);            │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: injectCommentMarks() applies marks                                          │
│  ───────────────────────────────────────────                                         │
│                                                                                      │
│  File: discussion-kit.tsx (lines 62-216)                                             │
│                                                                                      │
│  For each discussion with selectionStart/selectionEnd:                               │
│                                                                                      │
│  1. Convert character offsets to Slate points (lines 127-128)                        │
│     const startPoint = getPointFromCharacterOffset(editor, selectionStart);          │
│     const endPoint = getPointFromCharacterOffset(editor, selectionEnd);              │
│                                                                                      │
│  2. Build range (line 154)                                                           │
│     const range = { anchor: startPoint, focus: endPoint };                           │
│                                                                                      │
│  3. Apply mark (lines 166-172)                                                       │
│     editor.tf.setNodes(                                                              │
│       { [getCommentKey(id)]: true },  // "comment_k576789abc12345"                   │
│       { at: range, match: (node) => 'text' in node, split: true }                    │
│     );                                                                               │
│                                                                                      │
│  4. Mark as injected (line 202)                                                      │
│     injectedIds.add(id);                                                             │
│                                                                                      │
│  5. Trigger re-render (line 334)                                                     │
│     editor.setOption(discussionPlugin, 'marksInjectedAt', Date.now());               │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: BlockDiscussion renders                                                     │
│  ───────────────────────────────                                                     │
│                                                                                      │
│  File: block-discussion.tsx (lines 48-101)                                           │
│                                                                                      │
│  For each block in editor:                                                           │
│  1. Find comment nodes: api.comment.nodes({ at: blockPath })                         │
│  2. useResolvedDiscussion matches marks to discussions                               │
│  3. Render comment icon if matches found                                             │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Why Comments Sometimes Don't Show After Refresh

**Root Cause 1: ID Mismatch (Historical Bug)**

If comments were created with nanoid marks (old code), the Yjs document has:
```javascript
{ text: "selected text", comment_V1StGXR8_Z5jdHi6B-myT: true }
```

But Convex has:
```javascript
{ _id: "k576789abc12345", ... }
```

`injectCommentMarks()` tries to apply `comment_k576789abc12345`, but the old nanoid mark already exists. Now there are TWO marks on the same text, but `useResolvedDiscussion` only finds one ID.

**Root Cause 2: Race Condition with Yjs Content**

```
Timeline:
1. T0: Yjs fires onSyncChange with isSynced=true
2. T1: editor.children is EMPTY (Yjs hasn't populated yet)
3. T2: Plate inserts default paragraph (single empty <p>)
4. T3: editor.children.length > 0 → isEditorReady = true
5. T4: injectCommentMarks() runs on the DEFAULT PARAGRAPH
6. T5: Marks applied to temp content at wrong positions
7. T6: Yjs actually populates real content → replaces default paragraph
8. T7: MARKS LOST - they were on the temp content

Current mitigation (lines 305-322):
- Check for default empty paragraph pattern
- Wait for real content

But this can fail if:
- Real content is ALSO a single paragraph
- Or race condition timing differs
```

**Root Cause 3: Character Offset Drift**

If document content changed since comment was created:
```
Original: "Hello world" (11 chars)
Comment: selectionStart=0, selectionEnd=5 (selects "Hello")

After edit: "Hi world" (8 chars)
injectCommentMarks: getPointFromCharacterOffset(editor, 5)
→ Returns point in "world" instead of "Hi"
→ Wrong text highlighted OR null point if offset > total chars
```

---

## 7. Scenario C: Real-time Sync (Another User's Comment)

### 7.1 Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: User B creates comment                                                      │
│  ───────────────────────────────                                                     │
│                                                                                      │
│  On User B's browser:                                                                │
│  1. onAddComment() saves to Convex (gets ID: k576789abc12345)                        │
│  2. Mark applied: { comment_k576789abc12345: true }                                  │
│  3. Yjs syncs mark to Hocuspocus                                                     │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
          ┌────────────────────────────┴────────────────────────────┐
          │                                                         │
          ▼                                                         ▼
┌─────────────────────────────┐                    ┌────────────────────────────────┐
│  STEP 2a: Yjs updates        │                    │  STEP 2b: Convex subscription  │
│  User A's editor content     │                    │  updates User A's queries      │
│  ────────────────────────────│                    │  ──────────────────────────────│
│                              │                    │                                │
│  Hocuspocus broadcasts       │                    │  useQuery() re-runs for:       │
│  to all connected clients    │                    │  - api.knowledge.comments.     │
│                              │                    │    getInline                   │
│  User A's editor.children    │                    │                                │
│  now has:                    │                    │  Returns new comment with:     │
│  { text: "...",              │                    │  _id: k576789abc12345          │
│    comment_k576789abc12345:  │                    │  selectionStart, selectionEnd  │
│    true }                    │                    │                                │
│                              │                    │                                │
└───────────────┬──────────────┘                    └───────────────┬────────────────┘
                │                                                   │
                │                                                   │
                ▼                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: States should align                                                         │
│  ───────────────────────────                                                         │
│                                                                                      │
│  IDEAL: Both arrive at same time                                                     │
│  - editor has mark with ID k576789abc12345                                           │
│  - discussions array has discussion with id k576789abc12345                          │
│  - BlockDiscussion matches them → shows icon                                         │
│                                                                                      │
│  PROBLEM: They may arrive out of order                                               │
│  - Yjs is WebSocket (fast, continuous)                                               │
│  - Convex is HTTP polling (batched, may lag)                                         │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: BlockDiscussion tries to render                                             │
│  ───────────────────────────────────────                                             │
│                                                                                      │
│  File: block-discussion.tsx (lines 359-497)                                          │
│                                                                                      │
│  useResolvedDiscussion():                                                            │
│  1. Get marks from editor: commentsWithMarks = Set([k576789abc12345])                │
│  2. Get discussions from plugin: discussions = [...]                                 │
│  3. Filter: discussion.id must be in commentsWithMarks                               │
│                                                                                      │
│  RACE CONDITION CASE:                                                                │
│  If Yjs arrived first:                                                               │
│    - commentsWithMarks = Set([k576789abc12345])                                      │
│    - discussions = [] (Convex not updated yet)                                       │
│    - Result: Mark visible (highlight), but no icon (no discussion data)              │
│                                                                                      │
│  If Convex arrived first:                                                            │
│    - commentsWithMarks = Set([]) (mark not in editor yet)                            │
│    - discussions = [{ id: k576789abc12345, ... }]                                    │
│    - Result: No mark (no highlight), no icon (filter fails)                          │
│                                                                                      │
│  Eventually: Both arrive → matches → icon appears                                    │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Sync Issues

The system lacks atomic synchronization between:
1. **Yjs marks** (synced via Hocuspocus WebSocket)
2. **Convex discussion data** (synced via HTTP polling)

This can cause temporary visual glitches where:
- Highlighted text appears without comment icon
- Comment icon appears at wrong position
- Comment list shows "empty" briefly

---

## 8. Sync Points

### 8.1 Where/When Different States Synchronize

| Sync Point | Trigger | Source → Destination | File:Line |
|------------|---------|---------------------|-----------|
| Context → Plugin | Effect on ctx change | DiscussionContext → discussionPlugin.options | discussion-kit.tsx:263-268 |
| Convex → Context | useQuery reactivity | Convex DB → useKBDiscussions → DiscussionContext | use-kb-discussions.ts:254-257 |
| Mark Injection | Editor ready + discussions loaded | TDiscussion.selectionStart/End → editor marks | discussion-kit.tsx:330 |
| Mark → Path Map | Effect on commentNodes change | editor marks → uniquePathMap | block-discussion.tsx:386-410 |
| Yjs → Editor | Hocuspocus WebSocket | Hocuspocus server → editor.children | use-hocuspocus-provider.ts:208 |
| Editor → Yjs | Any editor change | editor.children → Hocuspocus server | Automatic via YjsPlugin |
| UI Re-render | marksInjectedAt change | discussionPlugin.options → BlockDiscussion | block-discussion.tsx:371 |

### 8.2 Critical Timing Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         DEPENDENCY GRAPH                                             │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────┐                                                                     │
│  │ Yjs Sync    │─────────┐                                                           │
│  │ (WebSocket) │         │                                                           │
│  └─────────────┘         │                                                           │
│        │                 ▼                                                           │
│        │         ┌──────────────────┐                                                │
│        └────────►│ isEditorReady    │                                                │
│                  │ (wait for both)  │                                                │
│  ┌─────────────┐ └────────┬─────────┘                                                │
│  │ Convex Load │         │                                                           │
│  │ (useQuery)  │─────────┘                                                           │
│  └──────┬──────┘         │                                                           │
│         │                ▼                                                           │
│         │        ┌──────────────────┐                                                │
│         └───────►│ injectCommentMarks│◄─── Requires BOTH:                            │
│                  │                   │     1. editor.children populated (Yjs)        │
│                  │                   │     2. discussions loaded (Convex)            │
│                  └────────┬──────────┘                                               │
│                           │                                                          │
│                           ▼                                                          │
│                  ┌──────────────────┐                                                │
│                  │ marksInjectedAt  │                                                │
│                  │ timestamp update │                                                │
│                  └────────┬─────────┘                                                │
│                           │                                                          │
│                           ▼                                                          │
│                  ┌──────────────────┐                                                │
│                  │ BlockDiscussion  │                                                │
│                  │ re-renders       │                                                │
│                  └──────────────────┘                                                │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Current Bugs - Root Cause Analysis

### 9.1 BUG: First Comment Fails (No Icon, No Highlight) But Saves to Convex

**Symptoms:**
- User creates inline comment
- Comment saves to Convex (visible on refresh)
- No highlight on text
- No comment icon next to block

**Root Cause:**
The mark application in `onAddComment()` (comment.tsx:739-778) fails silently due to:

1. **Path Invalidation** (Primary cause):
   - Paths stored at line 683: `draftNodePaths = commentsNodeEntry.map(...)`
   - Convex call is async (takes 100-500ms)
   - During this time, Yjs may update editor content
   - Paths shift, stored paths point to wrong nodes
   - `getDraftCommentKey() in currentNode[0]` returns false
   - Mark not applied

2. **Draft Mark Cleared Early** (Secondary cause):
   - If BlockDiscussion popover closes during async operation
   - Line 225 calls `editor.tf.unsetNodes(getDraftCommentKey(), ...)`
   - Draft marks removed before replacement

3. **No Retry Mechanism**:
   - If mark application fails, there's no retry
   - Comment exists in Convex but no mark in editor
   - Only visible after refresh (when injectCommentMarks runs)

**Evidence:**
```javascript
// comment.tsx:782-793 - Verification logging shows mark not found
console.log('[Comment] Mark applied with Convex ID:', {
  markKey,
  marksFound: Array.from(editor.api.nodes({
    at: [],
    match: (node) => markKey in node && node[markKey] === true,
  })).length,  // Often 0 when bug occurs
});
```

### 9.2 BUG: Second Comment Works

**Why it works:**
After page load with existing comments:
1. `injectCommentMarks()` has already run
2. `uniquePathMap` is populated with correct paths
3. New comment creation follows same flow
4. BUT: The editor content is now stable (Yjs sync complete)
5. Paths don't shift during async operation
6. Mark application succeeds

**The difference:**
- First comment: Created immediately after page load, Yjs still syncing
- Second comment: Created after Yjs has stabilized

### 9.3 BUG: ID Mismatch After Refresh

**Symptoms:**
- Comments created, visible during session
- After refresh, some comments don't show
- Console shows mismatched IDs

**Root Cause:**
Historical issue with nanoid marks being synced to Yjs:

```
BEFORE FIX (old code):
1. User creates comment
2. Mark applied with nanoid: comment_V1StGXR8_Z5jdHi6B-myT
3. Convex returns real ID: k576789abc12345
4. Local discussions updated with real ID
5. BOTH marks exist in editor OR nanoid mark synced to Yjs

After refresh:
- Yjs has: comment_V1StGXR8_Z5jdHi6B-myT (nanoid)
- Convex has: id = k576789abc12345
- injectCommentMarks tries to add comment_k576789abc12345
- Two different marks on same text
- BlockDiscussion only matches Convex ID
- But editor mark has nanoid ID
- Mismatch → comment not visible
```

**Current Code Fix Attempt (comment.tsx:685-694):**
```javascript
// FIX: Don't apply nanoid mark - wait for Convex ID
// The problem: nanoid marks sync to Yjs immediately, but Convex uses different IDs.
// On refresh, Yjs has nanoid marks but Convex has real IDs -> mismatch.
//
// NEW FLOW:
// 1. Keep draft mark visible for optimistic UI (don't remove it yet)
// 2. Call Convex to get the real ID
// 3. Only then replace draft mark with Convex ID mark
// 4. This ensures only Convex IDs are synced to Yjs
```

**Why fix is incomplete:**
The fix prevents NEW nanoid marks, but:
1. Old data in Hocuspocus may still have nanoid marks
2. Mark application can still fail (path invalidation issue)
3. No migration for existing documents

### 9.4 BUG: Comments Sometimes Not Visible After Refresh

**Root Cause: Character Offset Drift**

Comments store `selectionStart` and `selectionEnd` as character offsets from document start. If document content changes:

```
Example:
Original: "Line 1\nLine 2\nLine 3"
Comment on "Line 2": selectionStart=7, selectionEnd=13

Edit: Delete "Line 1\n"
New content: "Line 2\nLine 3"
Comment positions now wrong: offset 7-13 is "2\nLine" instead of "Line 2"
```

`injectCommentMarks()` (discussion-kit.tsx:127-145):
```javascript
const startPoint = getPointFromCharacterOffset(editor, selectionStart!);
const endPoint = getPointFromCharacterOffset(editor, selectionEnd!);

if (!startPoint || !endPoint) {
  // Returns null if offset > total characters
  // Comment mark not injected
  continue;
}
```

---

## 10. Recommended Fix

### 10.1 Core Problem Statement

The system has a fundamental design flaw: **two separate sync mechanisms for related data**.

- **Yjs**: Syncs editor content including marks
- **Convex**: Syncs discussion metadata including positions

These are not atomically coordinated, leading to:
1. Race conditions during creation
2. ID mismatches from historical bugs
3. Position drift when document changes

### 10.2 Recommended Architecture Change

**Option A: Mark-as-Source-of-Truth (Recommended)**

Store the discussion ID IN the Yjs document only, not character offsets in Convex.

```
Current:
- Convex: stores selectionStart, selectionEnd (positions)
- Yjs: stores marks with discussion ID

Proposed:
- Convex: stores ONLY discussion content, no positions
- Yjs: stores marks with discussion ID (positions implicit)
- On load: find marks in Yjs, fetch discussion data by ID from Convex
- No mark injection needed
```

**Benefits:**
1. No position drift (marks move with content in Yjs)
2. No mark injection timing issues
3. Single source of truth for positions
4. Simpler code path

**Implementation:**
1. Remove `selectionStart`, `selectionEnd`, `selectedText` from Convex
2. Remove `injectCommentMarks()` function
3. Modify `useKBDiscussions` to not filter by position
4. `BlockDiscussion.useResolvedDiscussion` already finds marks by ID
5. Migrate existing comments to have correct Yjs marks

**Option B: Convex-as-Source-of-Truth (More Work)**

Remove marks from Yjs entirely, render based on Convex positions only.

**Downsides:**
- Collaborative mark rendering complex
- Position drift still an issue
- Major refactor of Plate.js comment plugin

### 10.3 Immediate Fixes (Without Architecture Change)

**Fix 1: Make Mark Application Reliable**

In `comment.tsx:onAddComment()`:

```javascript
// After Convex returns ID, apply mark with retry
const applyMarkWithRetry = async (convexId: string, maxRetries = 3) => {
  const markKey = getCommentKey(convexId);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Find ALL draft nodes currently in editor (not stored paths)
    const draftNodes = Array.from(editor.api.nodes({
      at: [],
      match: (node) => 
        typeof node === 'object' && 
        getDraftCommentKey() in node &&
        node[getDraftCommentKey()] === true,
    }));
    
    if (draftNodes.length > 0) {
      editor.tf.withMerging(() => {
        for (const [, path] of draftNodes) {
          editor.tf.unsetNodes([getDraftCommentKey()], { at: path });
          editor.tf.setNodes({ [markKey]: true }, { at: path, split: true });
        }
      });
      
      // Verify mark was applied
      const verifyNodes = Array.from(editor.api.nodes({
        at: [],
        match: (node) => markKey in node && node[markKey] === true,
      }));
      
      if (verifyNodes.length > 0) {
        return true; // Success
      }
    }
    
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
  }
  
  return false; // Failed after retries
};
```

**Fix 2: Prevent Draft Mark Removal During Submission**

Add a flag to prevent premature draft removal:

```javascript
// comment-kit.tsx - add to options
isSubmitting: false,

// comment.tsx - set before async call
editor.setOption(commentPlugin, 'isSubmitting', true);
const convexId = await ctx.createComment(...);
editor.setOption(commentPlugin, 'isSubmitting', false);

// block-discussion.tsx - check before removing draft
if (!editor.getOption(commentPlugin, 'isSubmitting')) {
  editor.tf.unsetNodes(getDraftCommentKey(), ...);
}
```

**Fix 3: Clean Up Orphaned Nanoid Marks**

Add cleanup for historical nanoid marks:

```javascript
// In useDiscussionPluginSync after mark injection
const cleanupOrphanedMarks = () => {
  const convexIds = new Set(ctx.discussions.map(d => d.id));
  
  // Find all comment marks in editor
  const allMarks = Array.from(editor.api.nodes({
    at: [],
    match: (node) => {
      if (!('text' in node)) return false;
      return Object.keys(node).some(k => 
        k.startsWith('comment_') && 
        k !== getDraftCommentKey()
      );
    },
  }));
  
  // Remove marks that don't match any Convex discussion
  for (const [node, path] of allMarks) {
    const markKeys = Object.keys(node).filter(k => 
      k.startsWith('comment_') && 
      k !== getDraftCommentKey()
    );
    
    for (const key of markKeys) {
      const id = key.replace('comment_', '');
      if (!convexIds.has(id)) {
        editor.tf.unsetNodes([key], { at: path });
      }
    }
  }
};
```

### 10.4 Migration Path

1. **Phase 1**: Apply immediate fixes (Fix 1-3)
2. **Phase 2**: Track ID format in Convex (add `markIdFormat: 'convex' | 'nanoid'`)
3. **Phase 3**: Migration script to fix existing Yjs documents
4. **Phase 4**: (Optional) Implement architecture change

---

## 11. Quality Gates Verification

- [x] All relevant files examined
  - comment.tsx (929 lines)
  - block-discussion.tsx (497 lines)
  - discussion-kit.tsx (385 lines)
  - comment-kit.tsx (147 lines)
  - discussion-provider.tsx (336 lines)
  - use-kb-discussions.ts (447 lines)
  - use-kb-comment-mutations.ts (445 lines)
  - convex/knowledge/comments.ts (1297 lines)
  - use-hocuspocus-provider.ts (392 lines)
  - editor.tsx (431 lines)
  - floating-discussion.tsx (1092 lines)
  - comment-node.tsx (45 lines)

- [x] All 3 scenarios documented with actual code references
  - Scenario A: Creating new inline comment - 8 steps with file:line refs
  - Scenario B: Page refresh with existing comments - 6 steps with file:line refs
  - Scenario C: Real-time sync - 4 steps with file:line refs

- [x] ID flow clearly mapped
  - Convex ID format and generation
  - nanoid format (historical issue)
  - getCommentKey() transformation
  - getDraftCommentKey() usage

- [x] Root cause of "first comment fails" identified
  - Path invalidation during async Convex call
  - Draft mark cleared prematurely
  - No retry mechanism

- [x] Root cause of "ID mismatch after refresh" identified
  - Historical nanoid marks in Yjs
  - Convex uses different ID format
  - Two marks on same text, filter only matches one

- [x] Recommended fix addresses BOTH issues coherently
  - Architecture change proposal (Mark-as-Source-of-Truth)
  - Immediate fixes for current architecture
  - Migration path for existing data

---

**Document Author:** System Architect Agent  
**Review Status:** Pending Implementation Agent Review
