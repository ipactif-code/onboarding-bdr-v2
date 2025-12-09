<!--
SYNC IMPACT REPORT
==================
Version change: N/A (new) → 1.0.0
Modified principles: N/A (initial creation)
Added sections:
  - 9 Core Principles (Code Quality, Testing Standards, User Experience,
    Accessibility, Security, Performance, Documentation, Git Workflow,
    File Conventions)
  - Quality Standards section
  - Development Workflow section
  - Governance section
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (Constitution Check section compatible)
  - .specify/templates/spec-template.md ✅ (Requirements section aligns with principles)
  - .specify/templates/tasks-template.md ✅ (Task structure supports TDD workflow)
Follow-up TODOs: None
==================
-->

# Onboarding BDR Team v2 Constitution

## Core Principles

### I. Code Quality

All code MUST adhere to strict quality standards to ensure maintainability and reliability:

- TypeScript strict mode MUST be enabled; `any` types are forbidden
- All functions MUST have explicit return type annotations
- Components MUST follow the Single Responsibility Principle (one reason to change)
- Composition MUST be preferred over inheritance for code reuse
- Files MUST NOT exceed 200 lines; split into focused modules when approaching limit

**Rationale**: Strict typing catches errors at compile time. SRP and composition enable
easier testing, refactoring, and code comprehension.

### II. Testing Standards

Testing MUST be comprehensive and follow TDD principles for new features:

- Unit tests MUST cover business logic with minimum 80% code coverage
- Integration tests MUST exist for all API endpoints
- End-to-end tests MUST cover critical user flows
- Test-driven development (Red-Green-Refactor) MUST be used when adding new features

**Rationale**: High test coverage prevents regressions. TDD ensures requirements are
understood before implementation and produces testable code by design.

### III. User Experience

All interfaces MUST prioritize usability and responsiveness:

- Mobile-first responsive design MUST be implemented for all views
- Loading states MUST be displayed for all asynchronous operations
- Error messages MUST be actionable and guide users toward resolution
- Navigation patterns MUST be consistent across the application
- Any feature MUST be reachable within a maximum of 3 clicks from the dashboard

**Rationale**: Users on mobile devices represent a significant portion of learners.
Clear feedback and intuitive navigation reduce friction and support completion.

### IV. Accessibility

All features MUST meet WCAG 2.1 Level AA compliance:

- Keyboard navigation MUST work for all interactive elements
- Screen reader support MUST be implemented with appropriate ARIA labels
- Color contrast MUST meet minimum 4.5:1 ratio for normal text
- Focus indicators MUST be visible on all focusable elements

**Rationale**: Accessibility is both a legal requirement and an ethical imperative.
An LMS must be usable by all learners regardless of ability.

### V. Security

All code MUST implement defense-in-depth security practices:

- Input validation MUST be performed on all user-provided data (client and server)
- Rich text content MUST be sanitized before rendering to prevent XSS
- Role-based access control (RBAC) MUST distinguish admin and user permissions
- Sensitive data (tokens, keys, PII) MUST NOT appear in client-side code
- Authentication MUST support multi-factor authentication (MFA)

**Rationale**: An LMS handles personal and potentially sensitive learning data.
Security failures erode trust and may violate compliance requirements.

### VI. Performance

All pages and interactions MUST meet Core Web Vitals thresholds:

- Largest Contentful Paint (LCP) MUST be under 2.5 seconds
- First Input Delay (FID) MUST be under 100 milliseconds
- Cumulative Layout Shift (CLS) MUST be under 0.1
- Initial JavaScript bundle MUST be under 150KB gzipped
- Heavy components MUST be lazy-loaded

**Rationale**: Performance directly impacts user engagement and learning outcomes.
Slow applications cause frustration and abandonment.

### VII. Documentation

Code MUST be self-documenting with strategic supplemental documentation:

- Exported functions MUST have JSDoc comments describing purpose, parameters, and returns
- Each feature folder MUST contain a README explaining its scope and usage
- TypeScript types MUST be used to make code self-documenting; avoid redundant comments

