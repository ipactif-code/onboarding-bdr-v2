# Type Guards Reference

## Table of Contents

1. [Type Guards Basics](#type-guards-basics)
2. [Built-in Type Guards](#built-in-type-guards)
3. [Custom Type Guards](#custom-type-guards)
4. [Type Narrowing](#type-narrowing)
5. [Discriminated Unions](#discriminated-unions)
6. [Exhaustive Checks](#exhaustive-checks)
7. [Assertion Functions](#assertion-functions)

---

## Type Guards Basics

Type guards narrow types at runtime, allowing TypeScript to infer more specific types in conditional branches.

```typescript
function process(value: string | number): string {
  // Before guard: value is string | number
  if (typeof value === "string") {
    // After guard: value is string
    return value.toUpperCase();
  }
  // After guard: value is number
  return value.toFixed(2);
}
```

---

## Built-in Type Guards

### typeof

```typescript
function formatValue(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "function") return "[Function]";
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "bigint") return `${value}n`;
  return String(value);
}
```

### instanceof

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
  }
}

class ValidationError extends Error {
  constructor(
    message: string,
    public field: string
  ) {
    super(message);
  }
}

function handleError(error: unknown): string {
  if (error instanceof ApiError) {
    return `API Error ${error.statusCode}: ${error.message}`;
  }
  if (error instanceof ValidationError) {
    return `Validation Error on ${error.field}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}
```

### in Operator

```typescript
interface Dog {
  bark(): void;
  breed: string;
}

interface Cat {
  meow(): void;
  color: string;
}

function makeSound(animal: Dog | Cat): void {
  if ("bark" in animal) {
    animal.bark(); // TypeScript knows it's Dog
  } else {
    animal.meow(); // TypeScript knows it's Cat
  }
}
```

### Array.isArray

```typescript
function processInput(input: string | string[]): string[] {
  if (Array.isArray(input)) {
    return input; // string[]
  }
  return [input]; // string converted to string[]
}
```

---

## Custom Type Guards

### Basic Custom Guard

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

// Custom type guard with `is` keyword
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "email" in value &&
    typeof (value as User).id === "string" &&
    typeof (value as User).name === "string" &&
    typeof (value as User).email === "string"
  );
}

// Usage
function processData(data: unknown): void {
  if (isUser(data)) {
    console.log(data.name); // TypeScript knows data is User
  }
}
```

### Generic Type Guard Factory

```typescript
// Factory for creating type guards
function createTypeGuard<T extends object>(
  requiredKeys: (keyof T)[],
  typeChecks?: Partial<Record<keyof T, (value: unknown) => boolean>>
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    
    for (const key of requiredKeys) {
      if (!(key in value)) {
        return false;
      }
      
      const check = typeChecks?.[key];
      if (check && !check((value as T)[key])) {
        return false;
      }
    }
    
    return true;
  };
}

// Usage
const isUser = createTypeGuard<User>(
  ["id", "name", "email"],
  {
    id: (v) => typeof v === "string",
    name: (v) => typeof v === "string",
    email: (v) => typeof v === "string" && v.includes("@"),
  }
);
```

### Array Type Guard

```typescript
function isArrayOf<T>(
  arr: unknown,
  guard: (item: unknown) => item is T
): arr is T[] {
  return Array.isArray(arr) && arr.every(guard);
}

// Usage
const isStringArray = (arr: unknown): arr is string[] =>
  isArrayOf(arr, (item): item is string => typeof item === "string");

function processStrings(input: unknown): void {
  if (isStringArray(input)) {
    input.forEach((s) => console.log(s.toUpperCase()));
  }
}
```

### Nullable Type Guard

```typescript
function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// Usage with array filter
const mixedArray: (string | null | undefined)[] = ["a", null, "b", undefined];
const cleanArray: string[] = mixedArray.filter(isDefined);
```

---

## Type Narrowing

### Truthiness Narrowing

```typescript
function processOptional(value?: string): string {
  if (value) {
    // value is string (not undefined, not empty string)
    return value.toUpperCase();
  }
  return "DEFAULT";
}

// Note: Be careful with falsy values
function processNumber(value?: number): number {
  // ❌ BAD: if (value) would exclude 0
  if (value !== undefined) {
    return value * 2; // Includes 0
  }
  return 0;
}
```

### Equality Narrowing

```typescript
type Status = "loading" | "success" | "error";

function handleStatus(status: Status): string {
  if (status === "loading") {
    return "Please wait...";
  }
  if (status === "success") {
    return "Done!";
  }
  // TypeScript knows status is "error"
  return "Something went wrong";
}
```

### Assignment Narrowing

```typescript
function example(): void {
  let value: string | number;
  
  value = "hello";
  // value is string
  console.log(value.toUpperCase());
  
  value = 42;
  // value is number
  console.log(value.toFixed(2));
}
```

### Control Flow Analysis

```typescript
function processResult(result: { data?: string; error?: string }): string {
  if (result.error) {
    // result.error is string
    return `Error: ${result.error}`;
  }
  
  if (result.data) {
    // result.data is string
    return `Data: ${result.data}`;
  }
  
  return "No data";
}
```

---

## Discriminated Unions

### Basic Pattern

```typescript
// Tag/discriminant property
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResult<T>(result: Result<T>): T | null {
  if (result.success) {
    // TypeScript knows: { success: true; data: T }
    return result.data;
  }
  // TypeScript knows: { success: false; error: string }
  console.error(result.error);
  return null;
}
```

### Multiple Discriminants

```typescript
type HttpResponse =
  | { status: 200; body: unknown }
  | { status: 201; body: unknown; location: string }
  | { status: 400; errors: string[] }
  | { status: 401; message: "Unauthorized" }
  | { status: 404; message: "Not Found" }
  | { status: 500; message: string };

function handleResponse(response: HttpResponse): void {
  switch (response.status) {
    case 200:
      console.log("Success:", response.body);
      break;
    case 201:
      console.log("Created at:", response.location);
      break;
    case 400:
      console.log("Validation errors:", response.errors);
      break;
    case 401:
    case 404:
      console.log(response.message); // "Unauthorized" or "Not Found"
      break;
    case 500:
      console.error("Server error:", response.message);
      break;
  }
}
```

### Action Pattern (Redux-style)

```typescript
type Action =
  | { type: "INCREMENT" }
  | { type: "DECREMENT" }
  | { type: "SET"; payload: number }
  | { type: "RESET" };

interface State {
  count: number;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "INCREMENT":
      return { count: state.count + 1 };
    case "DECREMENT":
      return { count: state.count - 1 };
    case "SET":
      return { count: action.payload }; // TypeScript knows payload exists
    case "RESET":
      return { count: 0 };
  }
}
```

### Form State Pattern

```typescript
type FormState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

function renderForm<T>(state: FormState<T>): string {
  switch (state.status) {
    case "idle":
      return "Fill out the form";
    case "loading":
      return "Submitting...";
    case "success":
      return `Success: ${JSON.stringify(state.data)}`;
    case "error":
      return `Error: ${state.error}`;
  }
}
```

---

## Exhaustive Checks

### Never Pattern (ALWAYS USE)

```typescript
type Status = "draft" | "published" | "archived";

function getStatusLabel(status: Status): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    default: {
      // This ensures all cases are handled
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${status}`);
    }
  }
}

// If you add a new status:
type Status2 = "draft" | "published" | "archived" | "deleted";

// TypeScript will error on the default case because
// 'deleted' is not handled, making _exhaustive assignment invalid
```

### Exhaustive Check Helper

```typescript
function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${JSON.stringify(value)}`);
}

function processStatus(status: Status): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    default:
      return assertNever(status, `Unknown status: ${status}`);
  }
}
```

### Exhaustive Object Mapping

```typescript
type Status = "draft" | "published" | "archived";

