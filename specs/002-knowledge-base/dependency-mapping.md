# Dependency Mapping: Potion → Onboarding BDR

**Analysis Date**: 2026-01-03
**Potion Template**: `/Users/alexisdupre/potion-template/`
**Target Project**: `/Users/alexisdupre/onboarding-bdr-v2/`

---

## Executive Summary

| Category | Count |
|----------|-------|
| **Version Conflicts** | 4 (all LOW risk) |
| **Dependencies to Add** | 12 (4 CRITICAL) |
| **Dependencies to Skip** | 25+ (replaced by our stack) |
| **Breaking Changes** | 0 |

---

## 1. Version Conflicts

| Package | Potion Version | Our Version | Risk | Resolution |
|---------|----------------|-------------|------|------------|
| `next` | 16.0.7 | 15.5.7 | LOW | Keep 15.5.7 (stable) |
| `react-day-picker` | 8.10.1 | 9.12.0 | MEDIUM | Keep 9.12.0 (we've integrated) |
| `@platejs/*` | 52.0.15 | 52.0.1-10 | LOW | Update to 52.0.15 |
| `@types/node` | 24.10.1 | 20.x | LOW | Keep 20.x |

### Exact Matches (No Conflict)
- `zod`: 4.1.13
- `sonner`: 2.0.7
- `date-fns`: 4.1.0
- `uploadthing`: 7.7.4
- `react-dnd`: 16.0.1
- `tailwind-merge`: 3.4.0
- `vaul`: 1.1.2
- `emoji-picker-react`: 4.16.1

---

## 2. Dependencies to Add

### Tier 1: CRITICAL (Real-Time Collaboration)

```bash
pnpm add yjs@13.6.27 @platejs/yjs@52.0.13 @hocuspocus/provider@3.4.0 @hocuspocus/server@3.4.0
```

| Package | Version | Purpose |
|---------|---------|---------|
| `yjs` | 13.6.27 | CRDT data structure for real-time sync |
| `@platejs/yjs` | 52.0.13 | Plate.js YJS plugin |
| `@hocuspocus/provider` | 3.4.0 | WebSocket client for YJS |
| `@hocuspocus/server` | 3.4.0 | Self-hosted collaboration server |

### Tier 2: HIGH (Full Feature Set)

```bash
pnpm add @hocuspocus/extension-logger@3.4.0 @platejs/diff@52.0.11 @platejs/docx@52.0.11
pnpm add -D @platejs/test-utils@52.0.10
```

| Package | Version | Purpose |
|---------|---------|---------|
| `@hocuspocus/extension-logger` | 3.4.0 | Debug collaboration |
| `@platejs/diff` | 52.0.11 | Version history diffs |
| `@platejs/docx` | 52.0.11 | DOCX export |
| `@platejs/test-utils` | 52.0.10 | Testing utilities |

### Tier 3: MEDIUM (Production Scale)

```bash
pnpm add @hocuspocus/extension-redis@3.4.0 ioredis@5.8.2
```

| Package | Version | Purpose |
|---------|---------|---------|
| `@hocuspocus/extension-redis` | 3.4.0 | Redis persistence |
| `ioredis` | 5.8.2 | Redis client |

### Tier 4: LOW (Optional AI)

```bash
pnpm add @ai-sdk/react@2.0.106 ai@5.0.106
```

| Package | Version | Purpose |
|---------|---------|---------|
| `@ai-sdk/react` | 2.0.106 | AI streaming hooks |
| `ai` | 5.0.106 | Vercel AI SDK |

---

## 3. Dependencies to Skip

### Replaced by Clerk
| Package | Reason |
|---------|--------|
| `better-auth` | We use Clerk for authentication |
| `cookies-next` | Clerk handles cookies |

### Replaced by Convex
| Package | Reason |
|---------|--------|
| `prisma` | Convex serverless database |
| `@prisma/client` | Convex client |
| `@prisma/adapter-pg` | Not needed |
| `pg` | PostgreSQL not used |
| `@trpc/client` | Convex functions |
| `@trpc/server` | Convex backend |
| `@trpc/react-query` | Convex hooks |
| `@tanstack/react-query` | Convex subscriptions |
| `hono` | Convex actions |

### Not Needed for Knowledge Base
| Package | Reason |
|---------|--------|
| `jotai` | We use Zustand |
| `jotai-x` | Not needed |
| `@upstash/ratelimit` | Convex has built-in |
| `@upstash/redis` | Not needed |
| `puppeteer` | Skip for MVP |
| `superjson` | Native JSON sufficient |
| `nuqs` | Different routing approach |

---

## 4. Plate.js Updates Required

Update these packages to 52.0.15 for consistency:

```bash
pnpm add @platejs/combobox@52.0.15 @platejs/emoji@52.0.15 @platejs/mention@52.0.15 @platejs/slash-command@52.0.15 @platejs/ai@52.0.11 @platejs/markdown@52.0.11
```

| Package | Current | Target |
|---------|---------|--------|
| `@platejs/combobox` | 52.0.1 | 52.0.15 |
| `@platejs/emoji` | 52.0.2 | 52.0.15 |
| `@platejs/mention` | 52.0.1 | 52.0.15 |
| `@platejs/slash-command` | 52.0.1 | 52.0.15 |
| `@platejs/ai` | 52.0.10 | 52.0.11 |
| `@platejs/markdown` | 52.0.10 | 52.0.11 |

---

## 5. Migration Checklist

### Phase 1: Add YJS + Hocuspocus (CRITICAL)

- [ ] Install Tier 1 dependencies
- [ ] Create Hocuspocus server configuration
- [ ] Update Plate.js config for YJS
- [ ] Test collaborative editing locally
- [ ] Verify WebSocket connection

### Phase 2: Update Plate.js Plugins

- [ ] Update all Plate.js packages to 52.0.15
- [ ] Run `pnpm install`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm build`
- [ ] Run `pnpm test`

### Phase 3: Add Feature Dependencies

- [ ] Install `@platejs/diff` for version history
- [ ] Install `@platejs/docx` for export
- [ ] Test export functionality

### Phase 4: Production Readiness

- [ ] Install Redis extension
- [ ] Configure Hocuspocus persistence
- [ ] Load test with concurrent editors

### Phase 5: AI Features (Optional)

- [ ] Evaluate AI feature requirements
- [ ] Install AI SDK if needed
- [ ] Configure API keys

---

## 6. Compatibility Verification

### Pre-Installation Checks
```bash
pnpm lint          # Should pass
pnpm typecheck     # Should pass
pnpm build         # Should succeed
```

### Post-Installation Checks
```bash
pnpm install
pnpm typecheck     # Verify new types
pnpm lint:fix      # Fix style issues
pnpm build         # Should succeed
pnpm test          # All tests pass
```

---

## 7. Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| YJS integration | LOW | Well-tested with Plate.js |
| Hocuspocus setup | LOW | Docker-ready, documented |
| Version conflicts | NONE | All compatible |
| Breaking changes | NONE | Same major versions |

---

## 8. Install Commands Summary

### MVP (Tier 1 + 2)
```bash
# Critical dependencies
pnpm add yjs@13.6.27 @platejs/yjs@52.0.13 @hocuspocus/provider@3.4.0 @hocuspocus/server@3.4.0 @hocuspocus/extension-logger@3.4.0

# Plate.js updates
pnpm add @platejs/combobox@52.0.15 @platejs/emoji@52.0.15 @platejs/mention@52.0.15 @platejs/slash-command@52.0.15 @platejs/ai@52.0.11 @platejs/markdown@52.0.11

# Feature dependencies
pnpm add @platejs/diff@52.0.11 @platejs/docx@52.0.11

# Dev dependencies
pnpm add -D @platejs/test-utils@52.0.10
```

### Production (Tier 3)
```bash
pnpm add @hocuspocus/extension-redis@3.4.0 ioredis@5.8.2
```

### Optional AI (Tier 4)
```bash
pnpm add @ai-sdk/react@2.0.106 ai@5.0.106
```

---

*Generated by Explore Agent | T000c Dependency Mapping*
