# Vitest Patterns Reference

## Table of Contents
1. [Configuration](#configuration)
2. [Mocking](#mocking)
3. [Async Testing](#async-testing)
4. [Snapshot Testing](#snapshot-testing)
5. [Test Organization](#test-organization)

---

## Configuration

### vitest.config.ts
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", "tests/e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "convex/_generated/",
        "tests/",
        "*.config.*",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### tests/setup.ts
```typescript
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
```

---

## Mocking

### Mock Functions
```typescript
import { vi, describe, it, expect } from "vitest";

// Simple mock
const mockFn = vi.fn();
mockFn.mockReturnValue(42);
mockFn.mockResolvedValue({ data: "async" });

// Mock implementation
const mockCalculate = vi.fn().mockImplementation((a, b) => a + b);

// Verify calls
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
expect(mockFn).toHaveBeenCalledTimes(2);
```

### Mock Modules
```typescript
// Mock entire module
vi.mock("@/lib/api", () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 1, name: "Test" }),
  createUser: vi.fn(),
}));

// Mock with factory
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "test@example.com" },
    isAuthenticated: true,
    signOut: vi.fn(),
  }),
}));

// Partial mock (keep other exports)
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    formatDate: vi.fn().mockReturnValue("2024-01-01"),
  };
});
```

### Mock Timers
```typescript
describe("timer tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles setTimeout", async () => {
    const callback = vi.fn();
    setTimeout(callback, 1000);

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalled();
  });

  it("handles setInterval", () => {
    const callback = vi.fn();
    setInterval(callback, 500);

    vi.advanceTimersByTime(1500);
    expect(callback).toHaveBeenCalledTimes(3);
  });
});
```

### Spy on Methods
```typescript
import * as utils from "@/lib/utils";

it("spies on existing method", () => {
  const spy = vi.spyOn(utils, "formatCurrency");
  spy.mockReturnValue("$100.00");

  const result = utils.formatCurrency(100);

  expect(spy).toHaveBeenCalledWith(100);
  expect(result).toBe("$100.00");

  spy.mockRestore(); // Restore original
});
```

---

## Async Testing

### Promises
```typescript
it("handles async/await", async () => {
  const result = await fetchData();
  expect(result).toEqual({ status: "success" });
});

it("handles promise rejection", async () => {
  await expect(failingFn()).rejects.toThrow("Error message");
});

it("handles resolved value", async () => {
  await expect(asyncFn()).resolves.toBe("value");
});
```

### waitFor Pattern
```typescript
import { waitFor } from "@testing-library/react";

it("waits for condition", async () => {
  render(<AsyncComponent />);

  await waitFor(() => {
    expect(screen.getByText("Loaded")).toBeInTheDocument();
  });
});

it("waits with timeout", async () => {
  await waitFor(
    () => expect(mockFn).toHaveBeenCalled(),
    { timeout: 3000 }
  );
});
```

---

## Snapshot Testing

```typescript
it("matches snapshot", () => {
  const { container } = render(<Button>Click me</Button>);
  expect(container).toMatchSnapshot();
});

it("matches inline snapshot", () => {
  const result = formatUser({ name: "John", age: 30 });
  expect(result).toMatchInlineSnapshot(`"John (30)"`);
});

// Update snapshots: pnpm test -u
```

---

## Test Organization

### Describe Blocks
```typescript
describe("UserService", () => {
  describe("create", () => {
    it("creates user with valid data", async () => {});
    it("throws on invalid email", async () => {});
  });

  describe("update", () => {
    it("updates existing user", async () => {});
    it("throws on non-existent user", async () => {});
  });
});
```

### Test Hooks
```typescript
describe("with setup/teardown", () => {
  let testData: TestData;

  beforeAll(async () => {
    // Run once before all tests
    await initializeDatabase();
  });

  afterAll(async () => {
    // Run once after all tests
    await cleanupDatabase();
  });

  beforeEach(() => {
    // Run before each test
    testData = createTestData();
  });

  afterEach(() => {
    // Run after each test
    vi.clearAllMocks();
  });
});
```

### Skip and Focus
```typescript
it.skip("skips this test", () => {});
it.todo("implement this test later");
it.only("runs only this test", () => {}); // Remove before commit!

describe.skip("skips entire suite", () => {});
describe.only("runs only this suite", () => {});
```

### Parameterized Tests
```typescript
it.each([
  { input: 1, expected: 2 },
  { input: 2, expected: 4 },
  { input: 3, expected: 6 },
])("doubles $input to $expected", ({ input, expected }) => {
  expect(double(input)).toBe(expected);
});

it.each`
  a    | b    | sum
  ${1} | ${2} | ${3}
  ${2} | ${3} | ${5}
`("adds $a + $b = $sum", ({ a, b, sum }) => {
  expect(add(a, b)).toBe(sum);
});
```
