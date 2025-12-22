---
name: testing
description: Complete testing guide for the LMS project with a 4-layer strategy covering Convex backend tests (convex-test), React component tests (Testing Library), integration workflow tests, and E2E tests (Playwright). Use when working on files matching `**/*.test.ts`, `**/*.spec.ts`, `tests/**`, or when asked to write tests, test a component, verify coverage, implement TDD. Triggers on keywords like vitest, playwright, testing library, convex-test, coverage, TDD, unit test, e2e test, integration test.
---

# Testing Skill - LMS Project

## Quick Start

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Generate coverage report (target: 80%)
pnpm test:coverage
```

## Decision Tree - Which Test Layer?

```
Is it a Convex function (query/mutation/action)?
├─ YES → Use convex-test (see references/convex-testing.md)
│
└─ NO → Is it a React component in isolation?
         ├─ YES → Use Testing Library (see references/rtl-patterns.md)
         │
         └─ NO → Does it involve multiple components/services?
                  ├─ YES (same process) → Integration test with Vitest
                  │
                  └─ YES (real browser needed) → Playwright E2E (see references/playwright.md)
```

## Test Layer Overview

| Layer | Tool | Location | Extension | Use Case |
|-------|------|----------|-----------|----------|
| Unit (Convex) | convex-test | `convex/*.test.ts` | `.test.ts` | Queries, mutations, actions |
| Unit (React) | Testing Library | `tests/unit/` | `.test.ts` | Components in isolation |
| Integration | Vitest | `tests/unit/` | `.test.ts` | Multi-component workflows |
| E2E | Playwright | `tests/e2e/` | `.spec.ts` | Full user journeys |

## Core Conventions

### File Organization
- Unit tests: `tests/unit/` with `.test.ts` extension
- E2E tests: `tests/e2e/` with `.spec.ts` extension
- Convex tests: `convex/*.test.ts` alongside source files

### Pattern AAA (Arrange, Act, Assert)
```typescript
it("should do something", async () => {
  // Arrange - Setup test data and conditions
  const user = userEvent.setup();
  render(<Component />);

  // Act - Perform the action being tested
  await user.click(screen.getByRole("button", { name: /submit/i }));

  // Assert - Verify the expected outcome
  expect(screen.getByText("Success")).toBeInTheDocument();
});
```

### Query Priority (Testing Library)
1. `getByRole` - Accessible queries (PREFERRED)
2. `getByLabelText` - Form fields
3. `getByPlaceholderText` - Input hints
4. `getByText` - Text content
5. `getByTestId` - Last resort only

### User Interactions
Always use `userEvent` over `fireEvent`:
```typescript
// ✅ Correct
const user = userEvent.setup();
await user.click(button);
await user.type(input, "text");

// ❌ Avoid
fireEvent.click(button);
```

## Technology Stack

| Package | Version | Purpose |
|---------|---------|---------|
| vitest | 3.2.4 | Test runner (globals: true, jsdom) |
| @testing-library/react | 16.3.0 | React component testing |
| @testing-library/jest-dom | 6.9.1 | DOM matchers |
| @testing-library/user-event | 14.x | User interaction simulation |
| convex-test | 0.0.41 | Convex backend testing |
| @playwright/test | 1.57.0 | E2E browser testing |

## Coverage Requirements

Target: **80% minimum** on all metrics (statements, branches, functions, lines).

```bash
# Check coverage
pnpm test:coverage

# Coverage output locations
# - Terminal: text summary
# - coverage/index.html: detailed HTML report
# - coverage/coverage-final.json: JSON for CI
```

## Detailed References

- **Vitest patterns & mocking**: [references/vitest-patterns.md](references/vitest-patterns.md)
- **React Testing Library patterns**: [references/rtl-patterns.md](references/rtl-patterns.md)
- **Convex backend testing**: [references/convex-testing.md](references/convex-testing.md)
- **Playwright E2E testing**: [references/playwright.md](references/playwright.md)
