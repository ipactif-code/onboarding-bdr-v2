# Architectural Decision Log

This document records significant architectural decisions made for the BDR LMS project. Each decision follows the ADR (Architectural Decision Record) format.

## How to Use This Document

When the Chief Architect makes a decision that impacts multiple projects or establishes a pattern, it should be recorded here with the rationale. This ensures consistency and provides context for future decisions.

### Decision Status

Each decision can have one of these statuses: PROPOSED (under discussion), ACCEPTED (implemented), DEPRECATED (superseded by another decision), or SUPERSEDED (replaced, with reference to replacement).

---

## ADR-001: Multi-Project Claude Architecture

**Date:** 2024-12-16  
**Status:** ACCEPTED  
**Deciders:** User, Chief Architect

### Context

The BDR LMS project requires expertise across multiple domains including backend development, frontend development, design systems, security, performance, and AI integration. A single Claude project cannot maintain deep expertise across all these domains simultaneously.

### Decision

Implement a multi-project architecture with 7 specialized Claude projects, each acting as a world-class expert in its domain. The Chief Architect project orchestrates all others and maintains cross-project coherence.

### Consequences

The positive consequences include deeper domain expertise per project, clearer separation of concerns, better anti-hallucination through specialization, and scalable as project complexity grows. The negative consequences include manual copy-paste between projects initially, requires discipline to follow workflow, and potential for slower iteration on simple changes.

### Alternatives Considered

A single Claude project with all context was considered but rejected because context window limitations and expertise dilution made it suboptimal. Two projects separating backend and frontend were considered but rejected because it lacked the granularity needed for security, performance, and AI specialization.

---

## ADR-002: BaseUI as Primary Component Library

**Date:** 2024-12-16  
**Status:** ACCEPTED  
**Deciders:** User, Design System Project

### Context

The project initially used shadcn/ui components built on Radix UI. The user decided to migrate to Base UI for the primary component library while maintaining Radix UI only for Plate.js editor components.

### Decision

