# BDR LMS Platform Constitution

## Preamble

This constitution documents the established conventions, quality standards, and architectural decisions for the BDR LMS Platform. All development work MUST comply with these articles. Violations require explicit justification and approval.

---

## Article I: Code Quality

### TypeScript Strictness (NON-NEGOTIABLE)
- `strict: true` in tsconfig.json
- NO `any` types - use `unknown` with type guards
- Explicit return types on all exported functions
- No `@ts-ignore` or `@ts-expect-error` without linked issue

### ESLint Compliance
- Zero warnings policy (`--max-warnings 0`)
- No `eslint-disable` without linked issue number
- Prettier formatting enforced via ESLint plugin

### Code Review Gates
All PRs must pass:
- [ ] `pnpm typecheck` (zero errors)
- [ ] `pnpm lint` (zero warnings)
- [ ] `pnpm test` (all tests pass)
- [ ] `pnpm build` (successful production build)

---

## Article II: Testing Standards

### Minimum Coverage
- Unit tests: 80% line coverage for business logic
- Integration tests: All Convex functions must have convex-test coverage
- E2E tests: Critical user journeys (auth, course completion, messaging)

### Testing Stack
| Layer | Tool | Location |
|-------|------|----------|
| Unit | Vitest + React Testing Library | `tests/unit/` |
| Integration | convex-test | `tests/unit/convex/` |
| E2E | Playwright | `tests/e2e/` |

### TDD Workflow (Recommended)
1. Write failing test
2. Implement minimum code to pass
3. Refactor while keeping tests green

---

## Article III: User Experience

### Loading States (MANDATORY)
- Every async operation must show `<Skeleton />` during loading
- Use Convex's loading state from `useQuery` hooks
- No blank screens or layout shifts

### Error Handling (MANDATORY)
- User-facing errors via `toast.error()` from sonner
- Log errors with context for debugging
- Graceful degradation where possible

### Optimistic Updates
- Use `useMutation` with `optimisticUpdate` for immediate feedback
- Rollback on failure with appropriate error message

---

## Article IV: Accessibility

### WCAG 2.1 Level AA (REQUIRED)
- Color contrast ratio: minimum 4.5:1 for text
- All interactive elements keyboard accessible
- Focus indicators visible and clear
- ARIA labels on non-semantic interactive elements

### Semantic HTML
- Use appropriate heading hierarchy (h1 > h2 > h3)
- Use `<button>` for actions, `<a>` for navigation
- Use `<nav>`, `<main>`, `<aside>`, `<footer>` landmarks

### Testing
- Run `axe-core` in component tests
- Playwright accessibility assertions in E2E tests

---

## Article V: Security

### Authentication (Clerk)
- All protected routes use Clerk middleware
- No custom auth tokens - use Clerk sessions only
- Organizations for team/tenant isolation

### Authorization (RBAC)
| Role | Permissions |
|------|-------------|
| user | Own data, assigned courses |
| manager | Team data, team reports |
| admin | All data, system config |

### Convex Security Rules
- `requireAuth()` on FIRST LINE of every protected function
- `requireAdmin()` for admin-only operations
- Input validation with Zod on all user inputs
- No secrets in code - use Convex environment variables

### XSS Prevention
- Sanitize HTML from Plate.js before rendering
- Use `DOMPurify` for any user-generated HTML

---

## Article VI: Performance

### Core Web Vitals Targets
| Metric | Target | Max |
|--------|--------|-----|
| LCP | < 2.5s | 4.0s |
| FID | < 100ms | 300ms |
| CLS | < 0.1 | 0.25 |

### Bundle Size
- Main bundle < 150KB gzipped
- Use dynamic imports for heavy components
- Analyze with `@next/bundle-analyzer`

### Convex Query Optimization
- ALWAYS use `.withIndex()` - NEVER `.filter()` on full scans
- Define indexes in `schema.ts` for query patterns
- Paginate large result sets

---

## Article VII: Documentation

### Required Documentation
- JSDoc on all exported functions
- README.md in each feature directory
- ADR (Architecture Decision Record) for significant choices

### Documentation Location
| Type | Location |
|------|----------|
| API docs | JSDoc in code |
| Architecture | `/docs/architecture/` |
| ADRs | `/docs/adr/` |
| User guides | `/docs/guides/` |

### No Auto-Generated Docs
- Do not add comments, docstrings, or README files unless explicitly requested
- Focus on self-documenting code with clear naming

---

## Article VIII: Git Workflow

### Branch Naming
```
[type]/[issue-number]-[short-description]
```
Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
Example: `feat/123-add-course-certificates`

### Commit Messages
```
type(scope): description

[optional body]

[optional footer with issue references]
```
Example: `feat(courses): add certificate generation on completion`

### PR Requirements
- Linked to issue
- Descriptive title and body
- All checks passing
- At least 1 approval (2 for security-sensitive changes)

---

## Article IX: Technology Stack (Locked per ADR-001 to ADR-007)

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | App Router, SSR, API routes |
| React | 19.x | UI components |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | Latest | Component library |
| Base UI | Latest | Unstyled primitives |
| Plate.js | 52.x | Rich text editor |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Convex | Latest | Database, real-time, functions |
| Clerk | 6.x | Authentication, organizations |

