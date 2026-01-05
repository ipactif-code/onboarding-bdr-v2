# Convex Function Contracts: Sections & Lessons

**Module**: `convex/sections.ts` and `convex/lessons.ts`
**Date**: 2025-12-06

## Overview

Section and lesson management for course content structure.
Lessons support four types: text, embed, quiz, and files.

---

# Sections

## Queries

### `api.sections.listByCourse`
Get all sections for a course in display order.

```typescript
export const listByCourse = query({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.array(v.object({
    _id: v.id("sections"),
    title: v.string(),
    description: v.optional(v.string()),
    displayOrder: v.number(),
    lessonCount: v.number(),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin or user with course access

---

## Mutations

### `api.sections.create`
Create a new section in a course.

```typescript
export const create = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("sections"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Validation**: Title 3-200 characters

---

### `api.sections.update`
Update section details.

```typescript
export const update = mutation({
  args: {
    sectionId: v.id("sections"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.sections.remove`
Delete a section and all its lessons.

```typescript
export const remove = mutation({
  args: {
    sectionId: v.id("sections"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Side Effects**: Cascades to lessons, files, quiz configs

---

### `api.sections.reorder`
Reorder sections within a course.

```typescript
export const reorder = mutation({
  args: {
    courseId: v.id("courses"),
    sectionOrders: v.array(v.object({
      sectionId: v.id("sections"),
      displayOrder: v.number(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

# Lessons

## Queries

### `api.lessons.get`
Get lesson details including type-specific content.

```typescript
export const get = query({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.object({
    _id: v.id("lessons"),
    sectionId: v.id("sections"),
    courseId: v.id("courses"),
    type: v.union(
      v.literal("text"),
      v.literal("embed"),
      v.literal("quiz"),
      v.literal("files")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    estimatedDuration: v.optional(v.number()),
    content: v.optional(v.any()), // Plate.js JSON
    displayOrder: v.number(),

    // Type-specific fields (only one populated based on type)
    embedConfig: v.optional(v.object({
      url: v.string(),
      provider: v.union(
        v.literal("youtube"),
        v.literal("vimeo"),
        v.literal("loom"),
        v.literal("figma"),
        v.literal("other")
      ),
    })),
    quizConfig: v.optional(v.object({
      passingScore: v.number(),
      allowRetry: v.boolean(),
      maxAttempts: v.optional(v.number()),
      showAnswers: v.boolean(),
      questions: v.array(v.object({
        _id: v.id("quizQuestions"),
        questionText: v.string(),
        options: v.array(v.object({
          text: v.string(),
          isCorrect: v.boolean(),
        })),
        explanation: v.optional(v.string()),
        points: v.number(),
        displayOrder: v.number(),
      })),
    })),
    files: v.optional(v.array(v.object({
      _id: v.id("files"),
      fileName: v.string(),
      fileSize: v.number(),
      fileType: v.string(),
      downloadUrl: v.string(),
    }))),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin or user with course access

---

### `api.lessons.listBySection`
Get all lessons in a section.

```typescript
export const listBySection = query({
  args: {
    sectionId: v.id("sections"),
  },
  returns: v.array(v.object({
    _id: v.id("lessons"),
    type: v.union(
      v.literal("text"),
      v.literal("embed"),
      v.literal("quiz"),
      v.literal("files")
    ),
    title: v.string(),
    estimatedDuration: v.optional(v.number()),
    displayOrder: v.number(),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin or user with course access

---

## Mutations

### `api.lessons.create`
Create a new lesson in a section.

```typescript
export const create = mutation({
  args: {
    sectionId: v.id("sections"),
    type: v.union(
      v.literal("text"),
      v.literal("embed"),
      v.literal("quiz"),
      v.literal("files")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    estimatedDuration: v.optional(v.number()),
  },
  returns: v.id("lessons"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Validation**:
- Title: 3-200 characters
- estimatedDuration: Positive integer (minutes)

---

### `api.lessons.update`
Update lesson basic info.

```typescript
export const update = mutation({
  args: {
    lessonId: v.id("lessons"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    estimatedDuration: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.lessons.updateContent`
Update Plate.js rich text content.

```typescript
export const updateContent = mutation({
  args: {
    lessonId: v.id("lessons"),
    content: v.any(), // Plate.js JSON structure
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Validation**: Sanitize content on read (XSS prevention)

---

### `api.lessons.remove`
Delete a lesson.

```typescript
export const remove = mutation({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Side Effects**: Deletes associated embed config, quiz config, questions, files

---

### `api.lessons.reorder`
Reorder lessons within a section.

```typescript
export const reorder = mutation({
  args: {
    sectionId: v.id("sections"),
    lessonOrders: v.array(v.object({
      lessonId: v.id("lessons"),
      displayOrder: v.number(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

## Embed Lesson Functions

### `api.lessons.setEmbed`
Set embed URL for an embed lesson.

```typescript
export const setEmbed = mutation({
  args: {
    lessonId: v.id("lessons"),
    url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Behavior**: Auto-detects provider (YouTube, Vimeo, Loom, Figma, other)

---

## Quiz Lesson Functions

### `api.lessons.updateQuizConfig`
Update quiz settings.

```typescript
export const updateQuizConfig = mutation({
  args: {
    lessonId: v.id("lessons"),
    passingScore: v.optional(v.number()),
    allowRetry: v.optional(v.boolean()),
    maxAttempts: v.optional(v.number()), // null = unlimited
    showAnswers: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Validation**:
- passingScore: 1-100
- maxAttempts: 1-10 or null

---

### `api.lessons.addQuestion`
Add a question to a quiz.

```typescript
export const addQuestion = mutation({
  args: {
    lessonId: v.id("lessons"),
    questionText: v.string(),
    options: v.array(v.object({
      text: v.string(),
      isCorrect: v.boolean(),
    })),
    explanation: v.optional(v.string()),
    points: v.number(),
  },
  returns: v.id("quizQuestions"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Validation**:
- Must have 2-6 options
- At least one option must be correct
- Points must be positive

---

### `api.lessons.updateQuestion`
Update an existing question.

```typescript
export const updateQuestion = mutation({
  args: {
    questionId: v.id("quizQuestions"),
    questionText: v.optional(v.string()),
    options: v.optional(v.array(v.object({
      text: v.string(),
      isCorrect: v.boolean(),
    }))),
    explanation: v.optional(v.string()),
    points: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.lessons.removeQuestion`
Delete a question from a quiz.

```typescript
export const removeQuestion = mutation({
  args: {
    questionId: v.id("quizQuestions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.lessons.reorderQuestions`
Reorder questions within a quiz.

```typescript
export const reorderQuestions = mutation({
  args: {
    lessonId: v.id("lessons"),
    questionOrders: v.array(v.object({
      questionId: v.id("quizQuestions"),
      displayOrder: v.number(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

## Validation Rules

### Lesson
- Title: 3-200 characters
- Description: Max 2000 characters
- estimatedDuration: Positive integer (minutes)

### Quiz
- passingScore: 1-100
- maxAttempts: 1-10 or null (unlimited)
- Each question: 2-6 options
- Each question: At least one correct answer
- Points: Positive integer

### Embed
- Supported providers: YouTube, Vimeo, Loom, Figma
- Unsupported URLs display as generic links with warning