// This pattern ensures all statuses have a label
const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
  // TypeScript error if any status is missing
} as const;

function getLabel(status: Status): string {
  return STATUS_LABELS[status];
}
```

---

## Assertion Functions

### Basic Assertion

```typescript
function assertIsDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message ?? "Value must be defined");
  }
}

// Usage
function processUser(userId: string | undefined): void {
  assertIsDefined(userId, "User ID is required");
  // userId is string after this point
  console.log(userId.toUpperCase());
}
```

### Type Assertion Function

```typescript
function assertIsUser(value: unknown): asserts value is User {
  if (!isUser(value)) {
    throw new Error("Value is not a valid User");
  }
}

// Usage
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data: unknown = await response.json();
  
  assertIsUser(data); // Throws if invalid
  return data; // data is User
}
```

### Conditional Assertion

```typescript
function assertCondition(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// Usage
function divide(a: number, b: number): number {
  assertCondition(b !== 0, "Cannot divide by zero");
  return a / b;
}
```

### Assertion with Type Narrowing

```typescript
interface LoadedState {
  status: "loaded";
  data: unknown;
}

interface LoadingState {
  status: "loading";
}

type State = LoadedState | LoadingState;

function assertLoaded(state: State): asserts state is LoadedState {
  if (state.status !== "loaded") {
    throw new Error("Expected state to be loaded");
  }
}

// Usage
function processData(state: State): void {
  assertLoaded(state);
  // state.data is now accessible
  console.log(state.data);
}
```

### When to Use Assertions vs Guards

```typescript
// Use TYPE GUARD when:
// - You want to check and branch
// - The check is part of normal flow
function maybeProcessUser(data: unknown): void {
  if (isUser(data)) {
    processUser(data);
  } else {
    handleUnknownData(data);
  }
}

// Use ASSERTION when:
// - Invalid state should throw
// - You want to fail fast
// - The value MUST be valid to continue
async function getUser(id: string): Promise<User> {
  const data = await fetchData(id);
  assertIsUser(data); // Throw if invalid
  return data;
}
```
