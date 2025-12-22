# Utility Types Reference

## Table of Contents

1. [Built-in Utility Types](#built-in-utility-types)
2. [Custom Utility Types](#custom-utility-types)
3. [Convex-Specific Types](#convex-specific-types)
4. [React-Specific Types](#react-specific-types)

---

## Built-in Utility Types

### Property Modifiers

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

// Make all properties optional
type PartialUser = Partial<User>;
// { id?: string; name?: string; email?: string; role?: "admin" | "user"; }

// Make all properties required
type RequiredUser = Required<PartialUser>;
// Back to User with all required

// Make all properties readonly
type ReadonlyUser = Readonly<User>;
// { readonly id: string; readonly name: string; ... }
```

### Property Selection

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

// Pick specific properties
type PublicUser = Pick<User, "id" | "name" | "email">;
// { id: string; name: string; email: string; }

// Omit specific properties
type UserWithoutPassword = Omit<User, "password">;
// { id: string; name: string; email: string; createdAt: Date; }

// Create input type (no id, no timestamps)
type CreateUserInput = Omit<User, "id" | "createdAt">;
// { name: string; email: string; password: string; }
```

### Function Types

```typescript
function createUser(name: string, email: string): Promise<User> {
  // ...
}

// Get return type
type CreateUserReturn = ReturnType<typeof createUser>;
// Promise<User>

// Get parameter types
type CreateUserParams = Parameters<typeof createUser>;
// [name: string, email: string]

// Get first parameter
type FirstParam = Parameters<typeof createUser>[0];
// string
```

### Union Manipulation

```typescript
type Status = "draft" | "published" | "archived" | "deleted";

// Extract members matching condition
type ActiveStatus = Extract<Status, "draft" | "published">;
// "draft" | "published"

// Exclude members matching condition
type VisibleStatus = Exclude<Status, "deleted">;
// "draft" | "published" | "archived"

// Remove null and undefined
type MaybeString = string | null | undefined;
type DefiniteString = NonNullable<MaybeString>;
// string
```

### Object Key Types

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

// Get all keys as union
type UserKeys = keyof User;
// "id" | "name" | "email"

// Create record from keys
type UserRecord = Record<keyof User, boolean>;
// { id: boolean; name: boolean; email: boolean; }

// Record with any string keys
type StringMap = Record<string, unknown>;
```

### String Manipulation (Built-in)

```typescript
type Event = "click" | "focus" | "blur";

type UpperEvent = Uppercase<Event>;       // "CLICK" | "FOCUS" | "BLUR"
type LowerEvent = Lowercase<UpperEvent>;  // "click" | "focus" | "blur"
type CapEvent = Capitalize<Event>;        // "Click" | "Focus" | "Blur"
type UncapEvent = Uncapitalize<CapEvent>; // "click" | "focus" | "blur"
```

---

## Custom Utility Types

### DeepPartial

```typescript
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

interface Config {
  database: {
    host: string;
    port: number;
    credentials: {
      username: string;
      password: string;
    };
  };
}

// All nested properties are optional
type PartialConfig = DeepPartial<Config>;
```

### DeepReadonly

```typescript
type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

const config: DeepReadonly<Config> = { /* ... */ };
config.database.host = "new"; // ❌ Error: readonly
```

### DeepRequired

```typescript
type DeepRequired<T> = T extends object
  ? { [K in keyof T]-?: DeepRequired<T[K]> }
  : T;

type FullConfig = DeepRequired<DeepPartial<Config>>;
// All properties required at all levels
```

### Nullable

```typescript
type Nullable<T> = T | null;
type Optional<T> = T | undefined;
type Maybe<T> = T | null | undefined;

interface User {
  name: string;
  avatar: Nullable<string>;      // string | null
  bio: Optional<string>;         // string | undefined
  nickname: Maybe<string>;       // string | null | undefined
}
```

### DeepNullable

```typescript
type DeepNullable<T> = T extends object
  ? { [K in keyof T]: DeepNullable<T[K]> | null }
  : T | null;
```

### PickByType

```typescript
type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

interface Mixed {
  name: string;
  age: number;
  email: string;
  active: boolean;
}

type StringProps = PickByType<Mixed, string>;
// { name: string; email: string; }

type NumberProps = PickByType<Mixed, number>;
// { age: number; }
```

### OmitByType

```typescript
type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

type NonStringProps = OmitByType<Mixed, string>;
// { age: number; active: boolean; }
```

### Merge (Deep Merge Two Types)

```typescript
type Merge<T, U> = Omit<T, keyof U> & U;

interface Base {
  id: string;
  name: string;
  createdAt: Date;
}

interface Override {
  name: number;  // Override string with number
  extra: boolean;
}

type Merged = Merge<Base, Override>;
// { id: string; createdAt: Date; name: number; extra: boolean; }
```

### RequireAtLeastOne

```typescript
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

interface SearchParams {
  query?: string;
  category?: string;
  tag?: string;
}

type ValidSearch = RequireAtLeastOne<SearchParams>;
// Must have at least one of: query, category, or tag
```

### RequireExactlyOne

```typescript
type RequireExactlyOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & 
      Partial<Record<Exclude<Keys, K>, undefined>>;
  }[Keys];

interface AuthMethod {
  password?: string;
  oauth?: string;
  apiKey?: string;
}

type SingleAuth = RequireExactlyOne<AuthMethod>;
// Must have exactly one of: password, oauth, or apiKey
```

### PathKeys (Get Nested Keys)

```typescript
type PathKeys<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? `${Prefix}${K}` | PathKeys<T[K], `${Prefix}${K}.`>
        : never;
    }[keyof T]
  : never;

interface User {
  profile: {
    name: string;
    address: {
      city: string;
    };
  };
}

type UserPaths = PathKeys<User>;
// "profile" | "profile.name" | "profile.address" | "profile.address.city"
```

---

## Convex-Specific Types

### Document Type Helpers

```typescript
import { Doc, Id } from "convex/_generated/dataModel";

// Get document type from table name
type Course = Doc<"courses">;
type User = Doc<"users">;

// Create input types for mutations
type CreateCourseInput = Omit<Course, "_id" | "_creationTime">;
type UpdateCourseInput = Partial<CreateCourseInput>;

// Type for function returning document or null
type MaybeDoc<T extends string> = Doc<T> | null;
```

### Query Return Types

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

// Infer type from validator
type CourseValidator = typeof v.object({
  title: v.string(),
  status: v.union(
    v.literal("draft"),
    v.literal("published")
  ),
});

// Type for paginated results
interface PaginatedResult<T> {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
}
```

### ID Type Utilities

```typescript
import { Id } from "convex/_generated/dataModel";

// Type guard for Convex ID
function isValidId<T extends string>(
  id: unknown,
  _table: T
): id is Id<T> {
  return typeof id === "string" && id.length > 0;
}

// Map of table names to their ID types
type TableIds = {
  [K in keyof DataModel]: Id<K>;
};
```

---

## React-Specific Types

### Component Props Types

```typescript
import { ComponentProps, ComponentPropsWithoutRef } from "react";

// Get props of native element
type ButtonProps = ComponentProps<"button">;
type InputProps = ComponentProps<"input">;

// Without ref (for forwardRef components)
type DivPropsNoRef = ComponentPropsWithoutRef<"div">;

// Get props of custom component
type MyButtonProps = ComponentProps<typeof MyButton>;
```

### Polymorphic Component Props

```typescript
import { ElementType, ComponentPropsWithoutRef } from "react";

type PolymorphicProps<E extends ElementType, P = object> = P & 
  Omit<ComponentPropsWithoutRef<E>, keyof P> & {
    as?: E;
  };

interface ButtonOwnProps {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}

type ButtonProps<E extends ElementType = "button"> = 
  PolymorphicProps<E, ButtonOwnProps>;

// Usage
function Button<E extends ElementType = "button">({
  as,
  variant = "primary",
  ...props
}: ButtonProps<E>): ReactNode {
  const Component = as ?? "button";
  return <Component {...props} />;
}
```

### Event Handler Types

```typescript
import { ChangeEvent, FormEvent, MouseEvent, KeyboardEvent } from "react";

type InputChangeHandler = (e: ChangeEvent<HTMLInputElement>) => void;
type FormSubmitHandler = (e: FormEvent<HTMLFormElement>) => void;
type ButtonClickHandler = (e: MouseEvent<HTMLButtonElement>) => void;
type KeyPressHandler = (e: KeyboardEvent<HTMLInputElement>) => void;

// Generic event handler
type EventHandler<E extends HTMLElement, T extends Event> = (
  e: T & { currentTarget: E }
) => void;
```

### Context Types

```typescript
import { createContext, useContext, ReactNode } from "react";

interface ThemeContextValue {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

// Context with type
const ThemeContext = createContext<ThemeContextValue | null>(null);

// Safe hook with error on missing provider
function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
```

### Children Props Patterns

```typescript
import { ReactNode, PropsWithChildren } from "react";

// Explicit children
interface LayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
}

// Using PropsWithChildren utility
type CardProps = PropsWithChildren<{
  title: string;
  variant?: "default" | "outlined";
}>;

// Render prop pattern
interface RenderPropComponent<T> {
  data: T;
  children: (data: T) => ReactNode;
}
```
