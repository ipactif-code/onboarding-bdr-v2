# React Testing Library Patterns

## Table of Contents
1. [Rendering](#rendering)
2. [Queries](#queries)
3. [User Events](#user-events)
4. [Async Patterns](#async-patterns)
5. [Forms](#forms)
6. [Common Patterns](#common-patterns)

---

## Rendering

### Basic Render
```typescript
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

it("renders button", () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
});
```

### Render with Providers
```typescript
import { render } from "@testing-library/react";
import { ConvexProvider } from "convex/react";
import { ClerkProvider } from "@clerk/nextjs";

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ClerkProvider>
    <ConvexProvider client={mockConvexClient}>
      {children}
    </ConvexProvider>
  </ClerkProvider>
);

const customRender = (ui: React.ReactElement) =>
  render(ui, { wrapper: AllProviders });

// Usage
customRender(<MyComponent />);
```

### Render Result
```typescript
const { container, rerender, unmount } = render(<Component prop="initial" />);

// Access container
expect(container.querySelector(".custom-class")).toBeInTheDocument();

// Re-render with new props
rerender(<Component prop="updated" />);

// Cleanup
unmount();
```

---

## Queries

### Query Priority (IMPORTANT)
```typescript
// 1. getByRole - PREFERRED (accessible)
screen.getByRole("button", { name: /submit/i });
screen.getByRole("textbox", { name: /email/i });
screen.getByRole("checkbox", { name: /agree/i });
screen.getByRole("heading", { level: 1 });
screen.getByRole("link", { name: /home/i });
screen.getByRole("list");
screen.getByRole("listitem");

// 2. getByLabelText - Form fields
screen.getByLabelText(/email address/i);

// 3. getByPlaceholderText - Input hints
screen.getByPlaceholderText(/enter your name/i);

// 4. getByText - Non-interactive text
screen.getByText(/welcome/i);

// 5. getByTestId - LAST RESORT
screen.getByTestId("custom-element");
```

### Query Variants
```typescript
// getBy - Throws if not found (use for assertions)
const button = screen.getByRole("button");

// queryBy - Returns null if not found (use for "not exists")
expect(screen.queryByText("Error")).not.toBeInTheDocument();

// findBy - Returns Promise, waits for element (use for async)
const element = await screen.findByText("Loaded");

// getAllBy - Returns array, throws if empty
const items = screen.getAllByRole("listitem");

// queryAllBy - Returns array, empty if none
const errors = screen.queryAllByRole("alert");

// findAllBy - Returns Promise of array
const rows = await screen.findAllByRole("row");
```

### within() for Scoped Queries
```typescript
import { within } from "@testing-library/react";

it("queries within a container", () => {
  render(<Card><Button>Save</Button></Card>);

  const card = screen.getByRole("article");
  const saveButton = within(card).getByRole("button", { name: /save/i });

  expect(saveButton).toBeInTheDocument();
});
```

---

## User Events

### Setup (REQUIRED)
```typescript
import userEvent from "@testing-library/user-event";

it("uses userEvent correctly", async () => {
  const user = userEvent.setup(); // ALWAYS setup first
  render(<Component />);

  // All interactions are async
  await user.click(button);
});
```

### Common Interactions
```typescript
const user = userEvent.setup();

// Click
await user.click(screen.getByRole("button"));
await user.dblClick(element);
await user.tripleClick(element);

// Type
await user.type(input, "Hello World");
await user.type(input, "text{Enter}"); // With special keys
await user.clear(input);

// Keyboard
await user.keyboard("{Enter}");
await user.keyboard("{Shift>}A{/Shift}"); // Shift+A
await user.tab();

// Select/Options
await user.selectOptions(select, ["option1", "option2"]);
await user.deselectOptions(select, "option1");

// Hover
await user.hover(element);
await user.unhover(element);

// Copy/Paste
await user.copy();
await user.paste();

// Upload
const file = new File(["content"], "test.pdf", { type: "application/pdf" });
await user.upload(input, file);
```

### Why userEvent over fireEvent
```typescript
// ❌ fireEvent - Fires single event, not realistic
fireEvent.click(button);
fireEvent.change(input, { target: { value: "text" } });

// ✅ userEvent - Simulates real user behavior
// click = pointerdown → mousedown → pointerup → mouseup → click
await user.click(button);
// type = focus → keydown → keypress → input → keyup (per character)
await user.type(input, "text");
```

---

## Async Patterns

### waitFor
```typescript
import { waitFor } from "@testing-library/react";

it("waits for async state", async () => {
  render(<AsyncComponent />);

  await waitFor(() => {
    expect(screen.getByText("Data loaded")).toBeInTheDocument();
  });
});

// With options
await waitFor(
  () => expect(mockFn).toHaveBeenCalled(),
  { timeout: 3000, interval: 100 }
);
```

### waitForElementToBeRemoved
```typescript
import { waitForElementToBeRemoved } from "@testing-library/react";

it("waits for loading to disappear", async () => {
  render(<DataLoader />);

  await waitForElementToBeRemoved(() => screen.queryByText("Loading..."));
  expect(screen.getByText("Content")).toBeInTheDocument();
});
```

### findBy (Built-in waitFor)
```typescript
it("uses findBy for async elements", async () => {
  render(<AsyncComponent />);

  // findBy = getBy + waitFor
  const element = await screen.findByText("Async Content");
  expect(element).toBeInTheDocument();
});
```

---

## Forms

### Testing Form Submission
```typescript
it("submits form with valid data", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();

  render(<ContactForm onSubmit={onSubmit} />);

  // Fill form
  await user.type(screen.getByLabelText(/name/i), "John Doe");
  await user.type(screen.getByLabelText(/email/i), "john@example.com");
  await user.type(screen.getByLabelText(/message/i), "Hello!");

  // Submit
  await user.click(screen.getByRole("button", { name: /submit/i }));

  // Assert
  expect(onSubmit).toHaveBeenCalledWith({
    name: "John Doe",
    email: "john@example.com",
    message: "Hello!",
  });
});
```

### Testing Validation
```typescript
it("shows validation errors", async () => {
  const user = userEvent.setup();
  render(<ContactForm />);

  // Submit empty form
  await user.click(screen.getByRole("button", { name: /submit/i }));

  // Check errors
  expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  expect(screen.getByText(/email is required/i)).toBeInTheDocument();
});
```

### Testing with React Hook Form + Zod
```typescript
it("validates with zod schema", async () => {
  const user = userEvent.setup();
  render(<ZodForm />);

  // Invalid email
  await user.type(screen.getByLabelText(/email/i), "invalid-email");
  await user.click(screen.getByRole("button", { name: /submit/i }));

  expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
});
```

---

## Common Patterns

### Testing Conditional Rendering
```typescript
it("shows content based on state", async () => {
  const user = userEvent.setup();
  render(<Toggle />);

  expect(screen.queryByText("Hidden content")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /show/i }));

  expect(screen.getByText("Hidden content")).toBeInTheDocument();
});
```

### Testing Lists
```typescript
it("renders list items", () => {
  const items = [
    { id: 1, name: "Item 1" },
    { id: 2, name: "Item 2" },
  ];
  render(<ItemList items={items} />);

  const listItems = screen.getAllByRole("listitem");
  expect(listItems).toHaveLength(2);
  expect(listItems[0]).toHaveTextContent("Item 1");
});
```

### Testing Modals/Dialogs
```typescript
it("opens and closes modal", async () => {
  const user = userEvent.setup();
  render(<ModalTrigger />);

  // Open modal
  await user.click(screen.getByRole("button", { name: /open/i }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();

  // Close modal
  await user.click(screen.getByRole("button", { name: /close/i }));
  await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
});
```

### Testing Error States
```typescript
it("displays error message", async () => {
  vi.mocked(fetchData).mockRejectedValue(new Error("Network error"));

  render(<DataComponent />);

  await waitFor(() => {
    expect(screen.getByRole("alert")).toHaveTextContent(/network error/i);
  });
});
```

### Mock Next.js Router
```typescript
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/current-path",
  useSearchParams: () => new URLSearchParams("?query=test"),
}));
```
