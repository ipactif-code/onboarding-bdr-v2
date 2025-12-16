# Architectural Decision Log

Record of significant architectural decisions. Use ADR format for new entries.

---

## ADR-001: Multi-Project Claude Architecture

**Date:** 2024-12-16 | **Status:** ACCEPTED

**Context:** BDR LMS requires expertise across backend, frontend, design, security, performance, and AI. Single Claude project cannot maintain deep expertise across all domains.

**Decision:** Use 7 specialized Claude projects, each as domain expert, coordinated by Chief Architect.

**Consequences:** Deeper expertise per domain, clearer boundaries, requires manual copy-paste between projects (for now).

---

## ADR-002: BaseUI as Primary Component Library

**Date:** 2024-12-16 | **Status:** ACCEPTED

**Context:** Need consistent UI primitives. RadixUI used initially with shadcn/ui, but BaseUI preferred.

**Decision:** BaseUI (base-ui.com) for all UI components. RadixUI ONLY in `src/components/editor/` for Plate.js compatibility.

**Consequences:** Modern unstyled primitives, must maintain two libraries (BaseUI primary, RadixUI for editor only).

---

## ADR-003: Convex as Single Backend

**Date:** 2024-12-06 | **Status:** ACCEPTED

**Context:** Need real-time sync, TypeScript-native, serverless.

**Decision:** Convex as sole backend. No additional databases or services.

**Consequences:** Real-time without WebSocket config, type-safe E2E, vendor lock-in.

---

## ADR-004: Clerk for Authentication

**Date:** 2024-12-06 | **Status:** ACCEPTED

**Context:** Need enterprise auth with MFA, SSO, and Convex integration.

**Decision:** Clerk for auth, sync to Convex via webhooks. Authorization in Convex functions.

**Consequences:** MFA out-of-box, webhook sync needed, monthly costs scale with users.

---

## ADR-005: Component Graduation Pattern

**Date:** 2024-12-16 | **Status:** ACCEPTED

**Context:** Tension between Front-end speed and Design System quality.

**Decision:** Front-end creates local components in `src/components/[feature]/`. When reused 3+ times, graduates to Design System in `src/components/ui/`.

**Consequences:** Front-end moves fast, Design System focuses on reusables, temporary duplication during graduation.

---

## ADR-006: Anti-Hallucination Protocol

**Date:** 2024-12-16 | **Status:** ACCEPTED

**Context:** AI can hallucinate code/APIs. Multiple projects compound risk.

**Decision:** All projects must follow strict rule: "If you haven't SEEN the code in THIS conversation, you DON'T know it." Must use confidence levels.

**Consequences:** More back-and-forth with user, significantly reduced hallucination, builds trust.

---

## ADR-007: Testing Strategy

**Date:** 2024-12-16 | **Status:** ACCEPTED

**Context:** Constitution requires 80% coverage, but app already deployed.

**Decision:** "Test Critical Paths First" strategy. Prioritize auth flows, quiz submission, progress tracking. Every bug fix includes regression test.

**Consequences:** Pragmatic approach, focuses effort on high-value areas, won't reach 80% immediately.

---

## ADR-008: File Reference Strategy

**Date:** 2024-12-16 | **Status:** ACCEPTED

**Context:** When duplicating courses, should files be copied or referenced?

**Decision:** File attachments REFERENCED, not copied. New lessons point to same storageId.

**Consequences:** Reduced storage costs, need reference counting for cleanup.

---

## ADR Template

```markdown
## ADR-XXX: [Title]

**Date:** YYYY-MM-DD | **Status:** PROPOSED | ACCEPTED | DEPRECATED

**Context:** [Why this decision is needed]

**Decision:** [What we decided]

**Consequences:** [Positive and negative outcomes]
```