**Rationale**: Good documentation reduces onboarding time and prevents knowledge silos.
Types serve as living documentation that cannot drift from implementation.

### VIII. Git Workflow

All repository changes MUST follow a structured workflow:

- Commit messages MUST follow Conventional Commits format (feat, fix, docs, refactor, test)
- Feature branches MUST be created from main for all work
- Pull requests MUST be approved before merging to main
- Direct commits to main are forbidden

**Rationale**: Conventional commits enable automated changelog generation. PRs ensure
code review and maintain quality gates.

### IX. File Conventions

All files and identifiers MUST follow consistent naming conventions:

- All files MUST be written in English
- File names MUST use kebab-case (e.g., `user-profile.tsx`)
- React component names MUST use PascalCase (e.g., `UserProfile`)
- Function names MUST use camelCase (e.g., `getUserProfile`)
- Constants MUST use SCREAMING_SNAKE_CASE (e.g., `MAX_FILE_SIZE`)

**Rationale**: Consistent naming eliminates ambiguity, enables predictable file location,
and reduces cognitive load when navigating the codebase.

## Quality Standards

This section defines cross-cutting quality gates that apply to all development:

| Category | Metric | Threshold | Enforcement |
|----------|--------|-----------|-------------|
| Test Coverage | Line coverage | >= 80% | CI pipeline |
| Bundle Size | Initial JS | < 150KB gzip | Build step |
| Accessibility | WCAG level | AA | Automated audit |
| Performance | LCP | < 2.5s | Lighthouse CI |
| Performance | FID | < 100ms | Lighthouse CI |
| Performance | CLS | < 0.1 | Lighthouse CI |
| Type Safety | Strict mode | Enabled | tsconfig.json |
| Type Safety | Any usage | 0 | ESLint rule |

## Development Workflow

All development MUST follow this process:

1. **Branch Creation**: Create feature branch from main (`feat/xxx-feature-name`)
2. **TDD Cycle**: Write failing tests before implementation for new features
3. **Implementation**: Write minimal code to pass tests
4. **Refactor**: Clean up while maintaining passing tests
5. **Self-Review**: Verify all principles are met before PR
6. **Pull Request**: Submit PR with description and link to requirements
7. **Code Review**: At least one approval required
8. **Merge**: Squash merge to main with conventional commit message

### Pre-Merge Checklist

Before any PR can be merged:

- [ ] TypeScript compiles with zero errors (strict mode)
- [ ] No `any` types introduced
- [ ] All new functions have explicit return types
- [ ] Unit test coverage >= 80% for changed code
- [ ] Integration tests pass
- [ ] Accessibility audit passes (axe-core or equivalent)
- [ ] Performance budget not exceeded
- [ ] Conventional commit message format used

## Governance

This constitution supersedes all other development practices for the Onboarding BDR
Team v2 project. All contributors MUST comply with these principles.

### Amendment Process

1. Propose amendment via pull request to this file
2. Document rationale for change
3. Obtain approval from project lead
4. Update version number according to semantic versioning:
   - MAJOR: Principle removal or backward-incompatible redefinition
   - MINOR: New principle added or material expansion of existing guidance
   - PATCH: Clarifications, wording improvements, typo fixes
5. Update `LAST_AMENDED_DATE` to amendment date
6. Propagate changes to affected templates and documentation

### Compliance Review

- All pull requests MUST be reviewed for constitution compliance
- Violations MUST be resolved before merge
- Justified exceptions MUST be documented in the Complexity Tracking section of the
  implementation plan

### Reference Documents

- Implementation plans: `/specs/[feature]/plan.md`
- Feature specifications: `/specs/[feature]/spec.md`
- Task breakdowns: `/specs/[feature]/tasks.md`

**Version**: 1.0.0 | **Ratified**: 2025-12-06 | **Last Amended**: 2025-12-06
