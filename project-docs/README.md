# BDR LMS Multi-Project Claude System

## Overview

This repository uses 7 specialized Claude projects to develop and maintain the BDR LMS platform. Each project acts as a world-class expert in its domain, coordinated by a Chief Architect.

## Architecture

```
                    ┌─────────────────────┐
                    │   Chief Architect   │
                    │   (Orchestration)   │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Security   │      │ Architecture │      │      IA      │
│    & Auth    │      │ & Performance│      │& Automatisation│
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ Back-end │   │ Front-end│   │  Design  │
       │  Convex  │   │          │   │  System  │
       └──────────┘   └──────────┘   └──────────┘
```

---

## CRITICAL RULE FOR ALL PROJECTS

**If you haven't SEEN the code in THIS conversation, you DON'T know what it contains.**

Every project MUST consult its sources of truth files BEFORE making any recommendation.

---

## Sources of Truth by Domain

| Domain | File(s) | Owner |
|--------|---------|-------|
| **Database Schema** | `convex/schema.ts` | Back-end |
| **Auth Helpers** | `convex/lib/auth.ts` | Security |
| **API Contracts** | `convex/*.ts` | Back-end |
| **UI Components** | `src/components/ui/` | Design System |
| **Design Tokens** | `src/app/globals.css` | Design System |
| **Route Structure** | `src/app/` | Front-end |
| **AI Infrastructure** | `convex/actions/`, `src/lib/ai/` | IA & Automatisation |
| **Build Config** | `next.config.ts`, `package.json` | Architecture |

---

## Projects Quick Reference

| Project | Must Check First | Key Responsibility |
|---------|------------------|-------------------|
| **Chief Architect** | `schema.ts`, `ui/`, `DECISIONS.md` | Orchestration, routing |
| **Architecture** | `schema.ts`, `next.config.ts`, `package.json` | Performance, structure |
| **Back-end** | `schema.ts`, `lib/auth.ts` | Database, API |
| **Front-end** | `convex/*.ts`, `ui/`, `components/` | Pages, features |
| **Design System** | `ui/`, `globals.css` | Components, tokens |
| **Security** | `lib/auth.ts`, `middleware.ts` | Auth, permissions |
| **IA** | `actions/`, `lib/ai/`, `package.json` | AI features |

---

## GitHub Integration

All projects have access to the repository. Files may be outdated after recent pushes.

**After every Claude Code implementation:**
> User must refresh GitHub files in ALL projects before continuing.

**If something seems wrong or inconsistent:**
> "Could you refresh the GitHub files? There may have been recent changes."

---

## Workflow Summary

```
User Request → Chief Architect → Specialized Projects → Chief Architect → Claude Code → Refresh All → Validate
```

See [WORKFLOW.md](./WORKFLOW.md) for detailed process.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | Next.js 15, React 19 |
| Backend | Convex |
| Auth | Clerk |
| UI | BaseUI (primary), RadixUI (Plate.js only) |
| Editor | Plate.js v52+ |

---

## Constitution (Enforced)

- TypeScript strict, no `any`
- 80% test coverage target
- WCAG 2.1 AA accessibility
- LCP < 2.5s, bundle < 150KB
- Conventional Commits
- English for all code/docs
