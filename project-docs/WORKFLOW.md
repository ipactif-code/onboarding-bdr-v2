# Multi-Project Workflow

## Critical First Step: Check Sources of Truth

**BEFORE any project responds, it MUST check its sources of truth files.**

Each project has specific files it must consult. See the project instructions for the complete list.

---

## Standard Flow

```
┌────────────────────────────────────────────────────────────────────┐
│ 1. USER REQUEST                                                    │
│    → Describe what you need (feature, bug fix, optimization)       │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ 2. CHIEF ARCHITECT                                                 │
│    → Checks: schema.ts, ui/, DECISIONS.md                          │
│    → Analyzes request                                              │
│    → Creates routing plan                                          │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ 3. SPECIALIZED PROJECTS                                            │
│    → Each checks its sources of truth FIRST                        │
│    → If files missing/outdated, asks for refresh                   │
│    → Provides recommendations with confidence levels               │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ 4. CHIEF ARCHITECT                                                 │
│    → Consolidates outputs                                          │
│    → Resolves conflicts                                            │
│    → Produces Claude Code instructions                             │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ 5. CLAUDE CODE                                                     │
│    → Implements instructions                                       │
│    → Commits and pushes                                            │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ 6. USER: REFRESH ALL PROJECTS                                      │
│    → ⚠️ CRITICAL: Refresh GitHub in ALL Claude projects            │
│    → Test implementation                                           │
│    → Report issues or approve                                      │
└────────────────────────────────────────────────────────────────────┘
```

---

## Sources of Truth by Project

| Project | MUST Check Before Responding |
|---------|------------------------------|
| **Chief Architect** | `convex/schema.ts`, `src/components/ui/`, `DECISIONS.md` |
| **Architecture** | `convex/schema.ts`, `next.config.ts`, `package.json` |
| **Back-end** | `convex/schema.ts`, `convex/lib/auth.ts`, `convex/*.ts` |
| **Front-end** | `convex/*.ts`, `src/components/ui/`, `src/components/` |
| **Design System** | `src/components/ui/`, `src/app/globals.css` |
| **Security** | `convex/lib/auth.ts`, `src/middleware.ts`, `convex/*.ts` |
| **IA & Automatisation** | `convex/actions/`, `src/lib/ai/`, `package.json` |

---

## Routing Guide

| Request Type | Primary Project | Supporting Projects |
|--------------|-----------------|---------------------|
| New feature | Chief Architect → Back-end → Front-end | Design System, Security |
| Bug fix | Chief Architect → Most relevant 1-2 | — |
| Performance issue | Architecture | Back-end, Front-end |
| Security concern | Security (IMMEDIATE) | Back-end |
| UI component needed | Design System | Front-end |
| AI feature | IA & Automatisation | Back-end, Front-end |

---

## Requesting Information

If a project needs files not in its GitHub context:

| Need | Ask User To |
|------|-------------|
| File content | `cat src/components/X.tsx` |
| Folder structure | `ls -la src/components/` |
| Console errors | Open DevTools → Console → Share |
| Build output | `npm run build` |
| Convex data | Check Convex dashboard |
| Refresh files | Refresh GitHub in Claude project |

---

## After Implementation Checklist

1. ✅ Claude Code pushed changes
2. ✅ User tested the changes
3. ⚠️ **User refreshed GitHub in ALL Claude projects**
4. ✅ Report results to Chief Architect if issues
