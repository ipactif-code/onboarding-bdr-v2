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

## Projects

| Project | Responsibility | Key Files |
|---------|---------------|-----------|
| **Chief Architect** | Orchestration, routing, conflict resolution | `specs/`, `DECISIONS.md` |
| **Architecture** | System design, performance, scalability | `next.config.ts`, folder structure |
| **Back-end/Convex** | Schema, API, server logic | `convex/` |
| **Front-end** | Pages, features, state | `src/app/`, `src/components/` |
| **Design System** | UI components, tokens | `src/components/ui/`, `globals.css` |
| **Security & Auth** | Auth, authorization, audit | `convex/lib/auth.ts`, middleware |
| **IA & Automatisation** | LLM, AI features, automations | `convex/actions/`, `src/lib/ai/` |

## Workflow Summary

```
User Request → Chief Architect → Specialized Projects → Chief Architect → Claude Code → Validation
```

See [WORKFLOW.md](./WORKFLOW.md) for detailed process.

## Single Source of Truth

| Domain | Owner | Location |
|--------|-------|----------|
| Database schema | Back-end | `convex/schema.ts` |
| Shared types | Back-end | `src/types/` |
| UI components | Design System | `src/components/ui/` |
| Design tokens | Design System | `globals.css` |
| Auth logic | Security | `convex/lib/auth.ts` |

## Critical Rule (All Projects)

**If you haven't SEEN the code in THIS conversation, you DON'T know what it contains. Ask for it.**

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | Next.js 15, React 19 |
| Backend | Convex |
| Auth | Clerk |
| UI | BaseUI (primary), RadixUI (Plate.js only) |
| Editor | Plate.js v52+ |
| Testing | Vitest, Playwright |

## Constitution (Enforced)

- TypeScript strict, no `any`
- 80% test coverage target
- WCAG 2.1 AA accessibility
- LCP < 2.5s, bundle < 150KB
- Conventional Commits
- English for all code/docs
