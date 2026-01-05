# Dependency Mapping: Potion Template vs BDR LMS

## Overview

This document compares the dependencies between the Potion template and our BDR LMS project to identify:
1. Dependencies we already have
2. Dependencies we need to add
3. Version conflicts to resolve
4. Dependencies to skip (different architecture)

---

## 1. Package Manager & Node Version

| | Potion | BDR LMS | Action |
|---|--------|---------|--------|
| **Package Manager** | Bun 1.3.3 | pnpm | Keep pnpm |
| **Node Version** | Not specified | Not specified | No change |

---

## 2. Framework Dependencies

### Already Have (Compatible)

| Package | Potion Version | BDR Version | Status |
|---------|---------------|-------------|--------|
| `react` | 19.2.1 | 19.2.1 | EXACT MATCH |
| `react-dom` | 19.2.1 | 19.2.1 | EXACT MATCH |
| `next` | 16.0.7 | 15.5.7 | **CONFLICT** - Potion uses Next 16 |
| `typescript` | 5.9.3 | ^5 | Compatible |
| `tailwindcss` | 4.1.17 | ^4 | Compatible |
| `@tailwindcss/postcss` | 4.1.17 | ^4 | Compatible |

### Next.js Version Note

Potion uses Next.js 16.0.7 while we use 15.5.7. However, the Plate.js components are framework-agnostic and should work with our version. We should NOT upgrade Next.js just for this.

---

## 3. Plate.js Dependencies

### Already Have (All at v52)

| Package | Potion | BDR | Status |
|---------|--------|-----|--------|
| `platejs` | 52.0.15 | 52.0.15 | EXACT MATCH |
| `@udecode/cn` | 52.0.1 | 52.0.1 | EXACT MATCH |
| `@platejs/ai` | 52.0.11 | 52.0.10 | Minor diff |
| `@platejs/autoformat` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/basic-nodes` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/basic-styles` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/callout` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/caption` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/code-block` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/combobox` | 52.0.15 | 52.0.1 | Minor diff |
| `@platejs/comment` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/date` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/dnd` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/emoji` | 52.0.15 | 52.0.2 | Minor diff |
| `@platejs/floating` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/indent` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/layout` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/link` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/list` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/markdown` | 52.0.11 | 52.0.10 | Minor diff |
| `@platejs/math` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/media` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/mention` | 52.0.15 | 52.0.1 | Minor diff |
| `@platejs/resizable` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/selection` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/slash-command` | 52.0.15 | 52.0.1 | Minor diff |
| `@platejs/suggestion` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/table` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/toc` | 52.0.11 | 52.0.1 | Minor diff |
| `@platejs/toggle` | 52.0.11 | 52.0.1 | Minor diff |

### Need to Add (Plate.js)

| Package | Version | Purpose | Priority |
|---------|---------|---------|----------|
| `@platejs/diff` | 52.0.11 | Version history diffs | HIGH |
| `@platejs/docx` | 52.0.11 | DOCX import | MEDIUM |
| `@platejs/juice` | 52.0.11 | HTML email export | LOW |
| `@platejs/yjs` | 52.0.13 | Real-time collaboration | CRITICAL |
| `@platejs/test-utils` | 52.0.10 | Testing utilities | MEDIUM |

---

## 4. Real-Time Collaboration Dependencies

### Need to Add for YJS/Hocuspocus

| Package | Version | Purpose | Priority |
|---------|---------|---------|----------|
| `yjs` | 13.6.27 | CRDT implementation | CRITICAL |
| `@hocuspocus/provider` | 3.4.0 | Client provider | CRITICAL |
| `@hocuspocus/server` | 3.4.0 | Server implementation | CRITICAL |
| `@hocuspocus/extension-logger` | 3.4.0 | Server logging | MEDIUM |
| `@hocuspocus/extension-redis` | 3.4.0 | Redis pub/sub | HIGH |
| `@slate-yjs/core` | 1.0.2 | Slate ↔ YJS bridge | CRITICAL |
| `@slate-yjs/react` | 1.1.0 | React hooks for slate-yjs | CRITICAL |
| `ioredis` | 5.8.2 | Redis client | HIGH |

### Slate Overrides (Required)

Potion specifies exact Slate versions in `overrides`:
```json
"overrides": {
  "slate": "0.118.1",
  "slate-dom": "0.118.1",
  "slate-react": "0.117.4"
}
```

We need to add these to our package.json to ensure YJS compatibility.

---

## 5. UI Dependencies

### Already Have