Use Base UI (https://base-ui.com/) as the primary primitive library for all UI components. Radix UI components are permitted ONLY in the `src/components/editor/` folder for Plate.js compatibility.

### Consequences

The positive consequences include modern, unstyled primitives for maximum customization, better separation from Plate.js dependencies, and more control over styling implementation. The negative consequences include migration effort for existing Radix components, must maintain two primitive libraries, and potential confusion about which to use.

### Implementation Guidelines

All new components in `src/components/ui/` must use Base UI primitives. Existing Radix components should be migrated when modified. Plate.js components in `src/components/editor/ui/` may continue using Radix. Design System project is the authority on component library decisions.

---

## ADR-003: Convex as Single Backend

**Date:** 2024-12-06  
**Status:** ACCEPTED  
**Deciders:** User, Architecture Project

### Context

The project needs a backend solution that supports real-time data synchronization, TypeScript-native development, and serverless deployment.

### Decision

Use Convex as the sole backend solution, leveraging its reactive queries, built-in file storage, and TypeScript-first approach. No additional backend services or databases.

### Consequences

The positive consequences include real-time updates without WebSocket configuration, type-safe end-to-end development, simplified deployment and operations, and built-in file storage up to 50MB. The negative consequences include vendor lock-in to Convex, limited to Convex's query and storage capabilities, and learning curve for team members new to Convex.

### Patterns Established

All database operations go through Convex functions. Real-time is the default for all queries. File storage uses Convex built-in storage. HTTP routes only for webhooks, not general API.

---

## ADR-004: Clerk for Authentication

**Date:** 2024-12-06  
**Status:** ACCEPTED  
**Deciders:** User, Security Project

### Context

The application requires enterprise-grade authentication with MFA support, SSO capability, and seamless integration with Convex.

### Decision

Use Clerk for all authentication needs, syncing user data to Convex via webhooks. Authorization logic lives in Convex functions using role-based access control.

### Consequences

The positive consequences include MFA out of the box with TOTP, SMS, and email options, prebuilt UI components reduce development time, webhook integration keeps Convex as source of truth, and SSO ready for enterprise customers. The negative consequences include external dependency for critical auth flow, webhook reliability is a concern and requires retry logic, and monthly costs scale with users.

### Implementation Guidelines

All auth UI uses Clerk components. User data synced via `/clerk-webhook` endpoint. Roles stored in Convex users table, not Clerk metadata. Authorization checks use `convex/lib/auth.ts` helpers.

---

## ADR-005: Component Graduation Pattern

**Date:** 2024-12-16  
**Status:** ACCEPTED  
**Deciders:** Chief Architect

### Context

There's a potential friction point between the Front-end and Design System projects regarding component ownership. Front-end needs to move fast on features, while Design System needs to ensure component quality and reusability.

### Decision

Implement a "Component Graduation" pattern. Front-end can create local components in `src/components/[feature]/` for immediate use. When a component is reused 3 or more times across features, it graduates to Design System in `src/components/ui/`.

### Consequences

The positive consequences include Front-end can move fast without blocking on Design System, Design System focuses on truly reusable components, and natural evolution from specific to generic. The negative consequences include temporary duplication during graduation period, requires tracking of component usage, and graduation process adds overhead.

### Process

The process follows these steps: Front-end creates component locally, then tracks reuse across features, then at 3+ uses requests graduation from Design System. Design System then generalizes the API and moves to ui/ folder, and finally Front-end migrates all usages to new location.

---

## ADR-006: Anti-Hallucination Protocol

**Date:** 2024-12-16  
**Status:** ACCEPTED  
**Deciders:** Chief Architect

### Context

AI assistants can hallucinate details about code, APIs, and configurations. With multiple projects, this risk compounds as incorrect assumptions cascade.

### Decision

All projects must follow strict anti-hallucination rules. They must never assume code exists without verification, must use confidence levels (HIGH, MEDIUM, LOW) for all recommendations, and must request actual code/output from user when uncertain.

### Consequences

The positive consequences include significantly reduced hallucination risk, clear communication about uncertainty, and builds user trust in recommendations. The negative consequences include more back-and-forth with user, slower initial analysis, and requires discipline from all projects.

### Confidence Level Definitions

HIGH confidence applies when the project has verified the code or output exists, or when the pattern is standard and well-documented. MEDIUM confidence applies when the pattern is inferred from similar code or is a common practice that should apply. LOW confidence applies when the assumption is made without verification, and the user should verify this before implementing.

---

## ADR-007: Testing Strategy

**Date:** 2024-12-16  
**Status:** ACCEPTED  
**Deciders:** Chief Architect, Architecture Project

### Context

The constitution requires 80% test coverage, but the application is already deployed and functional. Implementing TDD retroactively is impractical.

### Decision

Adopt a "Test Critical Paths First" strategy rather than strict TDD. Prioritize tests for auth flows, quiz submission, and progress tracking. Every bug fix must include a regression test. New features should have tests for happy path at minimum.

### Consequences

The positive consequences include pragmatic approach for existing codebase, focuses testing effort on highest-value areas, and bug fixes prevent regressions. The negative consequences include won't reach 80% coverage immediately, technical debt in untested areas, and requires discipline to add tests with fixes.

### Priority Order

The testing priority order is: first, authentication and authorization flows; second, quiz submission and scoring logic; third, progress tracking and completion; fourth, course creation and publishing; fifth, messaging and real-time features; and sixth, analytics and reporting.

---

## ADR-008: File Reference Strategy

**Date:** 2024-12-16  
**Status:** ACCEPTED  
**Deciders:** Back-end Project

### Context

When duplicating courses or managing file attachments, a decision is needed on whether to copy files or reference them.

### Decision

File attachments should be REFERENCED, not copied. When a course is duplicated, the new lessons point to the same storageId. Files are only deleted when no lessons reference them.

### Consequences

The positive consequences include reduced storage costs, no duplicate file management, and files are immutable once uploaded (simpler mental model). The negative consequences include need reference counting for cleanup, editing a file affects all references, and orphaned files possible if cleanup fails.

### Implementation Notes

The files table stores storageId reference. Deletion must check for other references. Consider background job for orphan cleanup.

---

## ADR-009: Real-time as Default

**Date:** 2024-12-06  
**Status:** ACCEPTED  
**Deciders:** Architecture Project

### Context

The application has many features that benefit from real-time updates including messaging, comments, progress tracking, and user presence.

### Decision

Leverage Convex's reactive queries as the default data fetching strategy. All `useQuery` calls automatically subscribe to changes. No manual WebSocket setup or polling needed.

### Consequences

The positive consequences include consistent real-time experience across the app, simplified frontend code (no separate subscription logic), and automatic optimization by Convex. The negative consequences include all queries consume subscription resources, need to be mindful of query granularity, and debugging reactive issues can be complex.

### Patterns

Always use `useQuery` for data that should update in real-time. Use pagination for large datasets. Avoid overly broad queries that return more data than needed.

---

## ADR-010: Error Handling Strategy

**Date:** 2024-12-16  
**Status:** ACCEPTED  
**Deciders:** Chief Architect, Front-end Project, Back-end Project

### Context

Consistent error handling across the application improves user experience and debugging capabilities.

### Decision

Backend errors use ConvexError with user-friendly messages. Frontend catches errors and displays via toast notifications (Sonner). Error boundaries catch React rendering errors. All errors are logged for debugging.

### Consequences

The positive consequences include consistent user experience for errors, clear error messages guide users, and logging aids debugging. The negative consequences include requires consistent implementation across all features, need to balance security (not exposing internals) with helpfulness, and ConvexError messages must be user-safe.

### Patterns

Backend throws `new ConvexError("User-friendly message")` for expected errors. Frontend uses `try/catch` with toast for mutations. Error boundaries wrap major sections. Never expose internal details in error messages.

---

## Template for New Decisions

When adding a new decision, use this template:

```markdown
## ADR-XXX: [Title]

**Date:** YYYY-MM-DD  
**Status:** PROPOSED | ACCEPTED | DEPRECATED | SUPERSEDED  
**Deciders:** [Who made this decision]

### Context

[What is the issue that we're seeing that is motivating this decision?]

### Decision

[What is the change that we're proposing and/or doing?]

### Consequences

[What becomes easier or more difficult because of this change?]

### Alternatives Considered

[What other options were considered and why were they rejected?]
```