### Testing
| Technology | Version | Purpose |
|------------|---------|---------|
| Vitest | 3.x | Unit testing |
| Playwright | 1.57+ | E2E testing |
| convex-test | Latest | Convex function testing |

### LOCKED - NO SUBSTITUTIONS WITHOUT ADR AMENDMENT

---

## Article X: Folder Structure (Enforced)

```
src/
  app/                    # Next.js App Router pages
    (auth)/               # Auth routes (sign-in, sign-up)
    (dashboard)/          # Protected dashboard routes
      admin/              # Admin pages
      courses/            # Course pages
      messages/           # Messaging pages
    layout.tsx            # Root layout
    globals.css           # Global styles
  components/
    [feature]/            # Feature-specific components
    layout/               # Layout components (sidebar, header)
    providers/            # React context providers
    ui/                   # shadcn/ui components
    ui-nova/              # Base UI components
    ui-plate/             # Plate.js editor components
  hooks/                  # Custom React hooks
  lib/                    # Utility functions
  types/                  # TypeScript type definitions

convex/
  _generated/             # Generated types (DO NOT EDIT)
  lib/                    # Shared utilities
    auth.ts               # Auth helpers (requireAuth, requireAdmin)
  actions/                # External API actions
  schema.ts               # Database schema
  *.ts                    # Domain-specific queries/mutations

tests/
  unit/                   # Vitest unit tests
    components/           # Component tests
    convex/               # Convex function tests
    hooks/                # Hook tests
  integration/            # Integration tests
  e2e/                    # Playwright E2E tests
```

---

## Article XI: Convex Patterns (Enforced)

### Query Pattern
```typescript
export const myQuery = query({
  args: { id: v.id("tableName") },
  returns: v.union(v.object({ ... }), v.null()),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);  // FIRST LINE
    return await ctx.db.get(args.id);
  },
});
```

### Mutation Pattern
```typescript
export const myMutation = mutation({
  args: { ... },
  returns: v.id("tableName"),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);  // FIRST LINE
    // Validate ownership/permissions
    // Perform mutation
    return await ctx.db.insert("tableName", { ... });
  },
});
```

### Index Usage (MANDATORY)
```typescript
// CORRECT
const results = await ctx.db
  .query("courses")
  .withIndex("by_instructor", (q) => q.eq("instructorId", instructorId))
  .collect();

// WRONG - Full table scan
const results = await ctx.db
  .query("courses")
  .filter((q) => q.eq(q.field("instructorId"), instructorId))
  .collect();
```

### Timestamps
- Use `Date.now()` for all timestamps (milliseconds since epoch)
- Store as `v.number()` in schema

---

## Article XII: Component Graduation (per ADR-005)

### Component Lifecycle

```
1. Feature Component (src/components/[feature]/)
   └── Used in one feature only
   └── Can be experimental

2. Shared Component (src/components/[feature]/ with exports)
   └── Used by multiple features
   └── Requires unit tests
   └── Requires documentation

3. UI Library Component (src/components/ui/)
   └── Generic, reusable primitive
   └── Full test coverage
   └── Storybook documentation
   └── Accessibility verified
```

### Graduation Criteria

| From | To | Requirements |
|------|----|--------------|
| Feature | Shared | Used by 2+ features, tests added |
| Shared | UI Library | Generic API, full tests, a11y verified, documented |

### UI Library Rules
- Components in `src/components/ui/` must be from shadcn/ui or follow same patterns
- Custom components go in `src/components/ui-nova/` (Base UI based)
- Plate.js components go in `src/components/ui-plate/`

---

## Article XIII: Anti-Hallucination Protocol (per ADR-006)

### Mandatory Pre-Work Verification

Before writing ANY code, Claude MUST:

1. **Read existing code** - Use `Read` tool to verify current state
2. **Search codebase** - Use `Grep`/`Glob` to find related patterns
3. **Check documentation** - Query Context7 for library APIs
4. **Read project skills** - Check `.claude/skills/` for conventions

### Forbidden Actions

- DO NOT assume file contents without reading
- DO NOT guess API signatures without verification
- DO NOT create duplicate implementations
- DO NOT ignore existing patterns

### Verification Commands

```bash
# Before modifying a file
Read the file first

# Before adding a new component
Glob for similar components: **/*[ComponentName]*.tsx

# Before using a library API
Query Context7 for current documentation
```

### Error Recovery

If Claude makes a mistake:
1. Acknowledge the error explicitly
2. Read the actual file/code
3. Correct based on real state
4. Explain what was wrong

---

## Governance

### Constitutional Authority
- This constitution supersedes all other documentation for development practices
- Conflicts with external guides resolve in favor of this constitution
- Amendments require:
  1. Written proposal with justification
  2. Impact analysis on existing code
  3. Migration plan for non-compliant code
  4. Approval from project maintainers

### Enforcement
- All PRs must verify compliance with applicable articles
- Code review checklist includes constitutional checks
- Automated checks in CI/CD where possible

### Reference Documents
- Architecture Decision Records: `/docs/adr/`
- Implementation skills: `.claude/skills/`
- Agent orchestration: `CLAUDE.md`

---

**Version**: 1.0.0 | **Ratified**: 2026-01-03 | **Last Amended**: 2026-01-03
