# Advanced Types Reference

## Table of Contents

1. [Generics](#generics)
2. [Conditional Types](#conditional-types)
3. [Mapped Types](#mapped-types)
4. [The `infer` Keyword](#the-infer-keyword)
5. [Template Literal Types](#template-literal-types)

---

## Generics

### Basic Generic Function

```typescript
function identity<T>(value: T): T {
  return value;
}

// Usage - type is inferred
const str = identity("hello"); // string
const num = identity(42);      // number
```

### Constrained Generics (ALWAYS USE)

```typescript
// ❌ BAD: Unconstrained generic
function getLength<T>(item: T): number {
  return item.length; // Error: T doesn't have length
}

// ✅ GOOD: Constrained generic
function getLength<T extends { length: number }>(item: T): number {
  return item.length;
}

// ✅ GOOD: Constraint with interface
interface HasId {
  _id: string;
}

function getById<T extends HasId>(items: T[], id: string): T | undefined {
  return items.find(item => item._id === id);
}
```

### Multiple Type Parameters

```typescript
function map<TInput, TOutput>(
  items: TInput[],
  transform: (item: TInput) => TOutput
): TOutput[] {
  return items.map(transform);
}

// Usage
const numbers = map(["1", "2", "3"], Number); // number[]
```

### Generic Interfaces

```typescript
interface Repository<T extends { _id: string }> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(data: Omit<T, "_id">): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}
```

### Generic Classes

```typescript
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }
}
```

### Default Type Parameters

```typescript
interface ApiResponse<TData = unknown, TError = Error> {
  data?: TData;
  error?: TError;
  status: number;
}

// Uses defaults
const response: ApiResponse = { status: 200, data: {} };

// Overrides defaults
const typedResponse: ApiResponse<User[], string> = {
  status: 200,
  data: []
};
```

---

## Conditional Types

### Basic Conditional Type

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>;  // true
type B = IsString<number>;  // false
```

### Conditional with Union Distribution

```typescript
// Distributes over union members
type ToArray<T> = T extends unknown ? T[] : never;

type StringOrNumberArray = ToArray<string | number>;
// Result: string[] | number[]

// Prevent distribution with tuple
type ToArrayNonDist<T> = [T] extends [unknown] ? T[] : never;

type MixedArray = ToArrayNonDist<string | number>;
// Result: (string | number)[]
```

### Extracting Types from Unions

```typescript
type Status = "draft" | "published" | "archived" | "deleted";

// Extract specific statuses
type ActiveStatus = Extract<Status, "draft" | "published">;
// Result: "draft" | "published"

// Exclude specific statuses
type VisibleStatus = Exclude<Status, "deleted">;
// Result: "draft" | "published" | "archived"
```

### Conditional Type with Objects

```typescript
type ExtractIdType<T> = T extends { _id: infer U } ? U : never;

interface User {
  _id: string;
  name: string;
}

interface Post {
  _id: number;
  title: string;
}

type UserId = ExtractIdType<User>;  // string
type PostId = ExtractIdType<Post>;  // number
```

---

## Mapped Types

### Basic Mapped Type

```typescript
type ReadonlyAll<T> = {
  readonly [K in keyof T]: T[K];
};

type OptionalAll<T> = {
  [K in keyof T]?: T[K];
};
```

### Mapped Type with Key Remapping

```typescript
// Add prefix to all keys
type Prefixed<T, P extends string> = {
  [K in keyof T as `${P}${Capitalize<string & K>}`]: T[K];
};

interface User {
  name: string;
  email: string;
}

type PrefixedUser = Prefixed<User, "user">;
// Result: { userName: string; userEmail: string; }
```

### Filtering Keys in Mapped Types

```typescript
// Keep only string properties
type StringKeysOnly<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};

interface Mixed {
  name: string;
  age: number;
  email: string;
}

type StringProps = StringKeysOnly<Mixed>;
// Result: { name: string; email: string; }
```

### Mapped Type for Getters/Setters

```typescript
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getters<Person>;
// Result: { getName: () => string; getAge: () => number; }
```

---

## The `infer` Keyword

### Extracting Return Type

```typescript
type MyReturnType<T extends (...args: unknown[]) => unknown> = 
  T extends (...args: unknown[]) => infer R ? R : never;

function createUser(): { id: string; name: string } {
  return { id: "1", name: "John" };
}

type UserType = MyReturnType<typeof createUser>;
// Result: { id: string; name: string }
```

### Extracting Function Parameters

```typescript
type MyParameters<T extends (...args: unknown[]) => unknown> = 
  T extends (...args: infer P) => unknown ? P : never;

function updateUser(id: string, data: { name: string }): void {}

type UpdateParams = MyParameters<typeof updateUser>;
// Result: [id: string, data: { name: string }]
```

### Extracting Array Element Type

```typescript
type ArrayElement<T> = T extends (infer E)[] ? E : never;

type StringArrayElement = ArrayElement<string[]>;  // string
type MixedElement = ArrayElement<(string | number)[]>;  // string | number
```

### Extracting Promise Value

```typescript
type Awaited<T> = T extends Promise<infer U>
  ? U extends Promise<unknown>
    ? Awaited<U>  // Recursively unwrap nested promises
    : U
  : T;

type A = Awaited<Promise<string>>;                    // string
type B = Awaited<Promise<Promise<number>>>;           // number
type C = Awaited<string>;                             // string (non-promise passthrough)
```

### Extracting Constructor Parameters

```typescript
type ConstructorParams<T extends new (...args: unknown[]) => unknown> = 
  T extends new (...args: infer P) => unknown ? P : never;

class Service {
  constructor(public name: string, public port: number) {}
}

type ServiceParams = ConstructorParams<typeof Service>;
// Result: [name: string, port: number]
```

### Complex Infer: Extracting Props from Component

```typescript
import { ComponentProps, ElementType } from "react";

type PropsOf<T extends ElementType> = T extends ElementType
  ? ComponentProps<T>
  : never;

// For Convex: Extract document type from Id
type DocFromId<T> = T extends Id<infer TableName> ? TableName : never;

type CourseTable = DocFromId<Id<"courses">>;  // "courses"
```

---

## Template Literal Types

### Basic Template Literals

```typescript
type EventName = "click" | "focus" | "blur";
type EventHandler = `on${Capitalize<EventName>}`;
// Result: "onClick" | "onFocus" | "onBlur"
```

### Building API Paths

```typescript
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type ApiVersion = "v1" | "v2";
type Resource = "users" | "posts" | "comments";

type ApiEndpoint = `/${ApiVersion}/${Resource}`;
// Result: "/v1/users" | "/v1/posts" | ... | "/v2/comments"
```

### Parsing Template Literals

```typescript
type ExtractRouteParams<T extends string> = 
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? Param | ExtractRouteParams<`/${Rest}`>
    : T extends `${infer _Start}:${infer Param}`
      ? Param
      : never;

type Params = ExtractRouteParams<"/users/:userId/posts/:postId">;
// Result: "userId" | "postId"
```

### CSS Property Types

```typescript
type CSSUnit = "px" | "em" | "rem" | "%";
type CSSValue = `${number}${CSSUnit}`;

function setWidth(width: CSSValue): void {}

setWidth("100px");  // ✅
setWidth("2rem");   // ✅
setWidth("100");    // ❌ Error
```
