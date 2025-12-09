# Convex Function Contracts: Quiz Attempts

**Module**: `convex/quizzes.ts`
**Date**: 2025-12-06

## Overview

Quiz attempt tracking for quiz lessons. Handles submission, scoring,
and attempt management with retry limits.

---

## Queries

### `api.quizzes.getAttempts`
Get all attempts for a quiz by current user.

```typescript
export const getAttempts = query({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.array(v.object({
    _id: v.id("quizAttempts"),
    attemptNumber: v.number(),
    score: v.number(),
    maxScore: v.number(),
    percentage: v.number(),
    passed: v.boolean(),
    submittedAt: v.number(),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Current user's attempts only

---

### `api.quizzes.getLatestAttempt`
Get the most recent attempt with answer details.

```typescript
export const getLatestAttempt = query({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.optional(v.object({
    _id: v.id("quizAttempts"),
    attemptNumber: v.number(),
    score: v.number(),
    maxScore: v.number(),
    percentage: v.number(),
    passed: v.boolean(),
    submittedAt: v.number(),
    answers: v.array(v.object({
      questionId: v.id("quizQuestions"),
      questionText: v.string(),
      selectedOptions: v.array(v.number()), // indices
      correctOptions: v.array(v.number()), // shown if showAnswers enabled
      isCorrect: v.boolean(),
      points: v.number(),
      earnedPoints: v.number(),
      explanation: v.optional(v.string()), // shown if showAnswers enabled
    })),
    canRetry: v.boolean(),
    attemptsRemaining: v.optional(v.number()), // null = unlimited
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Current user only
**Note**: `correctOptions` and `explanation` only included if quiz `showAnswers` is true

---

### `api.quizzes.getQuizStatus`
Get quiz status for display (without revealing answers).

```typescript
export const getQuizStatus = query({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.object({
    attemptCount: v.number(),
    maxAttempts: v.optional(v.number()), // null = unlimited
    bestScore: v.optional(v.number()),
    passed: v.boolean(),
    canAttempt: v.boolean(),
    passingScore: v.number(),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Current user only

---

### `api.quizzes.getAttemptsForUser` (Admin)
Get all attempts for a specific user on a quiz.

```typescript
export const getAttemptsForUser = query({
  args: {
    lessonId: v.id("lessons"),
    userId: v.id("users"),
  },
  returns: v.array(v.object({
    _id: v.id("quizAttempts"),
    attemptNumber: v.number(),
    score: v.number(),
    maxScore: v.number(),
    percentage: v.number(),
    passed: v.boolean(),
    submittedAt: v.number(),
    answers: v.array(v.object({
      questionId: v.id("quizQuestions"),
      questionText: v.string(),
      selectedOptions: v.array(v.number()),
      correctOptions: v.array(v.number()),
      isCorrect: v.boolean(),
      points: v.number(),
      earnedPoints: v.number(),
    })),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

## Mutations

### `api.quizzes.submit`
Submit a quiz attempt.

```typescript
export const submit = mutation({
  args: {
    lessonId: v.id("lessons"),
    answers: v.array(v.object({
      questionId: v.id("quizQuestions"),
      selectedOptions: v.array(v.number()), // option indices
    })),
  },
  returns: v.object({
    attemptId: v.id("quizAttempts"),
    score: v.number(),
    maxScore: v.number(),
    percentage: v.number(),
    passed: v.boolean(),
    canRetry: v.boolean(),
    attemptsRemaining: v.optional(v.number()),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Any authenticated user with course access
**Validation**:
- User must have attempts remaining (or unlimited)
- All questions must have at least one answer
- Question IDs must belong to the quiz

**Side Effects**:
- Creates quiz attempt record
- If passed, marks lesson as completed
- Logs activity for analytics

---

### `api.quizzes.resetAttempts`
Reset all attempts for a user (admin function).

```typescript
export const resetAttempts = mutation({
  args: {
    lessonId: v.id("lessons"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Side Effects**: Resets lesson progress to not_started

---

## Scoring Logic

```typescript
// Per question scoring
function scoreQuestion(question, selectedOptions) {
  const correctOptions = question.options
    .map((opt, idx) => opt.isCorrect ? idx : -1)
    .filter(idx => idx >= 0);

  const isCorrect =
    selectedOptions.length === correctOptions.length &&
    selectedOptions.every(idx => correctOptions.includes(idx));

  return isCorrect ? question.points : 0;
}

// Total score
totalScore = sum(earnedPoints for each question)
maxScore = sum(points for each question)
percentage = (totalScore / maxScore) * 100
passed = percentage >= passingScore
```

---

## Retry Logic

```typescript
// Check if user can retry
function canRetry(quizConfig, attemptCount) {
  if (!quizConfig.allowRetry) return false;
  if (quizConfig.maxAttempts === null) return true; // unlimited
  return attemptCount < quizConfig.maxAttempts;
}

// Attempts remaining
function attemptsRemaining(quizConfig, attemptCount) {
  if (quizConfig.maxAttempts === null) return null; // unlimited
  return Math.max(0, quizConfig.maxAttempts - attemptCount);
}
```

---

## Validation Rules

- Quiz must have at least one question to be attempted
- Each question must have at least one correct answer
- User must answer all questions (no partial submissions)
- maxAttempts: 1-10 or null (unlimited)
- passingScore: 1-100

---

## Edge Cases

- **No correct answers set**: Validation prevents publishing quiz
- **Network disconnect during submission**: Client should retry; duplicate submissions are prevented by checking latest attempt timestamp
- **Quiz modified after attempt started**: Attempt is scored against questions at submission time