| Package | Potion | BDR | Status |
|---------|--------|-----|--------|
| `@ariakit/react` | 0.4.20 | 0.4.20 | EXACT MATCH |
| `class-variance-authority` | 0.7.1 | 0.7.1 | EXACT MATCH |
| `clsx` | 2.1.1 | 2.1.1 | EXACT MATCH |
| `cmdk` | 1.1.1 | 1.1.1 | EXACT MATCH |
| `lucide-react` | 0.555.0 | 0.556.0 | Minor diff |
| `sonner` | 2.0.7 | 2.0.7 | EXACT MATCH |
| `tailwind-merge` | 3.4.0 | 3.4.0 | EXACT MATCH |
| `tailwind-scrollbar-hide` | 4.0.0 | 4.0.0 | EXACT MATCH |
| `tw-animate-css` | 1.4.0 | 1.4.0 | EXACT MATCH |
| `vaul` | 1.1.2 | 1.1.2 | EXACT MATCH |
| `next-themes` | 0.4.6 | 0.4.6 | EXACT MATCH |
| `lowlight` | 3.3.0 | 3.3.0 | EXACT MATCH |
| `emoji-picker-react` | 4.16.1 | 4.16.1 | EXACT MATCH |
| `react-day-picker` | 8.10.1 | 9.12.0 | **Version diff** |
| `react-dnd` | 16.0.1 | 16.0.1 | EXACT MATCH |
| `react-dnd-html5-backend` | 16.0.1 | 16.0.1 | EXACT MATCH |
| `react-lite-youtube-embed` | 3.3.3 | 3.3.3 | EXACT MATCH |
| `react-player` | 3.4.0 | 3.3.1 | Minor diff |
| `react-tweet` | 3.2.2 | 3.2.2 | EXACT MATCH |
| `remark-gfm` | 4.0.1 | 4.0.1 | EXACT MATCH |
| `remark-math` | 6.0.0 | 6.0.0 | EXACT MATCH |
| `date-fns` | 4.1.0 | 4.1.0 | EXACT MATCH |
| `lodash` | 4.17.21 | 4.17.21 | EXACT MATCH |
| `zod` | 4.1.13 | 4.1.13 | EXACT MATCH |

### Need to Add (UI)

| Package | Version | Purpose | Priority |
|---------|---------|---------|----------|
| `radix-ui` | 1.4.3 | New unified Radix package | **EVALUATE** |
| `scroll-into-view-if-needed` | 3.1.0 | Scroll utilities | LOW |
| `use-stick-to-bottom` | 1.1.1 | Chat scroll behavior | LOW |

**Note on `radix-ui`**: Potion uses the new unified `radix-ui` package (1.4.3) while we use individual `@radix-ui/*` packages. The individual packages are fine; no need to change.

---

## 6. State Management

### Already Have

| Package | Potion | BDR | Status |
|---------|--------|-----|--------|
| `@tanstack/react-table` | Not used | 8.21.3 | BDR only |

### Need to Add

| Package | Version | Purpose | Priority |
|---------|---------|---------|----------|
| `jotai` | 2.15.2 | Atomic state management | MEDIUM |
| `jotai-x` | 2.3.3 | Extended jotai utilities | MEDIUM |
| `zustand` | 5.0.9 | Store-based state | MEDIUM |
| `zustand-x` | 6.2.1 | Extended zustand | MEDIUM |
| `immer` | 11.0.1 | Immutable updates | MEDIUM |

**Evaluation**: Potion uses Jotai + Zustand for editor-specific state. We could use these OR adapt to React Context. Recommend adding for easier component extraction.

---

## 7. File Upload

### Already Have

| Package | Potion | BDR | Status |
|---------|--------|-----|--------|
| `@uploadthing/react` | 7.3.3 | 7.3.3 | EXACT MATCH |
| `uploadthing` | 7.7.4 | 7.7.4 | EXACT MATCH |
| `use-file-picker` | 2.1.4 | 2.1.2 | Minor diff |

---

## 8. Backend Dependencies (SKIP)

These are NOT needed as we use Convex instead of Prisma/tRPC:

| Package | Purpose | Why Skip |
|---------|---------|----------|
| `@prisma/client` | Database ORM | We use Convex |
| `@prisma/adapter-pg` | PostgreSQL adapter | We use Convex |
| `prisma` | Prisma CLI | We use Convex |
| `pg` | PostgreSQL driver | We use Convex |
| `@trpc/client` | tRPC client | We use Convex |
| `@trpc/react-query` | tRPC React | We use Convex |
| `@trpc/server` | tRPC server | We use Convex |
| `@tanstack/react-query` | React Query | Convex has built-in |
| `@tanstack/react-query-devtools` | DevTools | Not needed |
| `hono` | HTTP framework | We use Convex |
| `@hono/zod-validator` | Validation | We use Convex |
| `better-auth` | Authentication | We use Clerk |
| `cookies-next` | Cookie handling | Clerk handles |
| `nuqs` | URL state | Optional |

---

## 9. AI Dependencies

### Need to Add

| Package | Version | Purpose | Priority |
|---------|---------|---------|----------|
| `@ai-sdk/react` | 2.0.106 | AI SDK React hooks | HIGH |
| `ai` | 5.0.106 | Vercel AI SDK | HIGH |

**Note**: We already have `openai` (6.15.0). The Vercel AI SDK provides a better streaming abstraction.

---

## 10. Miscellaneous Dependencies

### Already Have

| Package | Potion | BDR | Status |
|---------|--------|-----|--------|
| `nanoid` | Not in BDR | 5.1.6 | Need to add |

### Need to Add

