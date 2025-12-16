# BDR LMS Multi-Project Claude System

## Overview

This repository uses a multi-project Claude architecture to manage development of the BDR LMS platform. Each Claude project acts as a specialized expert in a specific domain, ensuring world-class quality in every aspect of the application.

## Architecture

```
                    ┌─────────────────────────┐
                    │    Chief Architect      │
                    │   (Maître d'œuvre)      │
                    │                         │
                    │  Orchestration &        │
                    │  Cross-project          │
                    │  Coherence              │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  Security &   │      │ Architecture  │      │     IA &      │
│     Auth      │      │ & Performance │      │ Automatisation│
│               │      │               │      │               │
│ Auth, RBAC,   │      │ System Design │      │ LLM, AI UI,   │
│ Audit         │      │ Optimization  │      │ Automations   │
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
               ▼               ▼               ▼
       ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
       │  Back-end   │ │  Front-end  │ │   Design    │
       │   Convex    │ │             │ │   System    │
       │             │ │             │ │             │
       │ Database,   │ │ Pages,      │ │ Components, │
       │ API, Logic  │ │ Features    │ │ Tokens      │
       └─────────────┘ └─────────────┘ └─────────────┘
```

## Projects

| Project | Responsibility | Authority |
|---------|---------------|-----------|
| **Chief Architect** | Orchestration, routing, conflict resolution, final instructions | Project-wide decisions |
| **Architecture & Performance** | System design, optimization, scalability | Architectural patterns |
| **Back-end / Convex** | Database schema, API, server logic | `convex/` folder |
| **Front-end** | Pages, features, state management | `src/app/`, `src/components/` (non-UI) |
| **Design System** | UI components, tokens, accessibility | `src/components/ui/`, `globals.css` |
| **Security & Auth** | Authentication, authorization, audit | `convex/lib/auth.ts`, security config |
| **IA & Automatisation** | LLM integration, AI features, automations | `src/lib/ai/`, AI-related actions |

## Workflow

See [WORKFLOW.md](./WORKFLOW.md) for the complete step-by-step process.

### Quick Summary

1. **New Request** → Chief Architect analyzes and routes
2. **Specialized Projects** → Each provides domain-specific analysis
3. **Chief Architect** → Consolidates and resolves conflicts
4. **Claude Code** → Implements the final instructions
5. **User** → Validates and refreshes GitHub files

## Decision Authority Levels

Each project operates with three levels of decision authority:

### AUTONOMOUS
Decisions the project can make independently without consultation. These are within the project's core expertise and don't impact other projects.

### CONSULTATIVE
Decisions that require informing the Chief Architect or other projects. The project can proceed but must document the decision and its rationale.

### ESCALATED
Decisions that require validation from the user or approval from the Chief Architect. These typically involve breaking changes, new dependencies, or cross-project impacts.

## Single Source of Truth

| Domain | Owner | Files |
|--------|-------|-------|
| Database Schema | Back-end/Convex | `convex/schema.ts` |
| Shared Types | Back-end/Convex | `src/types/*.ts` |
| UI Components | Design System | `src/components/ui/` |
| Design Tokens | Design System | `src/app/globals.css` |
| Auth Logic | Security & Auth | `convex/lib/auth.ts` |
| AI Config | IA & Automatisation | `src/lib/ai/` |

## Anti-Hallucination Protocol

All projects follow strict anti-hallucination rules:

1. **Never assume code exists** - Always verify by requesting file contents
2. **Never assume APIs exist** - Reference contracts or ask Back-end project
3. **Never assume components exist** - Check Design System documentation
4. **Use confidence levels** - HIGH (verified), MEDIUM (inferred), LOW (assumption)
5. **Request evidence** - Ask user for terminal output, console logs, or HTML inspection
6. **Cite sources** - When referencing code, quote it directly

## File Structure

```
project-docs/
├── README.md                    # This file
├── WORKFLOW.md                  # Step-by-step workflow guide
├── DECISIONS.md                 # Architectural decision log
├── INTERFACES.md                # Cross-project interfaces
└── projects/
    ├── chief-architect.md       # Chief Architect instructions
    ├── architecture.md          # Architecture & Performance
    ├── backend.md               # Back-end/Convex
    ├── frontend.md              # Front-end
    ├── design-system.md         # Design System
    ├── security.md              # Security & Auth
    └── ai-automation.md         # IA & Automatisation
```

## Getting Started

1. Create 7 Claude projects (one per specialized domain)
2. Add the corresponding instruction file to each project
3. Connect the GitHub repository to all projects
4. Start with Chief Architect for any new request
5. Follow the workflow in WORKFLOW.md

## Key Technologies

| Category | Technology | Notes |
|----------|------------|-------|
| Frontend | Next.js 15.5.7, React 19.2.1 | App Router, Turbopack |
| Backend | Convex | Real-time, TypeScript-native |
| Auth | Clerk | MFA, SSO, Organizations |
| UI Library | BaseUI (primary), RadixUI (Plate.js only) | shadcn/ui customized |
| Rich Text | Plate.js v52+ | Requires RadixUI components |
| Testing | Vitest, Playwright | 80% coverage target |

## Constitution

All projects must respect the project constitution defined in `.specify/memory/constitution.md`. Key principles:

- TypeScript strict mode, no `any`, explicit returns
- 80% test coverage (prioritize critical paths)
- WCAG 2.1 AA accessibility compliance
- LCP < 2.5s, FID < 100ms, CLS < 0.1
- Mobile-first responsive design
- Conventional Commits
- English for all code and documentation
