---
name: typescript
description: "TypeScript advanced patterns and best practices for the LMS Next.js/Convex project. Provides generics, conditional types, mapped types, utility types, type guards, and project-specific patterns. Use when working on files in **/*.ts, **/*.tsx, convex/**/*.ts, when creating types, defining interfaces, resolving TypeScript errors, or improving type safety. Triggers on keywords: generics, utility types, type guard, narrowing, conditional type, mapped type, infer, extends, Partial, Pick, Omit, ReturnType, Convex Id, unknown, never, discriminated union, exhaustive check."
---

# TypeScript Advanced Patterns

## Stack

- TypeScript 5.x, strict mode enabled
- Config: `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- ESLint: `@typescript-eslint` with `no-explicit-any`, `explicit-function-return-type`

## Quick Start

### Convex ID Types

```typescript
import { Id } from "convex/_generated/dataModel";

interface Course {
  _id: Id<"courses">;
  creatorId: Id<"users">;
  status: "draft" | "published" | "archived";
  title: string;
}

// Function with Convex ID parameter
function getCourse(id: Id<"courses">): Promise<Course | null> {
  // ...
}
```

### Generic Higher-Order Component

```typescript
import { ComponentProps, ElementType, ReactNode } from "react";

type WithTooltipProps<T extends ElementType> = {
  tooltip?: ReactNode;
} & ComponentProps<T>;

function withTooltip<T extends ElementType>(Component: T) {
  return function ExtendedComponent(props: WithTooltipProps<T>): ReactNode {
    const { tooltip, ...rest } = props;
    // ...
  };
}
```

### Generic Form Field (React Hook Form)

```typescript
import { ControllerProps, FieldPath, FieldValues } from "react-hook-form";

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>): ReactNode => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};
```

## Decision Trees

### `interface` vs `type`?

```
Defining shape of an object?
├─ YES → interface (declaration merging, extends)
│   └─ Objects, classes, React props
└─ NO → type
    ├─ Union types → type Status = "draft" | "published"
    ├─ Tuple types → type Pair = [string, number]
    ├─ Mapped types → type Readonly<T> = { readonly [K in keyof T]: T[K] }
    └─ Utility compositions → type CourseWithAuthor = Course & { author: User }
```

### Type Guard vs Type Assertion?

```
Need to verify type at runtime?
├─ YES → Type Guard (is keyword)
│   ├─ function isUser(x: unknown): x is User
│   └─ Returns boolean, narrows type in branches
└─ NO → Type Assertion (as keyword)
    ├─ Use ONLY when you have external guarantees
    └─ PREFER: unknown + type guard over any + assertion
```

### Which Utility Type?

```
Want to transform a type?
├─ Make all props optional → Partial<T>
├─ Make all props required → Required<T>
├─ Make all props readonly → Readonly<T>
├─ Pick subset of props → Pick<T, "prop1" | "prop2">
├─ Exclude some props → Omit<T, "prop1" | "prop2">
├─ Get function return type → ReturnType<typeof fn>
├─ Get function params → Parameters<typeof fn>
├─ Extract from union → Extract<T, U>
├─ Exclude from union → Exclude<T, U>
├─ Remove null/undefined → NonNullable<T>
└─ Deep optional (custom) → See utility-types.md
```

## Strict Rules

| Context | Rule |
|---------|------|
| Return types | ALWAYS explicit: `function foo(): ReturnType` |
| `any` | NEVER use. Use `unknown` + type guard or create proper type |
| Generics | ALWAYS constrain: `T extends SomeType` not bare `T` |
| Exhaustive | ALWAYS in switch: `default: { const _: never = value; throw new Error(...) }` |
| Convex IDs | ALWAYS use `Id<"table">`, never `string` |
| Unused vars | Prefix with `_`: `_unusedVar` |
| Index access | Handle `undefined` (noUncheckedIndexedAccess enabled) |
| Assertions | AVOID `as` - use type guards for runtime safety |

## Common Patterns

### Exhaustive Switch Check

```typescript
type Status = "draft" | "published" | "archived";

function handleStatus(status: Status): string {
  switch (status) {
    case "draft": return "Draft mode";
    case "published": return "Published";
    case "archived": return "Archived";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${status}`);
    }
  }
}
```

### Safe Array Access

```typescript
// With noUncheckedIndexedAccess
const items = ["a", "b", "c"];
const first = items[0]; // string | undefined

// Safe access patterns
const safeFirst = items[0] ?? "default";
const checkedFirst = items.at(0) ?? "fallback";

// When you know index is valid
if (items.length > 0) {
  const definitelyFirst = items[0]!; // Only with length check
}
```

### Discriminated Union

```typescript
type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResult<T>(result: ApiResult<T>): T | null {
  if (result.success) {
    return result.data; // TypeScript knows data exists
  }
  console.error(result.error); // TypeScript knows error exists
  return null;
}
```

## References

Load these as needed for detailed patterns:

| Topic | File | When to Read |
|-------|------|--------------|
| Advanced Types | [references/advanced-types.md](references/advanced-types.md) | Generics, conditional types, mapped types, `infer` |
| Utility Types | [references/utility-types.md](references/utility-types.md) | Built-in utilities + custom (DeepPartial, etc.) |
| Type Guards | [references/type-guards.md](references/type-guards.md) | Guards, narrowing, discriminated unions, assertions |
