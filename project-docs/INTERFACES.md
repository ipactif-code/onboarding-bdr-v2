# Cross-Project Interfaces

Defines contracts between specialized projects. When a project needs something from another, this is the reference.

---

## Back-end → Front-end

### What Back-end Provides
- Convex function contracts (args, returns, errors)
- TypeScript types in `src/types/`
- Authorization requirements per function

### Contract Format
```typescript
/**
 * @function api.courses.get
 * @auth requireAuth
 * @args { courseId: Id<"courses"> }
 * @returns Course | null
 * @errors "Course not found", "Access denied"
 */
```

### How Front-end Consumes
```typescript
const course = useQuery(api.courses.get, { courseId });
// Handle: undefined (loading), null (not found), data
```

---

## Design System → Front-end

### What Design System Provides
- UI components in `src/components/ui/`
- Design tokens in `globals.css`
- Component API documentation

### Contract Format
```typescript
/**
 * @component Button
 * @props variant: "default" | "destructive" | "outline" | "ghost"
 * @props size: "default" | "sm" | "lg" | "icon"
 * @props disabled: boolean
 * @accessibility Keyboard: Tab, Enter, Space. Requires aria-label for icon-only.
 */
```

### Requesting New Components
Front-end provides:
- Use case description
- Required variants
- Accessibility needs
- Example usage

---

## Security → Back-end

### What Security Provides
- Auth helpers in `convex/lib/auth.ts`
- Access control matrix
- Route protection rules

### Auth Helpers
| Helper | Use Case |
|--------|----------|
| `requireAuth(ctx)` | Any authenticated user |
| `requireAdmin(ctx)` | Admin-only operations |
| `requireSelfOrAdmin(ctx, userId)` | Self or admin access |

### Contract
```typescript
// Back-end MUST call auth helper as FIRST line
export const myMutation = mutation({
  handler: async (ctx, args) => {
    await requireAdmin(ctx); // FIRST
    // ... business logic
  },
});
```

---

## Architecture → All Projects

### Performance Budget (Enforced)
| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |
| Initial JS | < 150KB gzip |
| Convex query p95 | < 100ms |

### Folder Structure (Enforced)
```
src/app/          # Next.js routes
src/components/ui/  # Design System ONLY
src/components/[feature]/  # Feature components
src/hooks/        # Custom hooks
src/types/        # TypeScript types
convex/           # Backend functions
```

---

## IA → Back-end

### What IA Provides
- Prompt templates
- Model recommendations
- Cost estimates
- Validation functions

### Contract Format
```typescript
/**
 * @action ai.generateQuiz
 * @model gpt-4-turbo-preview
 * @cost ~$0.04 per call
 * @input { topic: string, count: number }
 * @output QuizQuestion[]
 * @validation validateQuestion() for each item
 */
```

### Back-end Implements
```typescript
// Convex action following IA's spec
export const generateQuiz = action({
  // Use IA's prompt template
  // Use IA's validation function
  // Handle errors per IA's guidance
});
```

---

## Chief Architect → All Projects

### Routing Contract
When Chief Architect routes a task:
```markdown
## Your Task: [Description]

### Context
[Why this is needed]

### Questions to Answer
1. [Specific question]
2. [Specific question]

### Expected Output
[Format expected]

### Deadline Context
IMMEDIATE | HIGH | NORMAL | LOW
```

### Project Response Format
```markdown
## Response: [Task]

### Recommendation
[Summary in 1-2 sentences]

### Details
[Analysis with code if relevant]

### Confidence: HIGH | MEDIUM | LOW
[Justification]

### Impact on Other Projects
- [Project X]: [What they need to know]
```

---

## Interface Change Protocol

1. **Propose**: Document what changes and why
2. **Review**: Chief Architect routes to affected projects
3. **Decide**: Approve, modify, or reject
4. **Implement**: Provider implements, consumers migrate
5. **Document**: Update this INTERFACES.md