| Package | Version | Purpose | Priority |
|---------|---------|---------|----------|
| `nanoid` | 5.1.6 | ID generation | MEDIUM |
| `mitt` | 3.0.1 | Event emitter | LOW |
| `dedent` | 1.7.0 | Template strings | LOW |
| `superjson` | 2.2.6 | JSON serialization | LOW |
| `string-comparison` | 1.3.0 | Fuzzy search | LOW |
| `canihazusername` | 2.4.1 | Username generation | LOW |
| `react-markdown` | 10.1.0 | Markdown rendering | MEDIUM |
| `react-lazy-load-image-component` | 1.6.3 | Image lazy loading | MEDIUM |
| `puppeteer` | 24.32.0 | PDF generation | MEDIUM |

---

## 11. Development Dependencies

### Already Have

| Package | Potion | BDR | Status |
|---------|--------|-----|--------|
| `@types/lodash` | 4.17.21 | 4.17.21 | EXACT MATCH |
| `@types/node` | 24.10.1 | ^20 | Compatible |
| `@types/react` | 19.2.7 | ^19 | Compatible |
| `@types/react-dom` | 19.2.3 | ^19 | Compatible |
| `eslint` | 9.39.1 | ^9 | Compatible |
| `postcss` | 8.5.6 | (via tailwindcss) | Compatible |
| `typescript` | 5.9.3 | ^5 | Compatible |

### Potion-Only (Not Needed)

| Package | Purpose | Why Skip |
|---------|---------|----------|
| `@biomejs/biome` | Linter/formatter | We use ESLint/Prettier |
| `lefthook` | Git hooks | We use own setup |
| `mprocs` | Process runner | We use pnpm scripts |
| `babel-plugin-react-compiler` | React compiler | Experimental |
| `react-compiler-runtime` | React compiler | Experimental |
| `dotenv-cli` | Env management | Convex handles |
| `fs-extra` | File system utils | Not needed |
| `ultracite` | Unknown | Not needed |

---

## 12. Install Commands

### Phase 1: Core Plate.js Extensions

```bash
pnpm add @platejs/diff@52.0.11 @platejs/docx@52.0.11 @platejs/yjs@52.0.13 @platejs/test-utils@52.0.10
```

### Phase 2: Real-Time Collaboration (Hocuspocus)

```bash
pnpm add yjs@13.6.27 @hocuspocus/provider@3.4.0 @hocuspocus/server@3.4.0 @hocuspocus/extension-logger@3.4.0 @hocuspocus/extension-redis@3.4.0 @slate-yjs/core@1.0.2 @slate-yjs/react@1.1.0 ioredis@5.8.2
```

### Phase 3: State Management

```bash
pnpm add jotai@2.15.2 jotai-x@2.3.3 zustand@5.0.9 zustand-x@6.2.1 immer@11.0.1
```

### Phase 4: AI SDK

```bash
pnpm add ai@5.0.106 @ai-sdk/react@2.0.106
```

### Phase 5: Utilities

```bash
pnpm add nanoid@5.1.6 react-markdown@10.1.0 scroll-into-view-if-needed@3.1.0
```

### Phase 6: PDF Export (Optional)

```bash
pnpm add puppeteer@24.32.0
```

### Package.json Overrides

Add to `package.json`:
```json
{
  "pnpm": {
    "overrides": {
      "slate": "0.118.1",
      "slate-dom": "0.118.1",
      "slate-react": "0.117.4"
    }
  }
}
```

---

## 13. Summary

### Dependencies by Priority

| Priority | Category | Count | Action |
|----------|----------|-------|--------|
| CRITICAL | Plate.js YJS | 7 | Install immediately |
| HIGH | Hocuspocus + Redis | 6 | Install for Phase 1 |
| HIGH | AI SDK | 2 | Install for AI features |
| MEDIUM | State Management | 5 | Install for component parity |
| MEDIUM | Utilities | 3 | Install as needed |
| LOW | Optional features | 5+ | Install later |
| SKIP | Prisma/tRPC/Hono | 15+ | Not needed (Convex) |

### Version Conflicts to Resolve

| Package | Potion | BDR | Resolution |
|---------|--------|-----|------------|
| Next.js | 16.0.7 | 15.5.7 | Keep BDR version |
| react-day-picker | 8.10.1 | 9.12.0 | Test with BDR version |
| react-player | 3.4.0 | 3.3.1 | Update to 3.4.0 |
| @types/node | 24.10.1 | ^20 | Keep BDR version |

### Estimated Install Size

- Phase 1 (Core): ~5 MB
- Phase 2 (Collaboration): ~15 MB
- Phase 3 (State): ~2 MB
- Phase 4 (AI): ~10 MB
- Phase 5 (Utils): ~1 MB
- Phase 6 (PDF): ~300 MB (Puppeteer with Chromium)

**Total (excluding Puppeteer): ~33 MB**

---

## 14. Next Steps

1. **Add Slate overrides** to package.json immediately
2. **Install Phase 1** (Plate.js extensions)
3. **Test existing editor** still works
4. **Install Phase 2** (Hocuspocus) when ready for collaboration
5. **Install Phase 3-4** as features require
