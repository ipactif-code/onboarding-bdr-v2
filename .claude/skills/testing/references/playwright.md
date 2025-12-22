# Playwright E2E Testing Patterns

## Table of Contents
1. [Configuration](#configuration)
2. [Writing Tests](#writing-tests)
3. [Locators](#locators)
4. [Actions](#actions)
5. [Assertions](#assertions)
6. [Page Objects](#page-objects)
7. [Authentication](#authentication)
8. [Advanced Patterns](#advanced-patterns)

---

## Configuration

### playwright.config.ts
```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html"], ["list"]],
  timeout: 30000,

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### Package.json Scripts
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:report": "playwright show-report"
  }
}
```

---

## Writing Tests

### Basic Test Structure
```typescript
// tests/e2e/courses.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Courses", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/courses");
  });

  test("displays course list", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /courses/i })).toBeVisible();
    await expect(page.getByRole("list")).toBeVisible();
  });

  test("navigates to course detail", async ({ page }) => {
    await page.getByRole("link", { name: /react basics/i }).click();
    await expect(page).toHaveURL(/\/courses\/[\w-]+/);
    await expect(page.getByRole("heading", { name: /react basics/i })).toBeVisible();
  });
});
```

### Test Hooks
```typescript
test.describe("with setup", () => {
  test.beforeAll(async () => {
    // Run once before all tests in this describe
    console.log("Setting up...");
  });

  test.afterAll(async () => {
    // Run once after all tests
    console.log("Cleaning up...");
  });

  test.beforeEach(async ({ page }) => {
    // Run before each test
    await page.goto("/");
  });

  test.afterEach(async ({ page }) => {
    // Run after each test
    await page.evaluate(() => localStorage.clear());
  });
});
```

---

## Locators

### Recommended Locators (Priority Order)
```typescript
// 1. getByRole - PREFERRED (accessible)
page.getByRole("button", { name: /submit/i });
page.getByRole("textbox", { name: /email/i });
page.getByRole("link", { name: /home/i });
page.getByRole("heading", { level: 1 });
page.getByRole("checkbox", { name: /agree/i });

// 2. getByLabel - Form fields
page.getByLabel(/email address/i);

// 3. getByPlaceholder - Input hints
page.getByPlaceholder(/enter your name/i);

// 4. getByText - Non-interactive text
page.getByText(/welcome/i);

// 5. getByTestId - Last resort
page.getByTestId("custom-element");
```

### Chaining and Filtering
```typescript
// Chain locators
page.getByRole("listitem").filter({ hasText: "Item 1" });

// Within a container
const card = page.getByTestId("course-card");
await card.getByRole("button", { name: /enroll/i }).click();

// First, last, nth
page.getByRole("listitem").first();
page.getByRole("listitem").last();
page.getByRole("listitem").nth(2);

// Filter by visibility
page.getByRole("button").filter({ visible: true });
```

---

## Actions

### Click Actions
```typescript
await page.getByRole("button").click();
await page.getByRole("button").dblclick();
await page.getByRole("button").click({ button: "right" });
await page.getByRole("button").click({ force: true }); // Skip actionability
await page.getByRole("button").click({ position: { x: 10, y: 10 } });
```

### Form Interactions
```typescript
// Fill input
await page.getByLabel("Email").fill("user@example.com");

// Clear and type
await page.getByLabel("Email").clear();
await page.getByLabel("Email").type("user@example.com"); // Character by character

// Press keys
await page.getByLabel("Email").press("Enter");
await page.keyboard.press("Control+A");

// Select options
await page.getByRole("combobox").selectOption("value");
await page.getByRole("combobox").selectOption({ label: "Option Text" });

// Check/uncheck
await page.getByRole("checkbox").check();
await page.getByRole("checkbox").uncheck();
await page.getByRole("checkbox").setChecked(true);

// File upload
await page.getByLabel("Upload").setInputFiles("./test-file.pdf");
await page.getByLabel("Upload").setInputFiles(["file1.pdf", "file2.pdf"]);
```

### Navigation
```typescript
await page.goto("/courses");
await page.goBack();
await page.goForward();
await page.reload();
```

### Waiting
```typescript
// Wait for navigation
await page.waitForURL(/\/success/);

// Wait for element
await page.waitForSelector(".loading", { state: "hidden" });

// Wait for response
await page.waitForResponse("**/api/courses");

// Wait for load state
await page.waitForLoadState("networkidle");

// Custom wait
await page.waitForFunction(() => document.title === "Expected Title");
```

---

## Assertions

### Element Assertions
```typescript
// Visibility
await expect(page.getByText("Hello")).toBeVisible();
await expect(page.getByText("Hello")).toBeHidden();

// Enabled/Disabled
await expect(page.getByRole("button")).toBeEnabled();
await expect(page.getByRole("button")).toBeDisabled();

// Checked
await expect(page.getByRole("checkbox")).toBeChecked();
await expect(page.getByRole("checkbox")).not.toBeChecked();

// Text content
await expect(page.getByRole("heading")).toHaveText("Welcome");
await expect(page.getByRole("heading")).toContainText("Wel");

// Value
await expect(page.getByLabel("Email")).toHaveValue("test@example.com");

// Attribute
await expect(page.getByRole("link")).toHaveAttribute("href", "/about");

// CSS class
await expect(page.getByTestId("card")).toHaveClass(/active/);

// Count
await expect(page.getByRole("listitem")).toHaveCount(5);
```

### Page Assertions
```typescript
// URL
await expect(page).toHaveURL("/dashboard");
await expect(page).toHaveURL(/dashboard/);

// Title
await expect(page).toHaveTitle("Dashboard");
await expect(page).toHaveTitle(/Dashboard/);
```

### Soft Assertions
```typescript
// Continue test even if assertion fails
await expect.soft(page.getByText("Item 1")).toBeVisible();
await expect.soft(page.getByText("Item 2")).toBeVisible();
// Test continues, failures reported at end
```

---

## Page Objects

### Pattern Implementation
```typescript
// tests/e2e/pages/login.page.ts
import { Page, Locator, expect } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.submitButton = page.getByRole("button", { name: /sign in/i });
    this.errorMessage = page.getByRole("alert");
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}
```

### Using Page Objects
```typescript
// tests/e2e/login.spec.ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/login.page";

test.describe("Login", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test("successful login", async ({ page }) => {
    await loginPage.login("user@example.com", "password123");
    await expect(page).toHaveURL("/dashboard");
  });

  test("shows error for invalid credentials", async () => {
    await loginPage.login("wrong@example.com", "wrongpass");
    await loginPage.expectError("Invalid credentials");
  });
});
```

---

## Authentication

### Setup Authentication State
```typescript
// tests/e2e/auth.setup.ts
import { test as setup, expect } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("test@example.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL("/dashboard");

  await page.context().storageState({ path: authFile });
});
```

### Use Auth State in Tests
```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
```

### Testing Without Auth
```typescript
test.describe("public pages", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });
});
```

---

## Advanced Patterns

### API Mocking
```typescript
test("mocks API response", async ({ page }) => {
  await page.route("**/api/courses", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "1", title: "Mocked Course" },
      ]),
    });
  });

  await page.goto("/courses");
  await expect(page.getByText("Mocked Course")).toBeVisible();
});
```

### Network Interception
```typescript
test("waits for API call", async ({ page }) => {
  const responsePromise = page.waitForResponse("**/api/courses");
  await page.getByRole("button", { name: /refresh/i }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
});
```

### Screenshots and Visual Comparison
```typescript
test("visual comparison", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveScreenshot("dashboard.png");
});

test("element screenshot", async ({ page }) => {
  await page.goto("/courses");
  const card = page.getByTestId("course-card").first();
  await expect(card).toHaveScreenshot("course-card.png");
});
```

### Parallel Test Data Isolation
```typescript
test.describe.configure({ mode: "parallel" });

test("test 1", async ({ page }) => {
  const uniqueId = `user-${Date.now()}-${Math.random()}`;
  // Use uniqueId for test data
});

test("test 2", async ({ page }) => {
  const uniqueId = `user-${Date.now()}-${Math.random()}`;
  // Use uniqueId for test data
});
```

### Custom Fixtures
```typescript
// tests/e2e/fixtures.ts
import { test as base } from "@playwright/test";
import { LoginPage } from "./pages/login.page";
import { DashboardPage } from "./pages/dashboard.page";

type MyFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
};

export const test = base.extend<MyFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
});

export { expect } from "@playwright/test";
```

### Debug Tips
```bash
# Run with debug mode
pnpm test:e2e:debug

# Run with trace viewer
pnpm test:e2e --trace on

# Run specific test
pnpm test:e2e tests/e2e/login.spec.ts

# Run with grep pattern
pnpm test:e2e --grep "login"
```
