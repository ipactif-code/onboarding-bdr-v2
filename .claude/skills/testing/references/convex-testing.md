# Convex Testing Patterns

## Table of Contents
1. [Setup](#setup)
2. [Testing Queries](#testing-queries)
3. [Testing Mutations](#testing-mutations)
4. [Testing Actions](#testing-actions)
5. [Authentication](#authentication)
6. [Advanced Patterns](#advanced-patterns)

---

## Setup

### Installation
```bash
pnpm add -D convex-test
```

### Basic Test Structure
```typescript
// convex/courses.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("courses", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema);
  });

  it("lists courses", async () => {
    const courses = await t.query(api.courses.list);
    expect(courses).toEqual([]);
  });
});
```

### Edge Runtime Configuration
```typescript
// convex/vitest.config.ts (separate config for Convex tests)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
  },
});
```

---

## Testing Queries

### Simple Query
```typescript
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

describe("courses.list", () => {
  it("returns empty array when no courses exist", async () => {
    const t = convexTest(schema);
    const courses = await t.query(api.courses.list);
    expect(courses).toEqual([]);
  });

  it("returns all courses", async () => {
    const t = convexTest(schema);

    // Seed data using run()
    await t.run(async (ctx) => {
      await ctx.db.insert("courses", {
        title: "React Basics",
        description: "Learn React",
        status: "published",
      });
      await ctx.db.insert("courses", {
        title: "TypeScript",
        description: "Learn TS",
        status: "published",
      });
    });

    const courses = await t.query(api.courses.list);
    expect(courses).toHaveLength(2);
    expect(courses[0].title).toBe("React Basics");
  });
});
```

### Query with Arguments
```typescript
describe("courses.getById", () => {
  it("returns course by id", async () => {
    const t = convexTest(schema);

    // Create course and get ID
    const courseId = await t.run(async (ctx) => {
      return await ctx.db.insert("courses", {
        title: "Test Course",
        description: "Description",
        status: "draft",
      });
    });

    const course = await t.query(api.courses.getById, { id: courseId });
    expect(course?.title).toBe("Test Course");
  });

  it("returns null for non-existent id", async () => {
    const t = convexTest(schema);

    // Use a fake ID that doesn't exist
    const fakeId = "k175xp9v5vkmxekqnjspm53jz574r9r1" as Id<"courses">;
    const course = await t.query(api.courses.getById, { id: fakeId });
    expect(course).toBeNull();
  });
});
```

---

## Testing Mutations

### Create Mutation
```typescript
describe("courses.create", () => {
  it("creates a new course", async () => {
    const t = convexTest(schema);

    const courseId = await t.mutation(api.courses.create, {
      title: "New Course",
      description: "Course description",
    });

    // Verify in database
    const course = await t.run(async (ctx) => {
      return await ctx.db.get(courseId);
    });

    expect(course).toMatchObject({
      title: "New Course",
      description: "Course description",
      status: "draft",
    });
  });
});
```

### Update Mutation
```typescript
describe("courses.update", () => {
  it("updates existing course", async () => {
    const t = convexTest(schema);

    // Create initial course
    const courseId = await t.run(async (ctx) => {
      return await ctx.db.insert("courses", {
        title: "Original",
        description: "Original desc",
        status: "draft",
      });
    });

    // Update course
    await t.mutation(api.courses.update, {
      id: courseId,
      title: "Updated Title",
    });

    // Verify update
    const course = await t.run(async (ctx) => {
      return await ctx.db.get(courseId);
    });
    expect(course?.title).toBe("Updated Title");
    expect(course?.description).toBe("Original desc"); // Unchanged
  });
});
```

### Delete Mutation
```typescript
describe("courses.delete", () => {
  it("deletes course", async () => {
    const t = convexTest(schema);

    const courseId = await t.run(async (ctx) => {
      return await ctx.db.insert("courses", {
        title: "To Delete",
        description: "Will be deleted",
        status: "draft",
      });
    });

    await t.mutation(api.courses.delete, { id: courseId });

    const course = await t.run(async (ctx) => {
      return await ctx.db.get(courseId);
    });
    expect(course).toBeNull();
  });
});
```

---

## Testing Actions

### HTTP Actions
```typescript
describe("actions.fetchExternalData", () => {
  it("fetches and processes external data", async () => {
    const t = convexTest(schema);

    // Mock fetch response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: "external" }),
    });

    const result = await t.action(api.actions.fetchExternalData, {
      url: "https://api.example.com/data",
    });

    expect(result).toEqual({ processed: "external" });
  });
});
```

### Actions Calling Mutations
```typescript
describe("actions.importCourses", () => {
  it("imports courses from external source", async () => {
    const t = convexTest(schema);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          courses: [
            { title: "Course 1", description: "Desc 1" },
            { title: "Course 2", description: "Desc 2" },
          ],
        }),
    });

    await t.action(api.actions.importCourses, {
      sourceUrl: "https://example.com/courses",
    });

    const courses = await t.query(api.courses.list);
    expect(courses).toHaveLength(2);
  });
});
```

---

## Authentication

### With Authenticated User
```typescript
describe("authenticated queries", () => {
  it("returns user's courses", async () => {
    const t = convexTest(schema);

    // Set up authenticated identity
    const asUser = t.withIdentity({
      subject: "user_123",
      issuer: "https://clerk.example.com",
      email: "user@example.com",
    });

    // Seed user's courses
    await t.run(async (ctx) => {
      await ctx.db.insert("courses", {
        title: "User's Course",
        ownerId: "user_123",
        status: "published",
      });
      await ctx.db.insert("courses", {
        title: "Other's Course",
        ownerId: "user_456",
        status: "published",
      });
    });

    // Query as authenticated user
    const courses = await asUser.query(api.courses.listMyCourses);
    expect(courses).toHaveLength(1);
    expect(courses[0].title).toBe("User's Course");
  });
});
```

### Testing Auth Errors
```typescript
describe("auth requirements", () => {
  it("throws when not authenticated", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.courses.create, {
        title: "Test",
        description: "Test",
      })
    ).rejects.toThrow("Not authenticated");
  });
});
```

### Different User Roles
```typescript
describe("role-based access", () => {
  it("allows admin to delete any course", async () => {
    const t = convexTest(schema);

    const asAdmin = t.withIdentity({
      subject: "admin_1",
      issuer: "https://clerk.example.com",
      role: "admin",
    });

    const courseId = await t.run(async (ctx) => {
      return await ctx.db.insert("courses", {
        title: "Any Course",
        ownerId: "other_user",
        status: "published",
      });
    });

    await asAdmin.mutation(api.courses.delete, { id: courseId });

    const course = await t.run(async (ctx) => ctx.db.get(courseId));
    expect(course).toBeNull();
  });

  it("prevents non-owner from deleting", async () => {
    const t = convexTest(schema);

    const asOtherUser = t.withIdentity({
      subject: "other_user",
      issuer: "https://clerk.example.com",
    });

    const courseId = await t.run(async (ctx) => {
      return await ctx.db.insert("courses", {
        title: "Owner's Course",
        ownerId: "owner_123",
        status: "published",
      });
    });

    await expect(
      asOtherUser.mutation(api.courses.delete, { id: courseId })
    ).rejects.toThrow("Not authorized");
  });
});
```

---

## Advanced Patterns

### Testing Scheduled Functions
```typescript
describe("scheduled jobs", () => {
  it("processes scheduled cleanup", async () => {
    const t = convexTest(schema);

    // Create expired data
    await t.run(async (ctx) => {
      await ctx.db.insert("sessions", {
        userId: "user_1",
        expiresAt: Date.now() - 86400000, // 1 day ago
      });
    });

    // Run scheduled function
    await t.mutation(api.crons.cleanupExpiredSessions);

    const sessions = await t.run(async (ctx) => {
      return await ctx.db.query("sessions").collect();
    });
    expect(sessions).toHaveLength(0);
  });
});
```

### Testing Indexes
```typescript
describe("indexed queries", () => {
  it("uses index for efficient lookup", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      for (let i = 0; i < 100; i++) {
        await ctx.db.insert("courses", {
          title: `Course ${i}`,
          status: i % 2 === 0 ? "published" : "draft",
          categoryId: `cat_${i % 5}`,
        });
      }
    });

    const published = await t.query(api.courses.listByStatus, {
      status: "published",
    });
    expect(published).toHaveLength(50);
  });
});
```

### Testing File Storage
```typescript
describe("file uploads", () => {
  it("stores file reference", async () => {
    const t = convexTest(schema);

    const asUser = t.withIdentity({
      subject: "user_1",
      issuer: "https://clerk.example.com",
    });

    // Mock storage ID
    const storageId = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"_storage">;

    const fileId = await asUser.mutation(api.files.create, {
      storageId,
      fileName: "document.pdf",
      contentType: "application/pdf",
    });

    const file = await t.run(async (ctx) => ctx.db.get(fileId));
    expect(file).toMatchObject({
      storageId,
      fileName: "document.pdf",
    });
  });
});
```

### Seeding Test Data Helper
```typescript
// convex/test-utils.ts
import { convexTest } from "convex-test";
import schema from "./schema";

export function createTestContext() {
  return convexTest(schema);
}

export async function seedCourseWithLessons(
  t: ReturnType<typeof convexTest>,
  options: { lessonCount?: number } = {}
) {
  const { lessonCount = 3 } = options;

  return await t.run(async (ctx) => {
    const courseId = await ctx.db.insert("courses", {
      title: "Test Course",
      description: "Test Description",
      status: "published",
    });

    const lessonIds = [];
    for (let i = 0; i < lessonCount; i++) {
      const lessonId = await ctx.db.insert("lessons", {
        courseId,
        title: `Lesson ${i + 1}`,
        order: i,
        content: `Content for lesson ${i + 1}`,
      });
      lessonIds.push(lessonId);
    }

    return { courseId, lessonIds };
  });
}

// Usage in tests
describe("course with lessons", () => {
  it("lists lessons in order", async () => {
    const t = createTestContext();
    const { courseId } = await seedCourseWithLessons(t, { lessonCount: 5 });

    const lessons = await t.query(api.lessons.listByCourse, { courseId });
    expect(lessons).toHaveLength(5);
    expect(lessons.map((l) => l.order)).toEqual([0, 1, 2, 3, 4]);
  });
});
```
